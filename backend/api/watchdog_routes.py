from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agents.watchdog import watchdog
from services.tasks import run_analysis_task
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/watchdog", tags=["watchdog"])


class AddSourceRequest(BaseModel):
    source_id: str
    url: str
    label: str
    interval_minutes: int = 60


def analysis_triggered_callback(
    source_id: str,
    url: str,
    label: str,
    content: str,
    change_summary: str,
    is_initial: bool,
):
    """Called by watchdog when a source needs re-analysis."""
    logger.info(
        f"Watchdog callback: queuing analysis for '{label}' "
        f"({'initial' if is_initial else 'change detected'})"
    )
    try:
        task = run_analysis_task.apply_async(
            args=[content, "text", f"watchdog_{source_id}"],
            queue="analysis",
        )
        logger.info(f"Watchdog: queued task {task.id} for '{label}'")
    except Exception as e:
        logger.error(f"Watchdog callback failed to queue task: {e}")


watchdog.set_analysis_callback(analysis_triggered_callback)


@router.post("/sources")
async def add_source(request: AddSourceRequest, current_user: User = Depends(get_current_user)):
    """Add a URL to the watchdog monitoring list."""
    try:
        source = watchdog.add_source(
            source_id=request.source_id,
            url=request.url,
            label=request.label,
            interval_minutes=request.interval_minutes,
        )
        return {
            "status": "watching",
            "source_id": source.source_id,
            "label": source.label,
            "url": source.url,
            "interval_minutes": source.interval_minutes,
            "message": f"Now monitoring '{source.label}' every {source.interval_minutes} minutes",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sources/{source_id}")
async def remove_source(source_id: str, current_user: User = Depends(get_current_user)):
    """Stop monitoring a source."""
    removed = watchdog.remove_source(source_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Source {source_id} not found")
    return {"status": "removed", "source_id": source_id}


@router.get("/sources")
async def list_sources(current_user: User = Depends(get_current_user)):
    """Get all monitored sources and their status."""
    return watchdog.get_status()


@router.get("/sources/{source_id}/alerts")
async def get_alerts(source_id: str, current_user: User = Depends(get_current_user)):
    """Get all alerts for a specific source."""
    if source_id not in watchdog.sources:
        raise HTTPException(status_code=404, detail=f"Source {source_id} not found")
    source = watchdog.sources[source_id]
    return {
        "source_id": source_id,
        "label": source.label,
        "alert_count": len(source.alerts),
        "alerts": source.alerts,
    }


@router.post("/sources/{source_id}/check-now")
async def check_now(source_id: str, current_user: User = Depends(get_current_user)):
    """Manually trigger an immediate check for a source."""
    if source_id not in watchdog.sources:
        raise HTTPException(status_code=404, detail=f"Source {source_id} not found")
    try:
        watchdog._check_source(source_id)
        return {
            "status": "checked",
            "source_id": source_id,
            "message": "Manual check triggered successfully",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
