from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from agents.ingestion import IngestionAgent
from core.models import AnalysisRequest, ContentType
from core.graph import run_full_analysis
from celery.result import AsyncResult
from services.celery_app import celery_app
import traceback

router = APIRouter(prefix="/api/v1", tags=["analysis"])
ingestion_agent = IngestionAgent()


# ── Ingestion endpoints ──────────────────────────────────────────

@router.post("/ingest/text")
async def ingest_text(request: AnalysisRequest):
    try:
        claim_tree = ingestion_agent.run(
            content=request.content,
            content_type=ContentType.TEXT,
        )
        return {
            "status": "success",
            "source_type": claim_tree.source_type,
            "claim_count": len(claim_tree.claims),
            "claims": [c.model_dump() for c in claim_tree.claims],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest/url")
async def ingest_url(url: str):
    try:
        claim_tree = ingestion_agent.run(
            content=url,
            content_type=ContentType.URL,
        )
        return {
            "status": "success",
            "source_type": claim_tree.source_type,
            "claim_count": len(claim_tree.claims),
            "claims": [c.model_dump() for c in claim_tree.claims],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    try:
        pdf_bytes = await file.read()
        claim_tree = ingestion_agent.run(
            content=pdf_bytes,
            content_type=ContentType.PDF,
        )
        return {
            "status": "success",
            "source_type": claim_tree.source_type,
            "filename": file.filename,
            "claim_count": len(claim_tree.claims),
            "claims": [c.model_dump() for c in claim_tree.claims],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Sync analysis (direct, blocks until complete) ────────────────

@router.post("/analyze")
async def analyze(request: AnalysisRequest):
    try:
        claim_tree = ingestion_agent.run(
            content=request.content,
            content_type=request.content_type,
        )
        result = run_full_analysis(claim_tree)
        return {
            "status": result.status,
            "analysis_id": result.id,
            "claim_count": len(result.claim_tree.claims),
            "argument_graph": {
                "nodes": len(result.argument_graph.nodes),
                "edges": len(result.argument_graph.edges),
            },
            "fallacies": [f.model_dump() for f in result.fallacies],
            "fact_checks": [fc.model_dump() for fc in result.fact_checks],
            "epistemic_score": result.epistemic_score.model_dump(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Async analysis (queued via Celery) ───────────────────────────

@router.post("/analyze/async")
async def analyze_async(request: AnalysisRequest):
    """
    Submit analysis job to queue. Returns job_id immediately.
    Poll /jobs/{job_id} for status and results.
    """
    try:
        from services.tasks import run_analysis_task
        task = run_analysis_task.apply_async(
            args=[request.content, request.content_type.value, request.org_id],
            queue="analysis",
        )
        return {
            "status": "queued",
            "job_id": task.id,
            "message": "Analysis queued. Poll /api/v1/jobs/{job_id} for results.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Queue error: {str(e)}")


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """
    Poll for async job status and results.
    States: PENDING → PROGRESS → SUCCESS | FAILURE
    """
    try:
        task_result = AsyncResult(job_id, app=celery_app)
        state = task_result.state

        if state == "PENDING":
            return {"job_id": job_id, "status": "pending", "progress": 0}

        elif state == "PROGRESS":
            meta = task_result.info or {}
            return {
                "job_id": job_id,
                "status": "processing",
                "step": meta.get("step", "unknown"),
                "progress": meta.get("progress", 0),
                "claim_count": meta.get("claim_count"),
            }

        elif state == "SUCCESS":
            return {
                "job_id": job_id,
                "status": "complete",
                "progress": 100,
                "result": task_result.result,
            }

        elif state == "FAILURE":
            return {
                "job_id": job_id,
                "status": "failed",
                "error": str(task_result.info),
            }

        else:
            return {"job_id": job_id, "status": state.lower()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs")
async def list_jobs():
    """Health check for the task queue."""
    try:
        inspect = celery_app.control.inspect()
        active = inspect.active()
        reserved = inspect.reserved()
        return {
            "queue": "online" if active is not None else "offline",
            "active_tasks": sum(len(v) for v in active.values()) if active else 0,
            "queued_tasks": sum(len(v) for v in reserved.values()) if reserved else 0,
        }
    except Exception as e:
        return {"queue": "offline", "error": str(e)}
