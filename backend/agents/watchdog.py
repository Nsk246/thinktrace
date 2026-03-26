from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from core.config import get_settings
from core.models import ContentType
import requests
import hashlib
import json
import re
import logging
from datetime import datetime
from typing import Optional
from bs4 import BeautifulSoup

settings = get_settings()
logger = logging.getLogger(__name__)

llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    api_key=settings.anthropic_api_key,
    max_tokens=1024,
)

CHANGE_DETECTION_PROMPT = """You are a content analyst. Compare the old and new versions of a webpage or document.

Determine:
- has_meaningful_change: true if the content has substantively changed (new arguments, new claims, new evidence) — false for minor edits, formatting, or ads
- change_summary: one sentence describing what changed
- should_reanalyze: true if the change is significant enough to warrant a full reasoning audit

Return ONLY valid JSON:
{
  "has_meaningful_change": true,
  "change_summary": "New section added arguing X with evidence Y",
  "should_reanalyze": true
}"""


class WatchedSource:
    def __init__(self, source_id: str, url: str, label: str, interval_minutes: int = 60):
        self.source_id = source_id
        self.url = url
        self.label = label
        self.interval_minutes = interval_minutes
        self.last_hash: Optional[str] = None
        self.last_content: Optional[str] = None
        self.last_checked: Optional[datetime] = None
        self.last_score: Optional[float] = None
        self.check_count: int = 0
        self.alerts: list = []


class WatchdogAgent:
    """
    Autonomous monitoring agent.
    Watches URLs on a schedule, detects content changes,
    and triggers full analysis pipeline when meaningful changes occur.
    """

    def __init__(self):
        self.sources: dict[str, WatchedSource] = {}
        self.scheduler = BackgroundScheduler()
        self.scheduler.start()
        self._analysis_callback = None
        logger.info("WatchdogAgent initialized")

    def set_analysis_callback(self, callback):
        """Set the function to call when analysis should be triggered."""
        self._analysis_callback = callback

    def add_source(
        self,
        source_id: str,
        url: str,
        label: str,
        interval_minutes: int = 60,
    ) -> WatchedSource:
        source = WatchedSource(source_id, url, label, interval_minutes)
        self.sources[source_id] = source

        # Schedule the check job
        self.scheduler.add_job(
            func=self._check_source,
            trigger=IntervalTrigger(minutes=interval_minutes),
            args=[source_id],
            id=f"watchdog_{source_id}",
            replace_existing=True,
            next_run_time=datetime.now(),
        )

        logger.info(f"Watchdog: added source '{label}' — checking every {interval_minutes}m")
        return source

    def remove_source(self, source_id: str) -> bool:
        if source_id not in self.sources:
            return False
        try:
            self.scheduler.remove_job(f"watchdog_{source_id}")
        except Exception:
            pass
        del self.sources[source_id]
        logger.info(f"Watchdog: removed source {source_id}")
        return True

    def _fetch_content(self, url: str) -> str:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/91.0.4472.124 Safari/537.36"
            )
        }
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        main = soup.find("main") or soup.find("article") or soup.find("body")
        text = main.get_text(separator="\n", strip=True) if main else soup.get_text()
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        return "\n".join(lines)[:8000]

    def _compute_hash(self, content: str) -> str:
        return hashlib.sha256(content.encode()).hexdigest()

    def _detect_meaningful_change(self, old_content: str, new_content: str) -> dict:
        try:
            messages = [
                SystemMessage(content=CHANGE_DETECTION_PROMPT),
                HumanMessage(content=(
                    f"OLD CONTENT (first 1500 chars):\n{old_content[:1500]}\n\n"
                    f"NEW CONTENT (first 1500 chars):\n{new_content[:1500]}"
                )),
            ]
            response = llm.invoke(messages)
            raw = response.content.strip()
            raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"```$", "", raw, flags=re.MULTILINE)
            return json.loads(raw.strip())
        except Exception as e:
            logger.error(f"Change detection failed: {e}")
            return {
                "has_meaningful_change": True,
                "change_summary": "Could not determine change — flagging for review",
                "should_reanalyze": True,
            }

    def _check_source(self, source_id: str):
        if source_id not in self.sources:
            return

        source = self.sources[source_id]
        source.check_count += 1
        source.last_checked = datetime.utcnow()

        logger.info(f"Watchdog: checking '{source.label}' (check #{source.check_count})")

        try:
            new_content = self._fetch_content(source.url)
            new_hash = self._compute_hash(new_content)

            # First check — just store baseline
            if source.last_hash is None:
                source.last_hash = new_hash
                source.last_content = new_content
                logger.info(f"Watchdog: baseline set for '{source.label}'")
                # Trigger initial analysis
                if self._analysis_callback:
                    self._analysis_callback(
                        source_id=source_id,
                        url=source.url,
                        label=source.label,
                        content=new_content,
                        change_summary="Initial analysis",
                        is_initial=True,
                    )
                return

            # Hash unchanged — no need to check further
            if new_hash == source.last_hash:
                logger.info(f"Watchdog: no change detected for '{source.label}'")
                return

            # Hash changed — check if meaningful
            change_result = self._detect_meaningful_change(
                source.last_content, new_content
            )

            alert = {
                "source_id": source_id,
                "label": source.label,
                "url": source.url,
                "detected_at": datetime.utcnow().isoformat(),
                "change_summary": change_result.get("change_summary", "Content changed"),
                "has_meaningful_change": change_result.get("has_meaningful_change", False),
                "should_reanalyze": change_result.get("should_reanalyze", False),
            }

            source.alerts.append(alert)
            source.last_hash = new_hash
            source.last_content = new_content

            logger.info(
                f"Watchdog: change detected for '{source.label}' — "
                f"meaningful={alert['has_meaningful_change']}"
            )

            # Trigger analysis if meaningful
            if alert["should_reanalyze"] and self._analysis_callback:
                self._analysis_callback(
                    source_id=source_id,
                    url=source.url,
                    label=source.label,
                    content=new_content,
                    change_summary=alert["change_summary"],
                    is_initial=False,
                )

        except Exception as e:
            logger.error(f"Watchdog: error checking '{source.label}': {e}")
            source.alerts.append({
                "source_id": source_id,
                "label": source.label,
                "detected_at": datetime.utcnow().isoformat(),
                "error": str(e),
            })

    def get_status(self) -> dict:
        return {
            "active_sources": len(self.sources),
            "sources": [
                {
                    "source_id": s.source_id,
                    "label": s.label,
                    "url": s.url,
                    "interval_minutes": s.interval_minutes,
                    "check_count": s.check_count,
                    "last_checked": s.last_checked.isoformat() if s.last_checked else None,
                    "last_score": s.last_score,
                    "alert_count": len(s.alerts),
                    "recent_alerts": s.alerts[-3:],
                }
                for s in self.sources.values()
            ],
        }

    def shutdown(self):
        self.scheduler.shutdown(wait=False)
        logger.info("Watchdog scheduler stopped")


watchdog = WatchdogAgent()
