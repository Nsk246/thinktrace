from services.celery_app import celery_app, logger
from core.models import ClaimTree, ContentType, AnalysisResult
from core.graph import run_full_analysis
from agents.ingestion import IngestionAgent
import json
import traceback

ingestion_agent = IngestionAgent()


@celery_app.task(
    bind=True,
    name="services.tasks.run_analysis_task",
    max_retries=2,
    soft_time_limit=120,
    time_limit=150,
)
def run_analysis_task(self, content: str, content_type: str, org_id: str = "default") -> dict:
    """
    Async task: ingest content → extract claims → run 4 agents → return result.
    Runs in a Celery worker, completely non-blocking.
    """
    try:
        self.update_state(state="PROGRESS", meta={"step": "ingesting", "progress": 10})
        logger.info(f"Task {self.request.id}: ingesting content type={content_type}")

        claim_tree = ingestion_agent.run(
            content=content,
            content_type=ContentType(content_type),
        )

        self.update_state(
            state="PROGRESS",
            meta={
                "step": "analyzing",
                "progress": 30,
                "claim_count": len(claim_tree.claims),
            },
        )
        logger.info(f"Task {self.request.id}: extracted {len(claim_tree.claims)} claims, running agents")

        result = run_full_analysis(claim_tree)

        self.update_state(state="PROGRESS", meta={"step": "scoring", "progress": 90})

        output = {
            "status": "complete",
            "analysis_id": result.id,
            "org_id": org_id,
            "claim_count": len(result.claim_tree.claims),
            "argument_graph": {
                "nodes": [n.model_dump() for n in result.argument_graph.nodes],
                "edges": [e.model_dump() for e in result.argument_graph.edges],
            },
            "fallacies": [f.model_dump() for f in result.fallacies],
            "fact_checks": [fc.model_dump() for fc in result.fact_checks],
            "epistemic_score": result.epistemic_score.model_dump(),
            "raw_text": result.claim_tree.raw_text[:500],
        }

        logger.info(f"Task {self.request.id}: complete, score={result.epistemic_score.overall_score}")
        return output

    except Exception as exc:
        logger.error(f"Task {self.request.id} failed: {traceback.format_exc()}")
        self.update_state(
            state="FAILURE",
            meta={"step": "failed", "error": str(exc)},
        )
        raise self.retry(exc=exc, countdown=5)
