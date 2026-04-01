import logging
from core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
_index = None
_embedder = None


def get_embedder():
    """Load sentence-transformers model from local cache — no network calls."""
    global _embedder
    if _embedder is not None:
        return _embedder
    try:
        import os
        cache_dir = os.path.join(os.path.dirname(__file__), "..", "models")
        cache_dir = os.path.abspath(cache_dir)

        # Block ALL network calls from transformers/HuggingFace
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["HF_DATASETS_OFFLINE"] = "1"
        os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
        os.environ["DISABLE_TELEMETRY"] = "1"

        # Suppress verbose loading logs
        import logging
        logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
        logging.getLogger("transformers").setLevel(logging.WARNING)
        logging.getLogger("huggingface_hub").setLevel(logging.WARNING)

        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer(
            "all-MiniLM-L6-v2",
            cache_folder=cache_dir,
        )
        logger.info(f"Sentence transformer loaded from local cache: {cache_dir}")
        return _embedder
    except Exception as e:
        logger.warning(f"Sentence transformer unavailable: {e} — falling back to hash embeddings")
        return None


def embed_text(text: str) -> list[float]:
    """Generate real semantic embeddings, fall back to hash if unavailable."""
    embedder = get_embedder()
    if embedder:
        try:
            vec = embedder.encode(text[:512], normalize_embeddings=True).tolist()
            # Pad to 1536 dims if needed (for existing Pinecone index)
            if len(vec) < 1536:
                vec = vec + [0.0] * (1536 - len(vec))
            return vec[:1536]
        except Exception as e:
            logger.error(f"Embedding error: {e}")

    # Hash fallback
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


def upsert_analysis(analysis_id: str, org_id: str, user_id: str = "anonymous",
                    text: str = "", metadata: dict = None):
    if metadata is None:
        metadata = {}
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
            namespace=org_id,
        )
        logger.info(f"Pinecone: upserted {analysis_id} in namespace {org_id}")
        return True
    except Exception as e:
        logger.error(f"Pinecone upsert error: {e}")
        return False


def search_similar(query: str, org_id: str, user_id: str = None,
                   top_k: int = 3) -> list[dict]:
    index = get_index()
    if not index:
        return []
    try:
        vec = embed_text(query)
        filter_dict = {"org_id": {"$eq": org_id}}
        if user_id:
            filter_dict["user_id"] = {"$eq": user_id}
        results = index.query(
            vector=vec, top_k=top_k, namespace=org_id,
            include_metadata=True, filter=filter_dict,
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
    index = get_index()
    if not index:
        return False
    try:
        index.delete(delete_all=True, namespace=org_id)
        return True
    except Exception as e:
        logger.error(f"Pinecone delete error: {e}")
        return False


def get_org_stats(org_id: str) -> dict:
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
