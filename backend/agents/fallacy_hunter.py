from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from core.config import get_settings
from core.models import ClaimTree, Fallacy
import json
import re

settings = get_settings()
llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    api_key=settings.anthropic_api_key,
    max_tokens=4096,
)

FALLACY_PROMPT = """You are an expert in logic and argumentation. Detect ALL logical fallacies in the given claims.

For each fallacy found:
- name: the precise name of the fallacy (e.g. "Ad Hominem", "Straw Man", "False Dichotomy", "Appeal to Authority", "Slippery Slope", "Hasty Generalization", "Circular Reasoning", "Appeal to Emotion", "Red Herring", "False Cause")
- description: one sentence defining this fallacy type
- affected_claim_id: the ID of the claim containing the fallacy
- severity: "low" | "medium" | "high" based on how much it undermines the argument
- explanation: exactly why this specific claim commits this fallacy

If no fallacies are found return an empty list.
Return ONLY valid JSON, no explanation, no markdown.

Return this exact structure:
{
  "fallacies": [
    {
      "name": "Fallacy Name",
      "description": "Definition of this fallacy",
      "affected_claim_id": "claim_id_here",
      "severity": "low|medium|high",
      "explanation": "Why this specific claim commits this fallacy"
    }
  ]
}"""


class FallacyHunterAgent:
    def run(self, claim_tree: ClaimTree) -> list[Fallacy]:
        claims_text = "\n".join([
            f"ID: {c.id} | Type: {c.claim_type} | Text: {c.text}"
            for c in claim_tree.claims
        ])

        messages = [
            SystemMessage(content=FALLACY_PROMPT),
            HumanMessage(content=f"Detect all logical fallacies in these claims:\n\n{claims_text}"),
        ]

        response = llm.invoke(messages)
        raw = response.content.strip()
        raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"```$", "", raw, flags=re.MULTILINE)
        parsed = json.loads(raw.strip())

        return [
            Fallacy(
                name=f["name"],
                description=f["description"],
                affected_claim_id=f["affected_claim_id"],
                severity=f.get("severity", "medium"),
                explanation=f["explanation"],
            )
            for f in parsed.get("fallacies", [])
        ]
