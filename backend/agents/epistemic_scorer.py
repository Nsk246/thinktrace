from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from core.config import get_settings
from core.models import ClaimTree, Fallacy, FactCheckResult, EpistemicScore
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

SCORING_PROMPT = """You are an expert epistemologist scoring content quality.

Content type: {content_type}
Scoring mode: {scoring_mode}

SCORING MODES — apply the right criteria:

MODE: direct_argument / persuasive
- Score on: evidence quality, logical validity, claim support
- Penalize: unsupported claims, fallacies, misrepresented facts
- Typical range: 10-90 depending on argument quality

MODE: encyclopedic / reporting
- Score on: factual accuracy, balanced representation, correct attribution
- Do NOT penalize for describing fringe or wrong beliefs accurately
- Do NOT penalize for presenting multiple sides
- Penalize: factual errors in the description itself, biased framing, misattribution
- Typical range: 55-90 (neutral accurate reporting scores high)

MODE: academic
- Score on: analytical rigor, evidence use, logical structure
- Typical range: 40-90

MODE: mixed
- Split scoring: author's own claims scored as argument, reported content scored as reporting
- Weight by proportion of each type

INPUTS:
Claims: {claims}
Fallacies found: {fallacies}
Fact checks: {fact_checks}
Author claim ratio: {author_claim_ratio} (proportion of claims that are the author's own)

Return ONLY valid JSON:
{{
  "evidence_score": 0-100,
  "logic_score": 0-100,
  "overall_score": 0-100,
  "summary": "2-3 sentences explaining the score in context of the content type"
}}"""


class EpistemicScorerAgent:
    def run(self, claim_tree: ClaimTree, fallacies: list[Fallacy],
            fact_checks: list[FactCheckResult]) -> EpistemicScore:

        content_meta = claim_tree.__dict__.get("content_meta", {})
        content_type = content_meta.get("content_type", "direct_argument")

        # Determine scoring mode
        if content_type in ("encyclopedic", "reporting"):
            scoring_mode = "encyclopedic / reporting — score on accuracy of description"
        elif content_type in ("persuasive", "direct_argument"):
            scoring_mode = "direct_argument / persuasive — score on argument quality"
        elif content_type == "academic":
            scoring_mode = "academic — score on analytical rigor"
        else:
            scoring_mode = "mixed — split scoring by claim attribution"

        # Calculate author claim ratio
        total = len(claim_tree.claims)
        author_claims = sum(1 for c in claim_tree.claims if c.__dict__.get("is_author_claim", True))
        author_ratio = round(author_claims / total, 2) if total > 0 else 1.0

        claims_text = []
        for c in claim_tree.claims:
            is_author = c.__dict__.get("is_author_claim", True)
            attr = c.__dict__.get("attributed_to", None)
            label = "AUTHOR'S CLAIM" if is_author else f"ATTRIBUTED TO {attr or 'others'}"
            claims_text.append(f"[{label}] {c.claim_type}: {c.text}")

        fallacies_text = [
            f"{f.name} ({f.severity}): {f.explanation[:100]}"
            for f in fallacies
        ] if fallacies else ["None detected"]

        fc_text = [
            f"{fc.verdict} ({fc.confidence:.0%}): {fc.explanation[:100]}"
            for fc in fact_checks
        ] if fact_checks else ["No fact checks"]

        try:
            response = llm.invoke([HumanMessage(content=SCORING_PROMPT.format(
                content_type=content_type,
                scoring_mode=scoring_mode,
                claims="\n".join(claims_text),
                fallacies="\n".join(fallacies_text),
                fact_checks="\n".join(fc_text),
                author_claim_ratio=f"{author_ratio} ({author_claims}/{total} claims are the author's own)",
            ))])

            raw = response.content.strip()
            raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE).strip()
            raw = re.sub(r"```$", "", raw, flags=re.MULTILINE).strip()
            parsed = json.loads(raw)

            score = EpistemicScore(
                evidence_score=parsed.get("evidence_score", 50),
                logic_score=parsed.get("logic_score", 50),
                overall_score=parsed.get("overall_score", 50),
                summary=parsed.get("summary", ""),
            )
            logger.info(f"Score: {score.overall_score} (type: {content_type}, author ratio: {author_ratio})")
            return score

        except Exception as e:
            logger.error(f"Scoring failed: {e}")
            return EpistemicScore(evidence_score=50, logic_score=50, overall_score=50,
                                  summary="Scoring unavailable.")
