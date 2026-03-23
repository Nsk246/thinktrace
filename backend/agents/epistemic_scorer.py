from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from core.config import get_settings
from core.models import ClaimTree, ArgumentGraph, Fallacy, FactCheckResult, EpistemicScore
import json
import re

settings = get_settings()
llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    api_key=settings.anthropic_api_key,
    max_tokens=2048,
)

SCORER_PROMPT = """You are an expert epistemologist and argument quality assessor.

Given an argument's claims, detected fallacies, and fact-check results, score the argument quality.

Scoring criteria:
- evidence_score (0-100): How well-supported are the factual claims? 
  - 90-100: All claims supported by strong evidence
  - 70-89: Most claims supported, minor gaps
  - 50-69: Mixed evidence, some unsupported claims
  - 30-49: Weak evidence, many unsupported claims
  - 0-29: Little to no credible evidence

- logic_score (0-100): How valid is the reasoning structure?
  - 90-100: No fallacies, airtight logical structure
  - 70-89: Minor fallacies, mostly sound reasoning
  - 50-69: Some significant fallacies present
  - 30-49: Multiple serious fallacies
  - 0-29: Deeply flawed reasoning throughout

- overall_score: weighted average (evidence 50%, logic 50%)
- summary: 2-3 sentences explaining the scores

Return ONLY valid JSON:
{
  "evidence_score": 75.0,
  "logic_score": 60.0,
  "overall_score": 67.5,
  "summary": "Your summary here"
}"""


class EpistemicScorerAgent:
    def run(
        self,
        claim_tree: ClaimTree,
        argument_graph: ArgumentGraph,
        fallacies: list[Fallacy],
        fact_checks: list[FactCheckResult],
    ) -> EpistemicScore:

        claims_summary = "\n".join([
            f"- [{c.claim_type}] {c.text}"
            for c in claim_tree.claims
        ])

        fallacy_summary = "\n".join([
            f"- {f.name} (severity: {f.severity}): {f.explanation}"
            for f in fallacies
        ]) if fallacies else "No fallacies detected."

        fact_check_summary = "\n".join([
            f"- {fc.verdict.upper()} (confidence: {fc.confidence}): {fc.explanation}"
            for fc in fact_checks
        ]) if fact_checks else "No fact checks performed."

        graph_summary = (
            f"{len(argument_graph.nodes)} nodes, "
            f"{len(argument_graph.edges)} logical connections"
        )

        messages = [
            SystemMessage(content=SCORER_PROMPT),
            HumanMessage(content=(
                f"CLAIMS:\n{claims_summary}\n\n"
                f"ARGUMENT GRAPH: {graph_summary}\n\n"
                f"FALLACIES DETECTED:\n{fallacy_summary}\n\n"
                f"FACT CHECK RESULTS:\n{fact_check_summary}"
            )),
        ]

        response = llm.invoke(messages)
        raw = response.content.strip()
        raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"```$", "", raw, flags=re.MULTILINE)
        parsed = json.loads(raw.strip())

        evidence = float(parsed.get("evidence_score", 50.0))
        logic = float(parsed.get("logic_score", 50.0))
        overall = round((evidence + logic) / 2, 1)

        return EpistemicScore(
            evidence_score=evidence,
            logic_score=logic,
            overall_score=overall,
            summary=parsed.get("summary", ""),
        )
