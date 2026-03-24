from fastapi import APIRouter, UploadFile, File, HTTPException
from agents.ingestion import IngestionAgent
from core.models import AnalysisRequest, ContentType
from core.graph import run_full_analysis
from core.database import SessionLocal, AnalysisRecord
from celery.result import AsyncResult
from services.celery_app import celery_app
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["analysis"])
ingestion_agent = IngestionAgent()


def save_analysis_record(result, request: AnalysisRequest):
    """Save analysis to SQLite, Pinecone, and Neo4j."""
    from services.pinecone_service import upsert_analysis
    from core.memory import knowledge_graph

    # 1 — SQLite (primary store)
    import json as _json
    db = SessionLocal()
    try:
        full_result_json = _json.dumps({
            "analysis_id": result.id,
            "claim_count": len(result.claim_tree.claims),
            "claims": [c.model_dump() for c in result.claim_tree.claims],
            "argument_graph": {
                "nodes": [n.model_dump() for n in result.argument_graph.nodes],
                "edges": [e.model_dump() for e in result.argument_graph.edges],
            },
            "fallacies": [
                {"name": f.name, "severity": f.severity,
                 "affected_claim": f.affected_claim_id, "explanation": f.explanation}
                for f in result.fallacies
            ],
            "fact_checks": [
                {"claim_id": fc.claim_id, "verdict": fc.verdict,
                 "confidence": fc.confidence, "explanation": fc.explanation,
                 "sources": fc.sources}
                for fc in result.fact_checks
            ],
            "epistemic_score": result.epistemic_score.model_dump(),
            "content_preview": request.content[:300],
        })
        record = AnalysisRecord(
            id=result.id,
            org_id=request.org_id,
            user_id="anonymous",
            job_id=result.id,
            content_type=request.content_type.value,
            content_preview=request.content[:120] if request.content else "",
            claim_count=len(result.claim_tree.claims),
            fallacy_count=len(result.fallacies),
            overall_score=result.epistemic_score.overall_score,
            evidence_score=result.epistemic_score.evidence_score,
            logic_score=result.epistemic_score.logic_score,
            full_result=full_result_json,
            status="complete",
            completed_at=datetime.utcnow(),
        )
        db.add(record)
        db.commit()
        logger.info(f"SQLite: saved analysis {result.id} for org {request.org_id}")
    except Exception as e:
        logger.error(f"SQLite save failed: {e}")
        db.rollback()
    finally:
        db.close()

    # 2 — Pinecone (semantic search)
    try:
        claims_text = " ".join([c.text for c in result.claim_tree.claims])
        upsert_analysis(
            analysis_id=result.id,
            org_id=request.org_id,
            user_id="anonymous",
            text=request.content[:500],
            metadata={
                "overall_score": str(result.epistemic_score.overall_score),
                "fallacy_count": str(len(result.fallacies)),
                "claim_count": str(len(result.claim_tree.claims)),
            }
        )
    except Exception as e:
        logger.error(f"Pinecone save failed: {e}")

    # 3 — Neo4j (knowledge graph)
    try:
        knowledge_graph.store_analysis(result, request.org_id)
    except Exception as e:
        logger.error(f"Neo4j save failed: {e}")


@router.post("/ingest/text")
async def ingest_text(request: AnalysisRequest):
    try:
        claim_tree = ingestion_agent.run(content=request.content, content_type=ContentType.TEXT)
        return {
            "status": "success",
            "source_type": claim_tree.source_type,
            "claim_count": len(claim_tree.claims),
            "claims": [c.model_dump() for c in claim_tree.claims],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Analysis failed. This may be due to a temporary issue with the AI service. Please try again."
        )


@router.post("/ingest/url")
async def ingest_url(url: str):
    try:
        claim_tree = ingestion_agent.run(content=url, content_type=ContentType.URL)
        return {
            "status": "success",
            "source_type": claim_tree.source_type,
            "claim_count": len(claim_tree.claims),
            "claims": [c.model_dump() for c in claim_tree.claims],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Analysis failed. This may be due to a temporary issue with the AI service. Please try again."
        )


@router.post("/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    try:
        pdf_bytes = await file.read()
        claim_tree = ingestion_agent.run(content=pdf_bytes, content_type=ContentType.PDF)
        return {
            "status": "success",
            "source_type": claim_tree.source_type,
            "filename": file.filename,
            "claim_count": len(claim_tree.claims),
            "claims": [c.model_dump() for c in claim_tree.claims],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Analysis failed. This may be due to a temporary issue with the AI service. Please try again."
        )


@router.post("/analyze")
async def analyze(request: AnalysisRequest):
    # Input validation
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    if len(request.content) > 50000:
        raise HTTPException(status_code=400, detail="Content too long. Maximum is 50,000 characters.")
    if len(request.content.strip()) < 10:
        raise HTTPException(status_code=400, detail="Content too short to analyze. Please provide at least a sentence.")

    try:
        import asyncio
        loop = asyncio.get_event_loop()
        # Run analysis with 120 second timeout
        try:
            claim_tree = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: ingestion_agent.run(
                    content=request.content,
                    content_type=request.content_type,
                )),
                timeout=120.0
            )
            result = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: run_full_analysis(claim_tree)),
                timeout=120.0
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=408,
                detail="Analysis timed out after 120 seconds. Try with shorter content."
            )
        save_analysis_record(result, request)
        return {
            "status": result.status,
            "analysis_id": result.id,
            "claim_count": len(result.claim_tree.claims),
            "argument_graph": {
                "nodes": [n.model_dump() for n in result.argument_graph.nodes],
                "edges": [e.model_dump() for e in result.argument_graph.edges],
            },
            "fallacies": [
                {
                    "name": f.name,
                    "severity": f.severity,
                    "affected_claim": f.affected_claim_id,
                    "explanation": f.explanation,
                }
                for f in result.fallacies
            ],
            "fact_checks": [
                {
                    "claim_id": fc.claim_id,
                    "verdict": fc.verdict,
                    "confidence": fc.confidence,
                    "explanation": fc.explanation,
                    "sources": fc.sources,
                }
                for fc in result.fact_checks
            ],
            "epistemic_score": result.epistemic_score.model_dump(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Analysis failed. This may be due to a temporary issue with the AI service. Please try again."
        )


@router.post("/analyze/async")
async def analyze_async(request: AnalysisRequest):
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
    try:
        task_result = AsyncResult(job_id, app=celery_app)
        state = task_result.state
        if state == "PENDING":
            return {"job_id": job_id, "status": "pending", "progress": 0}
        elif state == "PROGRESS":
            meta = task_result.info or {}
            return {"job_id": job_id, "status": "processing", "step": meta.get("step"), "progress": meta.get("progress", 0)}
        elif state == "SUCCESS":
            return {"job_id": job_id, "status": "complete", "progress": 100, "result": task_result.result}
        elif state == "FAILURE":
            return {"job_id": job_id, "status": "failed", "error": str(task_result.info)}
        else:
            return {"job_id": job_id, "status": state.lower()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Analysis failed. This may be due to a temporary issue with the AI service. Please try again."
        )


@router.get("/jobs")
async def list_jobs():
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


@router.get("/analyses/similar")
async def find_similar(query: str, org_id: str = "default", top_k: int = 3):
    """Find semantically similar past analyses using Pinecone."""
    from services.pinecone_service import search_similar
    results = search_similar(query=query, org_id=org_id, top_k=top_k)
    return {"query": query, "similar_analyses": results}


@router.get("/reports/{analysis_id}")
async def get_public_report(analysis_id: str):
    """
    Public endpoint — no auth required.
    Returns full analysis result for shareable report page.
    """
    import json as _json
    db = SessionLocal()
    try:
        # Search by primary id first, then by job_id (LangGraph result id)
        record = db.query(AnalysisRecord).filter(
            AnalysisRecord.id == analysis_id
        ).first()
        if not record:
            record = db.query(AnalysisRecord).filter(
                AnalysisRecord.job_id == analysis_id
            ).first()
        if not record:
            raise HTTPException(status_code=404, detail=f"Report {analysis_id} not found. It may be from a previous session.")
        if not record.full_result:
            raise HTTPException(status_code=404, detail="Report exists but full data was not saved. Re-run the analysis.")
        result = _json.loads(record.full_result)
        return {
            "analysis_id": analysis_id,
            "created_at": record.created_at.isoformat(),
            "content_type": record.content_type,
            "overall_score": record.overall_score,
            "evidence_score": record.evidence_score,
            "logic_score": record.logic_score,
            **result,
        }
    finally:
        db.close()
