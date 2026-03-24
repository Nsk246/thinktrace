from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from core.config import get_settings
from core.models import ClaimTree, Fallacy
import json
import re
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    api_key=settings.anthropic_api_key,
    max_tokens=1024,
)

CONTENT_TYPE_DESCRIPTIONS = {
    "direct_argument": "The author is personally making these claims.",
    "reporting": "The author is reporting what others believe or said — fallacies belong to the reported parties, not the author.",
    "encyclopedic": "This is encyclopedic or reference content — fallacies are rare and only apply to the text's own framing.",
    "academic": "This is analytical text — fallacies apply to the author's analytical claims only.",
    "persuasive": "This is persuasive content — apply full fallacy detection to the author's claims.",
    "mixed": "This is mixed content — only flag fallacies in the author's own claims, not in attributed or reported content.",
}

FALLACY_PROMPT = """You are a logical fallacy expert analyzing an argument.

Content context: {context}

RULES:
- ONLY flag fallacies in claims where is_author_claim is TRUE
- NEVER flag a fallacy just because the belief being described is wrong or fringe
- For reporting/encyclopedic content, only flag if the text's OWN framing or structure contains flawed reasoning
- For quoted or attributed claims, only flag if the author misrepresents what was said
- A text accurately describing a conspiracy theory is NOT committing a fallacy

Common fallacies to detect: Ad Hominem, Straw Man, False Cause, Appeal to Authority (misuse),
Hasty Generalization, False Dichotomy, Slippery Slope, Circular Reasoning, Appeal to Emotion,
Bandwagon, Red Herring, Appeal to Ignorance, Loaded Question, No True Scotsman.

Claims to analyze:
{claims}

Return ONLY valid JSON:
{{
  "fallacies": [
    {{
      "name": "Fallacy Name",
      "severity": "low|medium|high",
      "affected_claim_id": "claim id here",
      "explanation": "Specific explanation of why this is a fallacy in the author's reasoning"
    }}
  ]
}}"""


class FallacyHunterAgent:
    def run(self, claim_tree: ClaimTree) -> list[Fallacy]:
        content_meta = claim_tree.__dict__.get("content_meta", {})
        content_type = content_meta.get("content_type", "direct_argument")
        context = CONTENT_TYPE_DESCRIPTIONS.get(content_type, CONTENT_TYPE_DESCRIPTIONS["direct_argument"])

        # Build claims text with attribution info
        claims_text = []
        for c in claim_tree.claims:
            is_author = c.__dict__.get("is_author_claim", True)
            attributed_to = c.__dict__.get("attributed_to", None)
            attribution_note = ""
            if not is_author and attributed_to:
                attribution_note = f" [ATTRIBUTED TO: {attributed_to} — not author's claim]"
            elif not is_author:
                attribution_note = " [REPORTED/ATTRIBUTED — not author's own claim]"
            claims_text.append(
                f"ID: {c.id} | is_author_claim: {is_author} | type: {c.claim_type}{attribution_note}\nText: {c.text}"
            )

        prompt = FALLACY_PROMPT.format(
            context=context,
            claims="\n\n".join(claims_text),
        )

        try:
            response = llm.invoke([HumanMessage(content=prompt)])
            raw = response.content.strip()
            raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE).strip()
            raw = re.sub(r"```$", "", raw, flags=re.MULTILINE).strip()
            parsed = json.loads(raw)

            fallacies = []
            for f in parsed.get("fallacies", []):
                # Extra safety — verify the affected claim is actually an author claim
                affected_id = f.get("affected_claim_id", "")
                affected_claim = next((c for c in claim_tree.claims if c.id == affected_id), None)
                if affected_claim and not affected_claim.__dict__.get("is_author_claim", True):
                    logger.info(f"Skipping fallacy on attributed claim: {f.get('name')}")
                    continue
                fallacies.append(Fallacy(
                    name=f.get("name", "Unknown"),
                    severity=f.get("severity", "medium"),
                    affected_claim_id=affected_id,
                    explanation=f.get("explanation", ""),
                    description=f.get("explanation", ""),
                ))

            logger.info(f"Detected {len(fallacies)} fallacies (content type: {content_type})")
            return fallacies

        except Exception as e:
            logger.error(f"Fallacy detection failed: {e}")
            return []
