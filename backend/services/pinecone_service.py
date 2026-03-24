import logging
from core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
_index = None


def get_index():
    global _index
    if _index is not None:
        return _index
    try:
        from pinecone import Pinecone
        pc = Pinecone(api_key=settings.pinecone_api_key)
        _index = pc.Index(settings.pinecone_index_name)
        logger.info("Pinecone connected")
        return _index
    except Exception as e:
        logger.warning(f"Pinecone unavailable: {e}")
        return None


def embed_text(text: str) -> list[float]:
    import hashlib, math
    hash_val = hashlib.sha256(text.encode()).digest()
    vec = []
    for i in range(192):
        byte_pair = hash_val[i % 32]
        angle = (byte_pair / 255.0) * 2 * math.pi * (i + 1)
        vec.extend([
            math.cos(angle) * 0.1, math.sin(angle) * 0.1,
            math.cos(angle * 2) * 0.05, math.sin(angle * 2) * 0.05,
            math.cos(angle * 0.5) * 0.15, math.sin(angle * 0.5) * 0.15,
            math.cos(angle * 3) * 0.08, math.sin(angle * 3) * 0.08,
        ])
    vec = vec[:1536]
    norm = sum(v * v for v in vec) ** 0.5
    return [v / norm for v in vec] if norm > 0 else vec


def upsert_analysis(analysis_id: str, org_id: str, user_id: str = "anonymous",
                    text: str = "", metadata: dict = {}):
    """
    Store analysis in Pinecone.
    Uses org_id as namespace for complete tenant isolation.
    Each org only ever sees its own vectors.
    """
    index = get_index()
    if not index:
        return False
    try:
        vec = embed_text(text)
        index.upsert(
            vectors=[{
                "id": f"{org_id}_{analysis_id}",
                "values": vec,
                "metadata": {
                    "org_id": org_id,
                    "user_id": user_id,
                    "analysis_id": analysis_id,
                    "text_preview": text[:500],
                    **{k: str(v) for k, v in metadata.items()},
                }
            }],
            namespace=org_id,  # strict org isolation
        )
        logger.info(f"Pinecone: upserted {analysis_id} in namespace {org_id}")
        return True
    except Exception as e:
        logger.error(f"Pinecone upsert error: {e}")
        return False


def search_similar(query: str, org_id: str, user_id: str = None,
                   top_k: int = 3) -> list[dict]:
    """
    Search within org namespace only — tenants cannot see each other's data.
    Optionally filter by user_id.
    """
    index = get_index()
    if not index:
        return []
    try:
        vec = embed_text(query)
        filter_dict = {"org_id": {"$eq": org_id}}
        if user_id:
            filter_dict["user_id"] = {"$eq": user_id}

        results = index.query(
            vector=vec,
            top_k=top_k,
            namespace=org_id,
            include_metadata=True,
            filter=filter_dict,
        )
        return [
            {
                "analysis_id": m.metadata.get("analysis_id", m.id),
                "score": round(m.score, 3),
                "preview": m.metadata.get("text_preview", "")[:200],
                "overall_score": m.metadata.get("overall_score", ""),
                "user_id": m.metadata.get("user_id", ""),
            }
            for m in results.matches
        ]
    except Exception as e:
        logger.error(f"Pinecone search error: {e}")
        return []


def delete_org_data(org_id: str) -> bool:
    """Delete all vectors for an org (GDPR compliance / org deletion)."""
    index = get_index()
    if not index:
        return False
    try:
        index.delete(delete_all=True, namespace=org_id)
        logger.info(f"Pinecone: deleted all vectors for org {org_id}")
        return True
    except Exception as e:
        logger.error(f"Pinecone delete error: {e}")
        return False


def get_org_stats(org_id: str) -> dict:
    """Get vector count for a specific org namespace."""
    index = get_index()
    if not index:
        return {"connected": False}
    try:
        stats = index.describe_index_stats()
        ns = stats.namespaces.get(org_id, {})
        return {
            "connected": True,
            "org_vectors": getattr(ns, "vector_count", 0),
            "total_vectors": stats.total_vector_count,
        }
    except Exception as e:
        return {"connected": False, "error": str(e)}
