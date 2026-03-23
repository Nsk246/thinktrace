from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from pypdf import PdfReader
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi
import requests
import re
import json
import io
from typing import Union
from core.config import get_settings
from core.models import ClaimTree, Claim, ContentType

settings = get_settings()

llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    api_key=settings.anthropic_api_key,
    max_tokens=4096,
)

CLAIM_EXTRACTION_PROMPT = """You are an expert argument analyst. Your job is to extract all distinct claims from the text below.

For each claim identify:
- text: the exact claim as stated
- claim_type: one of "premise" | "conclusion" | "sub_claim"
- position: approximate character position in the original text (integer)
- confidence: how clearly it is stated as a claim (0.0 to 1.0)

Rules:
- A premise is a supporting fact or evidence offered to support a conclusion
- A conclusion is the main point the author is trying to prove
- A sub_claim is an intermediate claim that supports the conclusion but needs its own support
- Extract EVERY distinct claim, even implicit ones
- Ignore filler sentences, transitions, and purely rhetorical statements
- Return ONLY valid JSON, no explanation, no markdown

Return this exact JSON structure:
{
  "claims": [
    {
      "text": "...",
      "claim_type": "premise|conclusion|sub_claim",
      "position": 0,
      "confidence": 0.95
    }
  ]
}"""


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text.strip()


def extract_text_from_url(url: str) -> str:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/91.0.4472.124 Safari/537.36"
        )
    }
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    soup = BeautifulSoup(response.content, "html.parser")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    # Try to get main content first
    main = soup.find("main") or soup.find("article") or soup.find("body")
    text = main.get_text(separator="\n", strip=True) if main else soup.get_text()

    # Clean up whitespace
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def extract_youtube_id(url: str) -> str:
    patterns = [
        r"(?:v=|\/)([0-9A-Za-z_-]{11}).*",
        r"(?:embed\/)([0-9A-Za-z_-]{11})",
        r"(?:youtu\.be\/)([0-9A-Za-z_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(f"Could not extract YouTube video ID from URL: {url}")


def extract_text_from_youtube(url: str) -> str:
    video_id = extract_youtube_id(url)
    transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
    text = " ".join([entry["text"] for entry in transcript_list])
    return text.strip()


def clean_text(text: str) -> str:
    # Normalize whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    # Remove non-printable characters
    text = re.sub(r"[^\x20-\x7E\n]", "", text)
    return text.strip()


def extract_claims_with_llm(text: str) -> list[Claim]:
    # Truncate if too long (Claude handles ~150k tokens but we keep it fast)
    truncated = text[:12000] if len(text) > 12000 else text

    messages = [
        SystemMessage(content=CLAIM_EXTRACTION_PROMPT),
        HumanMessage(content=f"Extract all claims from this text:\n\n{truncated}"),
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()

    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"```$", "", raw, flags=re.MULTILINE)
    raw = raw.strip()

    parsed = json.loads(raw)
    claims = []
    for i, c in enumerate(parsed.get("claims", [])):
        claims.append(
            Claim(
                text=c["text"],
                claim_type=c.get("claim_type", "sub_claim"),
                position=c.get("position", i * 100),
                confidence=c.get("confidence", 0.8),
            )
        )
    return claims


class IngestionAgent:
    """
    Accepts any content type and returns a structured ClaimTree.
    Supports: raw text, PDF bytes, URL, YouTube URL
    """

    def run(
        self,
        content: Union[str, bytes],
        content_type: ContentType,
    ) -> ClaimTree:
        # Step 1: extract raw text based on content type
        if content_type == ContentType.TEXT:
            raw_text = content if isinstance(content, str) else content.decode("utf-8")

        elif content_type == ContentType.PDF:
            if isinstance(content, str):
                raise ValueError("PDF content must be bytes, not string")
            raw_text = extract_text_from_pdf(content)

        elif content_type == ContentType.URL:
            url = content if isinstance(content, str) else content.decode("utf-8")
            if "youtube.com" in url or "youtu.be" in url:
                raw_text = extract_text_from_youtube(url)
                content_type = ContentType.YOUTUBE
            else:
                raw_text = extract_text_from_url(url)

        elif content_type == ContentType.YOUTUBE:
            url = content if isinstance(content, str) else content.decode("utf-8")
            raw_text = extract_text_from_youtube(url)

        else:
            raise ValueError(f"Unsupported content type: {content_type}")

        if not raw_text or len(raw_text.strip()) < 20:
            raise ValueError("Could not extract meaningful text from the content")

        # Step 2: clean the text
        clean = clean_text(raw_text)

        # Step 3: extract claims using Claude
        claims = extract_claims_with_llm(clean)

        return ClaimTree(
            claims=claims,
            raw_text=clean,
            source_type=content_type,
        )
