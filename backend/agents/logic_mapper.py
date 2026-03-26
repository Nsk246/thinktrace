from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from core.config import get_settings
from core.models import ClaimTree, ArgumentGraph, ArgumentNode, ArgumentEdge
import json
import re
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    api_key=settings.anthropic_api_key,
    max_tokens=4096,
)

MAPPING_PROMPT = """Analyze the logical structure of these claims and return a JSON object.

Claims:
{claims}

Return this exact JSON structure:
{{
  "nodes": [
    {{"id": "claim_id", "text": "claim text", "node_type": "premise|conclusion|sub_claim"}}
  ],
  "edges": [
    {{"source_id": "id", "target_id": "id", "relation": "supports|contradicts|qualifies", "validity_score": 0.8, "weakness_note": null}}
  ],
  "missing_premises": [],
  "has_circular_reasoning": false,
  "circular_reasoning_note": null
}}"""


def extract_json(text: str) -> dict | None:
    """Extract JSON using brace counting — handles nested objects correctly."""
    text = text.strip()
    
    # Find first {
    start = text.find("{")
    if start == -1:
        return None
    
    # Count braces to find matching closing }
    depth = 0
    in_string = False
    escape_next = False
    
    for i, ch in enumerate(text[start:], start=start):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\":
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i+1])
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error at position {i}: {e}")
                    return None
    return None


class LogicMapperAgent:
    def run(self, claim_tree: ClaimTree) -> ArgumentGraph:
        sorted_claims = sorted(
            claim_tree.claims,
            key=lambda c: 0 if c.claim_type == "conclusion"
                else (1 if c.claim_type == "sub_claim" else 2)
        )[:6]

        claims_text = "\n".join([
            f"ID: {c.id} | Type: {c.claim_type} | Text: {c.text}"
            for c in sorted_claims
        ])

        try:
            response = llm.invoke([
                SystemMessage(content="You are an expert logician. Return only a valid JSON object. Start with { and end with }. No markdown or explanation."),
                HumanMessage(content=MAPPING_PROMPT.format(claims=claims_text)),
            ])

            parsed = extract_json(response.content)

            if parsed is None:
                logger.error(f"Logic mapping: could not extract JSON from: {repr(response.content[:200])}")
                return ArgumentGraph(nodes=[], edges=[])

            nodes = [
                ArgumentNode(
                    id=n["id"],
                    text=n["text"],
                    node_type=n.get("node_type", "premise"),
                )
                for n in parsed.get("nodes", [])
            ]

            edges = []
            for e in parsed.get("edges", []):
                edge = ArgumentEdge(
                    source_id=e["source_id"],
                    target_id=e["target_id"],
                    relation=e.get("relation", "supports"),
                )
                edge.__dict__["validity_score"] = e.get("validity_score", 1.0)
                edge.__dict__["weakness_note"] = e.get("weakness_note", None)
                edges.append(edge)

            graph = ArgumentGraph(nodes=nodes, edges=edges)
            graph.__dict__["missing_premises"] = parsed.get("missing_premises", [])
            graph.__dict__["has_circular_reasoning"] = parsed.get("has_circular_reasoning", False)
            graph.__dict__["circular_reasoning_note"] = parsed.get("circular_reasoning_note", None)

            weak_edges = [e for e in edges if e.__dict__.get("validity_score", 1.0) < 0.5]
            if weak_edges:
                logger.info(f"Logic Mapper: {len(weak_edges)} weak reasoning edges detected")

            logger.info(f"Logic Mapper: {len(nodes)} nodes, {len(edges)} edges, "
                       f"{len(graph.__dict__['missing_premises'])} missing premises")
            return graph

        except Exception as e:
            logger.error(f"Logic mapping failed: {e}")
            return ArgumentGraph(nodes=[], edges=[])
