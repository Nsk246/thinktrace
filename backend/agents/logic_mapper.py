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
    max_tokens=2048,
)

MAPPING_PROMPT = """You are an expert logician. Analyze the logical structure of these claims.

For each logical relationship between claims:
1. Identify the relation: "supports", "contradicts", "qualifies", "requires"
2. Score the validity of that relationship (0.0 to 1.0):
   - 1.0 = the source claim strongly and directly supports/contradicts the target
   - 0.7 = moderate support, some logical gap
   - 0.4 = weak support, significant logical leap
   - 0.1 = very tenuous connection
3. Note any weakness in the reasoning chain
4. Identify missing premises — unstated assumptions required for the argument to work
5. Flag circular reasoning if present

Claims:
{claims}

Return ONLY valid JSON:
{
  "nodes": [
    {
      "id": "claim id",
      "text": "claim text",
      "node_type": "premise|conclusion|sub_claim"
    }
  ],
  "edges": [
    {
      "source_id": "id",
      "target_id": "id",
      "relation": "supports|contradicts|qualifies|requires",
      "validity_score": 0.0-1.0,
      "weakness_note": "explanation of any logical gap, or null if strong"
    }
  ],
  "missing_premises": [
    "Unstated assumption required for the argument"
  ],
  "has_circular_reasoning": false,
  "circular_reasoning_note": null
}"""


class LogicMapperAgent:
    def run(self, claim_tree: ClaimTree) -> ArgumentGraph:
        sorted_claims = sorted(
            claim_tree.claims,
            key=lambda c: 0 if c.claim_type == "conclusion"
                else (1 if c.claim_type == "sub_claim" else 2)
        )[:8]

        claims_text = "\n".join([
            f"ID: {c.id} | Type: {c.claim_type} | Text: {c.text}"
            for c in sorted_claims
        ])

        try:
            response = llm.invoke([
                SystemMessage(content="You are an expert logician. Return only valid JSON with no markdown, no backticks, no explanation."),
                HumanMessage(content=MAPPING_PROMPT.format(claims=claims_text)),
            ])
            raw = response.content.strip()
            # Aggressively clean markdown
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
            raw = raw.strip()
            # Find JSON object boundaries
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start != -1 and end > start:
                raw = raw[start:end]
            parsed = json.loads(raw)

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
                # Store validation metadata
                edge.__dict__["validity_score"] = e.get("validity_score", 1.0)
                edge.__dict__["weakness_note"] = e.get("weakness_note", None)
                edges.append(edge)

            graph = ArgumentGraph(nodes=nodes, edges=edges)
            # Store extra analysis on the graph
            graph.__dict__["missing_premises"] = parsed.get("missing_premises", [])
            graph.__dict__["has_circular_reasoning"] = parsed.get("has_circular_reasoning", False)
            graph.__dict__["circular_reasoning_note"] = parsed.get("circular_reasoning_note", None)

            # Log weak edges
            weak_edges = [e for e in edges if e.__dict__.get("validity_score", 1.0) < 0.5]
            if weak_edges:
                logger.info(f"Logic Mapper: {len(weak_edges)} weak reasoning edges detected")

            logger.info(f"Logic Mapper: {len(nodes)} nodes, {len(edges)} edges, "
                       f"{len(graph.__dict__['missing_premises'])} missing premises")
            return graph

        except Exception as e:
            logger.error(f"Logic mapping failed: {e}")
            return ArgumentGraph(nodes=[], edges=[])
