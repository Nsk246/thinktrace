from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.tools import DuckDuckGoSearchRun
from core.config import get_settings
from core.models import ClaimTree, FactCheckResult, Claim
import json
import re

settings = get_settings()
llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    api_key=settings.anthropic_api_key,
    max_tokens=4096,
)
search = DuckDuckGoSearchRun(backend='auto')

FACT_CHECK_PROMPT = """You are a rigorous fact-checker. You have been given a claim and search results related to it.

Based on the search results, evaluate the claim:
- verdict: "supported" | "contradicted" | "unverifiable" | "contested"
  - supported: search results clearly back the claim
  - contradicted: search results clearly refute the claim
  - contested: search results show genuine disagreement among sources
  - unverifiable: not enough evidence found to make a determination
- confidence: 0.0 to 1.0 how confident you are in your verdict
- sources: list of up to 3 relevant URLs or source names from the search results
- explanation: 2-3 sentences explaining your verdict based on the evidence

Return ONLY valid JSON, no explanation, no markdown:
{
  "verdict": "supported|contradicted|unverifiable|contested",
  "confidence": 0.85,
  "sources": ["source1", "source2"],
  "explanation": "Your explanation here"
}"""


def fact_check_single_claim(claim: Claim) -> FactCheckResult:
    # Only fact-check premises — conclusions are opinions, not facts
    if claim.claim_type == "conclusion":
        return FactCheckResult(
            claim_id=claim.id,
            verdict="unverifiable",
            confidence=0.5,
            sources=[],
            explanation="This is a conclusion/opinion claim — fact-checking not applicable.",
        )

    try:
        search_results = search.run(claim.text[:200])
    except Exception:
        search_results = "No search results available."

    messages = [
        SystemMessage(content=FACT_CHECK_PROMPT),
        HumanMessage(content=(
            f"Claim to fact-check: {claim.text}\n\n"
            f"Search results:\n{search_results}"
        )),
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()
    raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"```$", "", raw, flags=re.MULTILINE)
    parsed = json.loads(raw.strip())

    return FactCheckResult(
        claim_id=claim.id,
        verdict=parsed.get("verdict", "unverifiable"),
        confidence=parsed.get("confidence", 0.5),
        sources=parsed.get("sources", []),
        explanation=parsed.get("explanation", ""),
    )


class FactCheckerAgent:
    def run(self, claim_tree: ClaimTree) -> list[FactCheckResult]:
        # Only fact-check up to 6 claims to keep it fast and cost-effective
        checkable = [
            c for c in claim_tree.claims
            if c.claim_type in ("premise", "sub_claim")
        ][:6]

        results = []
        for claim in checkable:
            result = fact_check_single_claim(claim)
            results.append(result)

        return results
