from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from api.auth import get_current_user, require_admin
from core.database import User
from core.memory import knowledge_graph
from eval.scorers import eval_suite
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/eval", tags=["eval"])

eval_results_cache = {}


@router.post("/run")
async def run_eval_suite(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
):
    """Admin only: run the full eval suite in the background."""
    def run_in_background():
        results = eval_suite.run_full_suite()
        eval_results_cache["latest"] = results
        logger.info(f"Eval suite complete: {results['passed']}/{results['total']} passed")

    background_tasks.add_task(run_in_background)
    return {
        "status": "running",
        "message": "Eval suite started in background. Poll /api/v1/eval/results for output.",
    }


@router.get("/results")
async def get_eval_results(current_user: User = Depends(get_current_user)):
    """Get the latest eval suite results."""
    if "latest" not in eval_results_cache:
        return {
            "status": "no_results",
            "message": "No eval results yet. POST to /api/v1/eval/run to start.",
        }
    return {"status": "complete", **eval_results_cache["latest"]}


@router.get("/graph/stats")
async def get_graph_stats(current_user: User = Depends(get_current_user)):
    """Get knowledge graph statistics for the current org."""
    stats = knowledge_graph.get_graph_stats(current_user.org_id)
    return stats


@router.get("/graph/fallacies")
async def get_common_fallacies(
    current_user: User = Depends(get_current_user),
    limit: int = 10,
):
    """Get most common fallacies detected in this org."""
    fallacies = knowledge_graph.query_common_fallacies(
        org_id=current_user.org_id,
        limit=limit,
    )
    return {
        "org_id": current_user.org_id,
        "fallacies": fallacies,
    }


@router.get("/graph/trends")
async def get_score_trends(current_user: User = Depends(get_current_user)):
    """Get epistemic score trends over time for this org."""
    trends = knowledge_graph.query_score_trend(current_user.org_id)
    return {
        "org_id": current_user.org_id,
        "trends": trends,
    }


@router.get("/graph/search")
async def search_claims(
    query: str,
    current_user: User = Depends(get_current_user),
    limit: int = 5,
):
    """Search for related claims across all analyses in the knowledge graph."""
    related = knowledge_graph.query_related_claims(query, limit=limit)
    return {
        "query": query,
        "results": related,
    }
