from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from core.config import get_settings
from core.models import ClaimTree, FactCheckResult, Claim
import requests
import json
import re
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    api_key=settings.anthropic_api_key,
    max_tokens=1024,
)

FACT_CHECK_PROMPT = """You are a rigorous fact-checker. You have been given a claim and evidence from multiple sources.

CONTEXT RULES:
- If is_author_claim is FALSE: verify whether the attribution is accurate (did X really say/believe this?)
- If is_author_claim is TRUE: verify whether the claim itself is factually accurate
- For encyclopedic content describing a fringe theory: verify if the description is accurate, not whether the theory is true
- Never mark something "contradicted" just because it describes a wrong belief accurately

Based on all the evidence, evaluate:
- verdict: "supported" | "contradicted" | "unverifiable" | "contested"
- confidence: 0.0 to 1.0
- sources: list of up to 3 source names or URLs
- explanation: 2-3 sentences in context of whether this is an author claim or attribution

Return ONLY valid JSON:
{
  "verdict": "supported|contradicted|unverifiable|contested",
  "confidence": 0.85,
  "sources": ["source1", "source2"],
  "explanation": "Your explanation here"
}"""


def search_wikipedia(query: str) -> str:
    try:
        resp = requests.get(
            "https://en.wikipedia.org/api/rest_v1/page/summary/" + requests.utils.quote(query),
            timeout=8,
            headers={"User-Agent": "ThinkTrace/1.0 (research tool)"}
        )
        if resp.status_code == 200:
            data = resp.json()
            return f"Wikipedia: {data.get('extract', '')[:600]}"
    except Exception as e:
        logger.debug(f"Wikipedia error: {e}")
    return ""


def search_wikipedia_general(query: str) -> str:
    try:
        resp = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "format": "json",
                "srlimit": 2,
            },
            timeout=8,
            headers={"User-Agent": "ThinkTrace/1.0"}
        )
        if resp.status_code == 200:
            results = resp.json().get("query", {}).get("search", [])
            if results:
                snippets = [r.get("snippet", "").replace("<span class=\'searchmatch\'>", "").replace("</span>", "") for r in results[:2]]
                return "Wikipedia search: " + " | ".join(snippets)
    except Exception as e:
        logger.debug(f"Wikipedia search error: {e}")
    return ""


def search_serper(query: str) -> str:
    if not settings.serper_api_key:
        return ""
    try:
        resp = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": settings.serper_api_key, "Content-Type": "application/json"},
            json={"q": query, "num": 5},
            timeout=8,
        )
        if resp.status_code == 200:
            data = resp.json()
            organic = data.get("organic", [])
            snippets = [f"{r.get('title','')} — {r.get('snippet','')}" for r in organic[:4]]
            return "Google Search: " + " | ".join(snippets)
    except Exception as e:
        logger.debug(f"Serper error: {e}")
    return ""


def search_arxiv(query: str) -> str:
    try:
        resp = requests.get(
            "http://export.arxiv.org/api/query",
            params={"search_query": f"all:{query}", "max_results": 3, "sortBy": "relevance"},
            timeout=10,
        )
        if resp.status_code == 200:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(resp.text)
            ns = "{http://www.w3.org/2005/Atom}"
            entries = root.findall(f"{ns}entry")
            results = []
            for e in entries[:3]:
                title = e.find(f"{ns}title")
                summary = e.find(f"{ns}summary")
                if title is not None and summary is not None:
                    results.append(f"{title.text.strip()}: {summary.text.strip()[:200]}")
            if results:
                return "ArXiv papers: " + " | ".join(results)
    except Exception as e:
        logger.debug(f"ArXiv error: {e}")
    return ""


def search_pubmed(query: str) -> str:
    try:
        search_resp = requests.get(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
            params={"db": "pubmed", "term": query, "retmax": 3, "format": "json"},
            timeout=8,
        )
        if search_resp.status_code != 200:
            return ""
        ids = search_resp.json().get("esearchresult", {}).get("idlist", [])
        if not ids:
            return ""
        fetch_resp = requests.get(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
            params={"db": "pubmed", "id": ",".join(ids), "format": "json"},
            timeout=8,
        )
        if fetch_resp.status_code == 200:
            result_data = fetch_resp.json().get("result", {})
            titles = [result_data[uid].get("title", "") for uid in ids if uid in result_data]
            if titles:
                return "PubMed: " + " | ".join(titles[:3])
    except Exception as e:
        logger.debug(f"PubMed error: {e}")
    return ""


def search_news(query: str) -> str:
    if not settings.news_api_key:
        return ""
    try:
        resp = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": query,
                "apiKey": settings.news_api_key,
                "pageSize": 3,
                "sortBy": "relevancy",
                "language": "en",
            },
            timeout=8,
        )
        if resp.status_code == 200:
            articles = resp.json().get("articles", [])
            results = [f"{a.get('source',{}).get('name','')} — {a.get('title','')}" for a in articles[:3]]
            if results:
                return "News: " + " | ".join(results)
    except Exception as e:
        logger.debug(f"NewsAPI error: {e}")
    return ""


def route_sources(claim: Claim) -> list:
    """Decide which sources to query based on claim content."""
    text = claim.text.lower()

    is_scientific = any(w in text for w in [
        "study", "research", "evidence", "percent", "%", "found", "shows",
        "proven", "scientist", "published", "journal", "trial", "data",
        "statistic", "survey", "experiment"
    ])

    is_medical = any(w in text for w in [
        "vaccine", "drug", "disease", "health", "medical", "cancer",
        "virus", "bacteria", "treatment", "cure", "symptom", "patient",
        "hospital", "doctor", "fda", "who", "cdc"
    ])

    is_current_events = any(w in text for w in [
        "president", "government", "election", "war", "policy", "law",
        "congress", "senate", "minister", "country", "nation", "military",
        "economy", "stock", "company", "ceo", "billion", "million"
    ])

    sources = ["wikipedia", "serper"]

    if is_scientific:
        sources.append("arxiv")
    if is_medical:
        sources.append("pubmed")
    if is_current_events:
        sources.append("news")

    return list(set(sources))


def gather_evidence(claim: Claim) -> tuple[str, list]:
    """Gather evidence from multiple sources based on claim type."""
    sources_to_use = route_sources(claim)
    query = claim.text[:150]
    evidence_parts = []
    source_names = []

    logger.info(f"Fact checking: {query[:60]}... using sources: {sources_to_use}")

    if "serper" in sources_to_use:
        result = search_serper(query)
        if result:
            evidence_parts.append(result)
            source_names.append("Google Search")

    if "wikipedia" in sources_to_use:
        result = search_wikipedia(query[:60]) or search_wikipedia_general(query[:80])
        if result:
            evidence_parts.append(result)
            source_names.append("Wikipedia")

    if "arxiv" in sources_to_use:
        result = search_arxiv(query[:100])
        if result:
            evidence_parts.append(result)
            source_names.append("ArXiv")

    if "pubmed" in sources_to_use:
        result = search_pubmed(query[:100])
        if result:
            evidence_parts.append(result)
            source_names.append("PubMed")

    if "news" in sources_to_use:
        result = search_news(query[:100])
        if result:
            evidence_parts.append(result)
            source_names.append("NewsAPI")

    combined = "\n\n".join(evidence_parts) if evidence_parts else "No evidence found from any source."
    return combined, source_names


def classify_claim_checkability(text: str) -> str:
    """Classify whether a claim is factual, opinion, prediction, or ambiguous."""
    text_lower = text.lower()

    opinion_signals = [
        "should", "must", "need to", "have to", "ought to",
        "is destroying", "is bad", "is good", "is wrong", "is right",
        "better", "worse", "best", "worst", "dangerous", "important",
        "anyone who", "naive", "obvious", "clearly wrong",
    ]
    prediction_signals = [
        "will", "going to", "soon", "in the future", "eventually",
        "by 2030", "within years", "could lead to", "may cause",
    ]

    opinion_count = sum(1 for s in opinion_signals if s in text_lower)
    prediction_count = sum(1 for s in prediction_signals if s in text_lower)

    if opinion_count >= 2:
        return "opinion"
    if prediction_count >= 2:
        return "prediction"
    if opinion_count >= 1 and len(text.split()) < 10:
        return "opinion"
    return "factual"


def fact_check_single_claim(claim: Claim) -> FactCheckResult:
    # Skip non-checkable claim types
    if claim.claim_type in ("conclusion", "background"):
        checkability = classify_claim_checkability(claim.text)
        if checkability == "opinion":
            return FactCheckResult(
                claim_id=claim.id,
                verdict="unverifiable",
                confidence=0.9,
                sources=[],
                explanation="This is a value judgment or opinion — it cannot be fact checked as true or false.",
            )
        return FactCheckResult(
            claim_id=claim.id,
            verdict="unverifiable",
            confidence=0.5,
            sources=[],
            explanation="This is a conclusion — direct fact checking is not applicable.",
        )

    # Check if the claim is an opinion or prediction before searching
    checkability = classify_claim_checkability(claim.text)
    if checkability == "opinion":
        return FactCheckResult(
            claim_id=claim.id,
            verdict="unverifiable",
            confidence=0.9,
            sources=[],
            explanation="This is a value judgment or opinion rather than a verifiable factual claim.",
        )
    if checkability == "prediction":
        return FactCheckResult(
            claim_id=claim.id,
            verdict="contested",
            confidence=0.4,
            sources=[],
            explanation="This is a prediction about future events — it can be assessed against expert consensus but not verified as fact.",
        )

    is_author_claim = claim.__dict__.get("is_author_claim", True)
    attributed_to = claim.__dict__.get("attributed_to", None)

    evidence, source_names = gather_evidence(claim)

    # Build context-aware prompt
    if not is_author_claim and attributed_to:
        check_instruction = f"This claim is attributed to {attributed_to}. Verify: did {attributed_to} actually hold or express this view?"
    elif not is_author_claim:
        check_instruction = "This claim is reported/attributed — verify whether the attribution is accurate."
    else:
        check_instruction = "This is the author's own claim. Verify whether it is factually accurate."

    messages = [
        SystemMessage(content=FACT_CHECK_PROMPT),
        HumanMessage(content=(
            f"Context: {check_instruction}\n"
            f"is_author_claim: {is_author_claim}\n"
            f"Claim: {claim.text}\n\n"
            f"Evidence from {len(source_names)} sources ({', '.join(source_names)}):\n{evidence}"
        )),
    ]

    try:
        response = llm.invoke(messages)
        raw = response.content.strip()
        raw = re.sub(r"^```(?:json)?", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"```$", "", raw, flags=re.MULTILINE)
        parsed = json.loads(raw.strip())

        return FactCheckResult(
            claim_id=claim.id,
            verdict=parsed.get("verdict", "unverifiable"),
            confidence=parsed.get("confidence", 0.5),
            sources=parsed.get("sources", source_names[:3]),
            explanation=parsed.get("explanation", ""),
        )
    except Exception as e:
        logger.error(f"Fact check LLM error: {e}")
        return FactCheckResult(
            claim_id=claim.id,
            verdict="unverifiable",
            confidence=0.3,
            sources=source_names,
            explanation=f"Evidence was gathered but analysis failed: {str(e)}",
        )


class FactCheckerAgent:
    def run(self, claim_tree: ClaimTree) -> list[FactCheckResult]:
        checkable = [
            c for c in claim_tree.claims
            if c.claim_type in ("premise", "sub_claim")
        ][:6]  # Limit to 6 for speed

        if not checkable:
            return []

        # Run fact checks in parallel — major speed improvement
        from concurrent.futures import ThreadPoolExecutor, as_completed
        results = [None] * len(checkable)

        with ThreadPoolExecutor(max_workers=3) as executor:
            future_to_idx = {
                executor.submit(fact_check_single_claim, claim): i
                for i, claim in enumerate(checkable)
            }
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                try:
                    result = future.result(timeout=25)
                    results[idx] = result
                    logger.info(f"Fact check result: {result.verdict} ({result.confidence:.0%}) — {checkable[idx].text[:50]}")
                except Exception as e:
                    logger.error(f"Fact check failed for claim {idx}: {e}")
                    results[idx] = FactCheckResult(
                        claim_id=checkable[idx].id,
                        verdict="unverifiable",
                        confidence=0.3,
                        sources=[],
                        explanation="Fact check timed out or failed.",
                    )

        return [r for r in results if r is not None]
