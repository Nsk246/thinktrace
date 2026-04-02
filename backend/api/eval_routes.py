from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from api.auth import get_current_user, require_admin
from core.database import User
from core.memory import knowledge_graph
from eval.scorers import eval_suite
import logging
import json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/eval", tags=["eval"])

EVAL_REDIS_KEY = "thinktrace:eval:latest"


def get_redis():
    try:
        import redis as redis_lib, ssl
        from core.config import get_settings
        settings = get_settings()
        r = redis_lib.from_url(
            settings.redis_url,
            decode_responses=True,
            ssl_cert_reqs=ssl.CERT_NONE,
            socket_connect_timeout=3,
        )
        r.ping()
        return r
    except Exception:
        return None


@router.post("/run")
async def run_eval_suite(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
):
    """Admin only: run the full eval suite in the background."""
    def run_in_background():
        results = eval_suite.run_full_suite()
        r = get_redis()
        if r:
            r.set(EVAL_REDIS_KEY, json.dumps(results), ex=86400)
        logger.info(f"Eval suite complete: {results['passed']}/{results['total']} passed")
    background_tasks.add_task(run_in_background)
    return {
        "status": "running",
        "message": "Eval suite started in background. Poll /api/v1/eval/results for output.",
    }


@router.get("/results")
async def get_eval_results(current_user: User = Depends(get_current_user)):
    """Get the latest eval suite results."""
    r = get_redis()
    if r:
        raw = r.get(EVAL_REDIS_KEY)
        if raw:
            results = json.loads(raw)
            return {"status": "complete", **results}
    return {
        "status": "no_results",
        "message": "No eval results yet. POST to /api/v1/eval/run to start.",
    }


@router.get("/graph/stats")
async def get_graph_stats(current_user: User = Depends(get_current_user)):
    stats = knowledge_graph.get_graph_stats(current_user.org_id)
    return stats


@router.get("/graph/fallacies")
async def get_common_fallacies(
    current_user: User = Depends(get_current_user),
    limit: int = 10,
):
    fallacies = knowledge_graph.query_common_fallacies(
        org_id=current_user.org_id,
        limit=limit,
    )
    return {"org_id": current_user.org_id, "fallacies": fallacies}


@router.get("/graph/trends")
async def get_score_trends(current_user: User = Depends(get_current_user)):
    trends = knowledge_graph.query_score_trend(current_user.org_id)
    return {"org_id": current_user.org_id, "trends": trends}


@router.get("/graph/search")
async def search_claims(
    query: str,
    current_user: User = Depends(get_current_user),
    limit: int = 5,
):
    related = knowledge_graph.query_related_claims(query, limit=limit)
    return {"query": query, "results": related}
