from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from agents.ingestion import IngestionAgent
from core.models import AnalysisRequest, ContentType
import traceback

router = APIRouter(prefix="/api/v1", tags=["analysis"])
ingestion_agent = IngestionAgent()


@router.post("/ingest/text")
async def ingest_text(request: AnalysisRequest):
    """Ingest raw text and return a claim tree."""
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
            "raw_text_length": len(claim_tree.raw_text),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest/url")
async def ingest_url(url: str):
    """Ingest a URL or YouTube link and return a claim tree."""
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
            "raw_text_length": len(claim_tree.raw_text),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    """Ingest a PDF file and return a claim tree."""
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
            "raw_text_length": len(claim_tree.raw_text),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from core.graph import run_full_analysis


@router.post("/analyze")
async def analyze(request: AnalysisRequest):
    """
    Full ThinkTrace analysis pipeline:
    Ingest → Claim Extraction → Parallel Agents → Epistemic Score
    """
    try:
        # Step 1: ingest and extract claims
        claim_tree = ingestion_agent.run(
            content=request.content,
            content_type=request.content_type,
        )

        # Step 2: run all 4 agents via LangGraph
        result = run_full_analysis(claim_tree)

        return {
            "status": result.status,
            "analysis_id": result.id,
            "claim_count": len(result.claim_tree.claims),
            "argument_graph": {
                "nodes": len(result.argument_graph.nodes),
                "edges": len(result.argument_graph.edges),
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
            "epistemic_score": {
                "evidence_score": result.epistemic_score.evidence_score,
                "logic_score": result.epistemic_score.logic_score,
                "overall_score": result.epistemic_score.overall_score,
                "summary": result.epistemic_score.summary,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
