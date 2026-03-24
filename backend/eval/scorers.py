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


def normalize_fallacy_name(name: str) -> str:
    """Normalize fallacy names for fuzzy matching."""
    name = name.lower().strip()
    name = re.sub(r"[^a-z\s]", "", name)
    replacements = {
        "conspiracy theory fallacy": "conspiracy",
        "conspiracy theory": "conspiracy",
        "appeal to conspiracy": "conspiracy",
        "appeal to authority": "authority",
        "false cause": "false cause",
        "hasty generalization": "hasty generalization",
        "appeal to popularity": "appeal to popularity",
        "appeal to emotion": "appeal to emotion",
        "non sequitur": "non sequitur",
    }
    for key, val in replacements.items():
        if key in name:
            return val
    return name


def score_fallacy_detection(
    detected_fallacies: list[Fallacy],
    ground_truth_fallacies: list[str],
) -> dict:
    if not ground_truth_fallacies:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0, "note": "No ground truth"}

    detected_normalized = {normalize_fallacy_name(f.name) for f in detected_fallacies}
    truth_normalized = {normalize_fallacy_name(g) for g in ground_truth_fallacies}

    true_positives = len(detected_normalized & truth_normalized)
    precision = true_positives / len(detected_normalized) if detected_normalized else 0.0
    recall = true_positives / len(truth_normalized) if truth_normalized else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if (precision + recall) > 0 else 0.0
    )

    return {
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1": round(f1, 3),
        "detected": [f.name for f in detected_fallacies],
        "expected": ground_truth_fallacies,
        "missed": list(truth_normalized - detected_normalized),
        "false_positives": list(detected_normalized - truth_normalized),
    }


def score_claim_extraction(
    extracted_claims: ClaimTree,
    original_text: str,
) -> dict:
    EVAL_PROMPT = """You are evaluating claim extraction quality.

Score these dimensions (0.0 to 1.0):
- completeness: did it capture all important claims?
- accuracy: are extracted claims faithful to the original?
- typing_accuracy: are premise/conclusion/sub_claim labels correct?

Return ONLY valid JSON:
{
  "completeness": 0.9,
  "accuracy": 0.95,
  "typing_accuracy": 0.85,
  "notes": "Brief explanation"
}"""

    claims_text = "\n".join([
        f"[{c.claim_type}] {c.text}"
        for c in extracted_claims.claims
    ])

    try:
        messages = [
            SystemMessage(content=EVAL_PROMPT),
            HumanMessage(content=(
                f"ORIGINAL TEXT:\n{original_text[:2000]}\n\n"
                f"EXTRACTED CLAIMS:\n{claims_text}"
            )),
        ]
        response = llm.invoke(messages)
        raw = response.content.strip()
        raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"```$", "", raw, flags=re.MULTILINE)
        return json.loads(raw.strip())
    except Exception as e:
        return {"completeness": 0, "accuracy": 0, "typing_accuracy": 0, "error": str(e)}


def score_epistemic_calibration(
    epistemic_score: EpistemicScore,
    expected_score_range: list[int],
) -> dict:
    """
    Checks if the epistemic score falls within the expected range.
    Low scores on bad arguments = CORRECT. High scores on good arguments = CORRECT.
    """
    actual = epistemic_score.overall_score
    in_range = expected_score_range[0] <= actual <= expected_score_range[1]

    return {
        "is_calibrated": in_range,
        "actual_score": actual,
        "expected_range": expected_score_range,
        "calibration_note": (
            "Well calibrated" if in_range
            else f"Score {actual} outside expected range {expected_score_range}"
        ),
    }


EVAL_DATASET = [
    {
        "id": "eval_001",
        "text": "Vaccines cause autism. Multiple studies prove this. The CDC is hiding the data.",
        "expected_fallacies": ["False Cause", "Conspiracy Theory Fallacy", "Appeal to Authority"],
        "expected_score_range": [0, 30],
        "description": "Classic misinformation — should score very low",
    },
    {
        "id": "eval_002",
        "text": (
            "Climate change is real and human-caused. "
            "NASA, NOAA, and 97% of climate scientists agree. "
            "Global temperatures have risen 1.1C since pre-industrial times. "
            "Therefore we must reduce carbon emissions immediately."
        ),
        "expected_fallacies": [],
        "expected_score_range": [35, 100],
        "description": "Well-evidenced scientific argument — should score high",
    },
    {
        "id": "eval_003",
        "text": (
            "You should buy this supplement because celebrities use it. "
            "It has no side effects. Big pharma doesn't want you to know about it. "
            "Thousands of five-star reviews prove it works."
        ),
        "expected_fallacies": ["Appeal to Authority", "Conspiracy Theory Fallacy", "Hasty Generalization"],
        "expected_score_range": [0, 35],
        "description": "Marketing misinformation — multiple fallacies expected",
    },
]


class ThinkTraceEvalSuite:
    def run_single_eval(self, eval_case: dict) -> dict:
        from agents.ingestion import IngestionAgent
        from core.models import ContentType
        from core.graph import run_full_analysis

        ingestion = IngestionAgent()

        try:
            claim_tree = ingestion.run(
                content=eval_case["text"],
                content_type=ContentType.TEXT,
            )
            result = run_full_analysis(claim_tree)

            fallacy_scores = score_fallacy_detection(
                result.fallacies,
                eval_case["expected_fallacies"],
            )

            claim_scores = score_claim_extraction(
                result.claim_tree,
                eval_case["text"],
            )

            calibration = score_epistemic_calibration(
                result.epistemic_score,
                eval_case["expected_score_range"],
            )

            # Pass criteria: score in range AND recall >= 0.5 on fallacies
            fallacy_recall_ok = fallacy_scores.get("recall", 1.0) >= 0.5
            passed = calibration["is_calibrated"] and fallacy_recall_ok

            return {
                "eval_id": eval_case["id"],
                "description": eval_case["description"],
                "passed": passed,
                "epistemic_score": result.epistemic_score.overall_score,
                "expected_score_range": eval_case["expected_score_range"],
                "score_in_range": calibration["is_calibrated"],
                "fallacy_recall_ok": fallacy_recall_ok,
                "fallacy_scores": fallacy_scores,
                "claim_scores": claim_scores,
                "calibration": calibration,
                "fallacies_detected": [f.name for f in result.fallacies],
            }

        except Exception as e:
            logger.error(f"Eval {eval_case['id']} failed: {e}")
            return {
                "eval_id": eval_case["id"],
                "description": eval_case["description"],
                "passed": False,
                "error": str(e),
            }

    def run_full_suite(self) -> dict:
        logger.info("Starting ThinkTrace eval suite...")
        results = []

        for case in EVAL_DATASET:
            logger.info(f"Running eval: {case['id']} — {case['description']}")
            result = self.run_single_eval(case)
            results.append(result)
            logger.info(
                f"Eval {case['id']}: {'PASS' if result.get('passed') else 'FAIL'} "
                f"score={result.get('epistemic_score', 'N/A')}"
            )

        passed = sum(1 for r in results if r.get("passed"))
        total = len(results)

        return {
            "total": total,
            "passed": passed,
            "failed": total - passed,
            "pass_rate": round(passed / total * 100, 1),
            "results": results,
        }


eval_suite = ThinkTraceEvalSuite()
