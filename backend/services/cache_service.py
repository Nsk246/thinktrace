import hashlib
import json
import logging
from datetime import datetime, timedelta
from core.database import SessionLocal, AnalysisRecord

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 24


def get_content_hash(content: str, content_type: str) -> str:
    """Generate a stable hash for content + type combination."""
    normalized = content.strip().lower()
    return hashlib.sha256(f"{content_type}:{normalized}".encode()).hexdigest()


def get_cached_analysis(content: str, content_type: str) -> dict | None:
    """Check if we have a recent analysis for this exact content."""
    content_hash = get_content_hash(content, content_type)
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(hours=CACHE_TTL_HOURS)
        record = db.query(AnalysisRecord).filter(
            AnalysisRecord.content_hash == content_hash,
            AnalysisRecord.completed_at >= cutoff,
            AnalysisRecord.full_result.isnot(None),
        ).first()

        if record and record.full_result:
            logger.info(f"Cache HIT for hash {content_hash[:8]} — returning cached result")
            return json.loads(record.full_result)
        return None
    except Exception as e:
        logger.error(f"Cache lookup error: {e}")
        return None
    finally:
        db.close()


def should_use_cache(content: str) -> bool:
    """Only cache content over 50 chars — too short to be worth caching."""
    return len(content.strip()) > 50
