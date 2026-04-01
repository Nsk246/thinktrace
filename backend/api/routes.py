from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from agents.ingestion import IngestionAgent
from core.models import AnalysisRequest, ContentType
from core.graph import run_full_analysis
from core.database import SessionLocal, AnalysisRecord
from core.config import get_settings
from celery.result import AsyncResult
from services.celery_app import celery_app
from datetime import datetime
import logging

settings = get_settings()

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
        from services.cache_service import get_content_hash
        record = AnalysisRecord(
            id=result.id,
            org_id=request.org_id,
            user_id="anonymous",
            job_id=result.id,
            content_hash=get_content_hash(request.content, request.content_type.value),
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

    # Check cache first
    from services.cache_service import get_cached_analysis, should_use_cache
    if should_use_cache(request.content):
        cached = get_cached_analysis(request.content, request.content_type.value)
        if cached:
            cached["cached"] = True
            return cached

    # Rate limit per org — 10 analyses per month on free tier
    if request.org_id and request.org_id != "default":
        try:
            import redis as redis_lib, ssl, calendar
            from datetime import datetime
            r = redis_lib.from_url(
                settings.redis_url,
                decode_responses=True,
                ssl_cert_reqs=ssl.CERT_NONE,
                socket_connect_timeout=2,
            )
            month_key = f"usage:{request.org_id}:{datetime.utcnow().strftime('%Y-%m')}"
            count = int(r.get(month_key) or 0)
            if count >= 50:
                raise HTTPException(
                    status_code=429,
                    detail=f"Monthly limit reached. Your workspace has used 50 analyses this month. Limit resets on the 1st."
                )
            r.incr(month_key)
            # Expire at end of month
            now = datetime.utcnow()
            days_in_month = calendar.monthrange(now.year, now.month)[1]
            seconds_left = (days_in_month - now.day) * 86400 + (86400 - now.hour * 3600)
            r.expire(month_key, seconds_left)
        except HTTPException:
            raise
        except Exception:
            pass  # If Redis is down, allow the request

    try:
        import asyncio
        loop = asyncio.get_event_loop()
        claim_tree = await loop.run_in_executor(None, lambda: ingestion_agent.run(
            content=request.content,
            content_type=request.content_type,
        ))
        result = await loop.run_in_executor(None, lambda: run_full_analysis(claim_tree))
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


class CompareRequest(BaseModel):
    content_a: str
    content_b: str
    label_a: str = "Argument A"
    label_b: str = "Argument B"


@router.post("/compare")
async def compare_arguments(request: CompareRequest):
    """Compare two arguments and return a structured comparison."""
    content_a = request.content_a
    content_b = request.content_b
    label_a = request.label_a
    label_b = request.label_b
    from langchain_anthropic import ChatAnthropic
    from langchain_core.messages import HumanMessage, SystemMessage
    from core.config import get_settings
    import asyncio

    settings = get_settings()
    llm = ChatAnthropic(
        model="claude-sonnet-4-20250514",
        api_key=settings.anthropic_api_key,
        max_tokens=1500,
    )

    if len(request.content_a) > 10000 or len(request.content_b) > 10000:
        raise HTTPException(status_code=400, detail="Each argument must be under 10,000 characters for comparison.")

    # Run both analyses in parallel
    loop = asyncio.get_event_loop()
    try:
        request_a = AnalysisRequest(content=content_a, content_type=ContentType.TEXT, org_id="compare")
        request_b = AnalysisRequest(content=content_b, content_type=ContentType.TEXT, org_id="compare")

        future_a = loop.run_in_executor(None, lambda: _run_analysis(request_a))
        future_b = loop.run_in_executor(None, lambda: _run_analysis(request_b))

        result_a, result_b = await asyncio.gather(
            asyncio.wrap_future(future_a),
            asyncio.wrap_future(future_b),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    # Comparator agent
    comparison_prompt = f"""Compare these two arguments and provide a structured assessment.

{label_a}:
{content_a[:1000]}
Score: {result_a["epistemic_score"]["overall_score"]}
Fallacies: {len(result_a["fallacies"])}
Verdict: {result_a["epistemic_score"]["summary"]}

{label_b}:
{content_b[:1000]}
Score: {result_b["epistemic_score"]["overall_score"]}
Fallacies: {len(result_b["fallacies"])}
Verdict: {result_b["epistemic_score"]["summary"]}

Return ONLY valid JSON:
{{
  "winner": "{label_a}|{label_b}|tie",
  "winner_reasoning": "2 sentences explaining why",
  "evidence_comparison": "1 sentence comparing evidence quality",
  "logic_comparison": "1 sentence comparing logical structure",
  "fallacy_comparison": "1 sentence comparing fallacy severity",
  "key_differences": ["difference 1", "difference 2", "difference 3"]
}}"""

    try:
        response = llm.invoke([HumanMessage(content=comparison_prompt)])
        import re, json
        raw = response.content.strip()
        raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE).strip()
        raw = re.sub(r"```$", "", raw, flags=re.MULTILINE).strip()
        comparison = json.loads(raw)
    except Exception as e:
        comparison = {
            "winner": "tie",
            "winner_reasoning": "Comparison analysis unavailable.",
            "evidence_comparison": "",
            "logic_comparison": "",
            "fallacy_comparison": "",
            "key_differences": [],
        }

    return {
        "label_a": label_a,
        "label_b": label_b,
        "result_a": result_a,
        "result_b": result_b,
        "comparison": comparison,
    }


def _run_analysis(request: AnalysisRequest) -> dict:
    """Helper to run a full analysis and return serializable result."""
    claim_tree = ingestion_agent.run(
        content=request.content,
        content_type=request.content_type,
    )
    result = run_full_analysis(claim_tree)
    return {
        "analysis_id": result.id,
        "claim_count": len(result.claim_tree.claims),
        "argument_graph": {
            "nodes": [n.model_dump() for n in result.argument_graph.nodes],
            "edges": [e.model_dump() for e in result.argument_graph.edges],
        },
        "fallacies": [
            {"name": f.name, "severity": f.severity,
             "confidence": f.__dict__.get("confidence", 0.8),
             "explanation": f.explanation}
            for f in result.fallacies
        ],
        "fact_checks": [
            {"claim_id": fc.claim_id, "verdict": fc.verdict,
             "confidence": fc.confidence, "explanation": fc.explanation,
             "sources": fc.sources}
            for fc in result.fact_checks
        ],
        "epistemic_score": result.epistemic_score.model_dump(),
    }
