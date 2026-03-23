from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from core.config import get_settings
from core.models import ClaimTree, ArgumentGraph, ArgumentNode, ArgumentEdge
import json
import re

settings = get_settings()
llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    api_key=settings.anthropic_api_key,
    max_tokens=4096,
)

LOGIC_MAP_PROMPT = """You are an expert logician. Given a list of claims, build an argument graph showing how they logically connect.

For each connection identify:
- source_id: the claim ID that supports or relates to the target
- target_id: the claim ID being supported or contradicted
- relation: one of "supports" | "contradicts" | "qualifies"

Rules:
- premises support conclusions or sub_claims
- sub_claims support conclusions
- some premises may contradict each other
- qualifies means the claim modifies or limits another claim
- Only create edges where there is a genuine logical relationship
- Return ONLY valid JSON, no explanation, no markdown

Return this exact structure:
{
  "nodes": [
    {"id": "claim_id", "text": "claim text", "node_type": "premise|conclusion|sub_claim"}
  ],
  "edges": [
    {"source_id": "id1", "target_id": "id2", "relation": "supports|contradicts|qualifies"}
  ]
}"""


class LogicMapperAgent:
    def run(self, claim_tree: ClaimTree) -> ArgumentGraph:
        claims_text = "\n".join([
            f"ID: {c.id} | Type: {c.claim_type} | Text: {c.text}"
            for c in claim_tree.claims
        ])

        messages = [
            SystemMessage(content=LOGIC_MAP_PROMPT),
            HumanMessage(content=f"Build the argument graph for these claims:\n\n{claims_text}"),
        ]

        response = llm.invoke(messages)
        raw = response.content.strip()
        raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"```$", "", raw, flags=re.MULTILINE)
        parsed = json.loads(raw.strip())

        nodes = [
            ArgumentNode(
                id=n["id"],
                text=n["text"],
                node_type=n.get("node_type", "sub_claim"),
            )
            for n in parsed.get("nodes", [])
        ]

        edges = [
            ArgumentEdge(
                source_id=e["source_id"],
                target_id=e["target_id"],
                relation=e.get("relation", "supports"),
            )
            for e in parsed.get("edges", [])
        ]

        return ArgumentGraph(nodes=nodes, edges=edges)
