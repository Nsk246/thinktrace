from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from core.config import get_settings
from core.models import Claim, ClaimTree, ContentType
import uuid
import json
import re
import logging
import httpx

logger = logging.getLogger(__name__)
settings = get_settings()

llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    api_key=settings.anthropic_api_key,
    max_tokens=2048,
)

CONTENT_TYPE_PROMPT = """Analyze this text and classify it. Return ONLY valid JSON.

DECISION TREE — follow in order:

1. Does the text read like Wikipedia, an encyclopedia, or a textbook? 
   Neutral tone, describes debates without taking sides, uses third-person?
   → "encyclopedic"

2. Does the text primarily describe what OTHER people believe, say, or claim?
   Uses "X believes", "according to Y", "some argue", "critics say"?
   → "reporting"

3. Does the text appear to be a scholarly paper, research analysis, or academic essay?
   Uses citations, examines evidence systematically, hedged language like "suggests", "indicates"?
   → "academic"

4. Does the text combine BOTH reporting/encyclopedic content AND the author's own direct argument?
   e.g. "Some say X, but I believe Y" or "Critics argue X, however the evidence shows Y therefore we must Z"
   → "mixed"

5. Does the text use strong emotional language, attack opponents, use rhetorical calls to action,
   AND is clearly trying to persuade the reader to adopt a position?
   e.g. "Anyone who disagrees is naive", "We MUST act now", "This is destroying our society"
   → "persuasive"

6. Everything else — author makes direct factual claims in a straightforward way
   → "direct_argument"

Also detect:
- "has_quotes": true if text contains direct quotes attributed to others
- "has_attribution": true if text uses phrases like "X believes", "according to Y", "some argue"
- "is_encyclopedic_style": true if it reads like Wikipedia or a textbook

Return JSON:
{
  "content_type": "direct_argument|reporting|encyclopedic|academic|persuasive|mixed",
  "has_quotes": true|false,
  "has_attribution": true|false,
  "is_encyclopedic_style": true|false,
  "reasoning": "one sentence explaining why"
}"""

EXTRACTION_PROMPT = """You are an expert argument analyst. Extract all distinct claims from the text.

ATTRIBUTION RULES — these are critical:
1. If a claim is attributed to someone else ("X believes...", "According to Y...", "Some argue..."), set is_author_claim to false and attributed_to to who holds the claim
2. If a claim is a direct quote from someone else, set is_author_claim to false
3. If the text is encyclopedic or journalistic, most claims will have is_author_claim = false
4. Only set is_author_claim = true when the author is personally asserting the claim
5. For mixed content, carefully distinguish which claims are the author's own

Claim types:
- "premise": A supporting fact, evidence, or verifiable factual claim — use this for most claims
- "conclusion": The main point being argued or the final recommendation
- "sub_claim": An intermediate claim that supports the conclusion
- "background": ONLY use for truly neutral scene-setting with no factual content (e.g. "this essay discusses X") — do NOT use for verifiable facts about people, events, or the world
- "attribution": A claim explicitly attributed to someone else using "X says/believes/claims"

CRITICAL: Factual statements like "X is the president of Y", "Z has a population of N", "A caused B" are PREMISES not background. Only use background for meta-commentary about the text itself.

Extract up to 10 most important claims. Return ONLY valid JSON:
{
  "claims": [
    {
      "id": "uuid",
      "text": "the claim text",
      "claim_type": "premise|conclusion|sub_claim|background|attribution",
      "is_author_claim": true|false,
      "attributed_to": "name or null",
      "confidence": 0.0-1.0,
      "position": 0
    }
  ]
}"""

FALLACY_PROMPT_TEMPLATE = """You are a logical fallacy expert.

Content context: {content_type_desc}

CRITICAL RULES:
- Only flag fallacies in claims where is_author_claim is TRUE
- For attributed claims (is_author_claim = false), only flag if the ATTRIBUTION ITSELF is misleading or the author is misrepresenting what was said
- For encyclopedic or reporting content, fallacies are rare — only flag if the text itself (not what it describes) contains flawed reasoning
- Never flag a fallacy just because the described belief is wrong — that is not a fallacy in the text

Analyze these claims for logical fallacies:
{claims_text}

Return ONLY valid JSON:
{{
  "fallacies": [
    {{
      "name": "fallacy name",
      "severity": "low|medium|high",
      "affected_claim_id": "claim id",
      "explanation": "why this is a fallacy in the author's own reasoning"
    }}
  ]
}}"""


def detect_content_type(text: str) -> dict:
    """Classify the type of content before extraction."""
    try:
        response = llm.invoke([
            SystemMessage(content=CONTENT_TYPE_PROMPT),
            HumanMessage(content=f"Classify this text:\n\n{text[:2000]}")
        ])
        raw = response.content.strip()
        raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE).strip()
        raw = re.sub(r"```$", "", raw, flags=re.MULTILINE).strip()
        result = json.loads(raw)
        logger.info(f"Content type detected: {result.get('content_type')} — {result.get('reasoning','')}")
        return result
    except Exception as e:
        logger.error(f"Content type detection failed: {e}")
        return {
            "content_type": "direct_argument",
            "has_quotes": False,
            "has_attribution": False,
            "is_encyclopedic_style": False,
        }


class IngestionAgent:
    def run(self, content, content_type: ContentType) -> ClaimTree:
        if content_type == ContentType.PDF:
            text = self._extract_pdf(content)
        elif content_type == ContentType.URL:
            text = self._extract_url(content)
        else:
            text = content if isinstance(content, str) else content.decode("utf-8")

        # Step 1 — detect content type for context-aware analysis
        content_meta = detect_content_type(text)

        # Step 2 — extract claims with attribution metadata
        claims = self._extract_claims(text, content_meta)

        tree = ClaimTree(
            claims=claims,
            raw_text=text[:500],
            source_type=content_type,
        )
        # Store content metadata on the tree for downstream agents
        tree.__dict__["content_meta"] = content_meta
        return tree

    def _extract_claims(self, text: str, content_meta: dict) -> list[Claim]:
        context_hint = ""
        ct = content_meta.get("content_type", "direct_argument")
        if ct in ("encyclopedic", "reporting"):
            context_hint = f"\nNote: This is {ct} content. Most claims will be attributed to others, not the author."
        elif ct == "mixed":
            context_hint = "\nNote: This is mixed content. Carefully distinguish the author's own claims from reported ones."

        try:
            response = llm.invoke([
                SystemMessage(content=EXTRACTION_PROMPT + context_hint),
                HumanMessage(content=f"Extract claims from:\n\n{text[:4000]}")
            ])
            raw = response.content.strip()
            raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE).strip()
            raw = re.sub(r"```$", "", raw, flags=re.MULTILINE).strip()
            parsed = json.loads(raw)

            claims = []
            for i, c in enumerate(parsed.get("claims", [])[:10]):
                claim = Claim(
                    id=c.get("id", str(uuid.uuid4())),
                    text=c.get("text", ""),
                    claim_type=c.get("claim_type", "premise"),
                    confidence=c.get("confidence", 0.8),
                    position=i,
                )
                # Store attribution metadata
                claim.__dict__["is_author_claim"] = c.get("is_author_claim", True)
                claim.__dict__["attributed_to"] = c.get("attributed_to", None)
                claims.append(claim)

            logger.info(f"Extracted {len(claims)} claims ({sum(1 for c in claims if c.__dict__.get('is_author_claim', True))} author claims)")
            return claims

        except Exception as e:
            logger.error(f"Claim extraction failed: {e}")
            return [Claim(id=str(uuid.uuid4()), text=text[:200], claim_type="premise", confidence=0.5, position=0)]

    def _extract_pdf(self, content: bytes) -> str:
        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(content))
            return " ".join(page.extract_text() or "" for page in reader.pages[:10])
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            return ""

    def _is_youtube_url(self, url: str) -> bool:
        return any(domain in url for domain in [
            "youtube.com/watch", "youtu.be/", "youtube.com/shorts/"
        ])

    def _extract_youtube(self, url: str) -> str:
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            import re

            # Extract video ID from various YouTube URL formats
            patterns = [
                r"(?:v=)([a-zA-Z0-9_-]{11})",
                r"youtu[.]be/([a-zA-Z0-9_-]{11})",
                r"shorts/([a-zA-Z0-9_-]{11})",
            ]
            video_id = None
            for pattern in patterns:
                match = re.search(pattern, url)
                if match:
                    video_id = match.group(1)
                    break

            if not video_id:
                logger.error(f"Could not extract YouTube video ID from: {url}")
                return self._extract_url_html(url)

            # New API: fetch_transcript is the main method in newer versions
            try:
                yt = YouTubeTranscriptApi()
                fetched = yt.fetch(video_id)
                transcript_list = fetched.snippets
            except Exception:
                try:
                    # Fallback for older API versions
                    transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US", "en-GB"])
                except Exception as e2:
                    logger.error(f"YouTube transcript fetch failed: {e2}")
                    return self._extract_url_html(url)

            # Join transcript segments into clean text
            text = " ".join(
                seg.text if hasattr(seg, "text") else seg.get("text", "")
                for seg in transcript_list
            )
            text = re.sub(r"\[.*?\]", "", text)
            text = re.sub(r"\s+", " ", text).strip()

            if not text:
                return self._extract_url_html(url)

            logger.info(f"YouTube transcript extracted: {len(text)} chars from video {video_id}")
            return text[:6000]

        except Exception as e:
            logger.error(f"YouTube transcript extraction failed: {e} — falling back to HTML")
            return self._extract_url_html(url)

    def _extract_url_html(self, url: str) -> str:
        """Extract text from a regular webpage."""
        try:
            headers = {"User-Agent": "Mozilla/5.0 ThinkTrace/1.0"}
            resp = httpx.get(url, headers=headers, timeout=15, follow_redirects=True)
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            return " ".join(soup.get_text().split())[:5000]
        except Exception as e:
            logger.error(f"URL extraction failed: {e}")
            return url

    def _extract_url(self, url: str) -> str:
        """Route URL to appropriate extractor."""
        if self._is_youtube_url(url):
            logger.info(f"YouTube URL detected — extracting transcript")
            return self._extract_youtube(url)
        return self._extract_url_html(url)
