"""
MedBridge — Agentic RAG for drug lookup.

Semantic retrieval pipeline:
  1. Embed query (drug name + patient context) via sentence-transformers
  2. pgvector cosine similarity search against drug_knowledge table
  3. Return top-k chunks with source citations for grounded LLM reasoning

No external API required — sentence-transformers runs locally (all-MiniLM-L6-v2, ~80MB).
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger("medbridge.rag")

# ---------------------------------------------------------------------------
# Lazy-load sentence-transformers to avoid slow import at startup
# ---------------------------------------------------------------------------
_embedder = None

def _get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("RAG: sentence-transformers model loaded (all-MiniLM-L6-v2)")
        except ImportError:
            logger.error("RAG: sentence-transformers not installed. Run: pip install sentence-transformers")
            _embedder = None
    return _embedder


def embed_text(text: str) -> Optional[list[float]]:
    """Embed text using all-MiniLM-L6-v2 (384 dims). Returns None if embedder unavailable."""
    embedder = _get_embedder()
    if embedder is None:
        return None
    try:
        vector = embedder.encode(text, normalize_embeddings=True)
        return vector.tolist()
    except Exception as exc:
        logger.error(f"RAG: embed_text failed: {exc}")
        return None


def retrieve_drug_context(
    drug_name: str,
    patient_meds: Optional[list[str]] = None,
    top_k: int = 5,
) -> list[dict]:
    """
    Retrieve top-k relevant drug knowledge chunks for a given drug query.

    Constructs a rich query that includes:
    - The drug being looked up
    - The patient's current medication list (for interaction detection)

    Returns a list of dicts: [{drug_name, chunk_text, chunk_type, source, similarity}]
    Returns [] if pgvector is unavailable or embedding fails — callers should fall back to parametric LLM.
    """
    from app.config import supabase

    # Build a rich query string so semantic search can surface interaction-relevant chunks
    query_parts = [f"drug information for {drug_name}"]
    if patient_meds:
        meds_str = ", ".join(patient_meds[:10])  # cap to avoid embedding size issues
        query_parts.append(f"interactions with {meds_str}")
    query = " ".join(query_parts)

    embedding = embed_text(query)
    if embedding is None:
        logger.warning("RAG: skipping retrieval — embedder unavailable")
        return []

    try:
        # pgvector cosine similarity search via Supabase RPC
        # The RPC function is defined below in the migration
        result = supabase.rpc(
            "match_drug_knowledge",
            {
                "query_embedding": embedding,
                "match_threshold": 0.3,
                "match_count": top_k,
            }
        ).execute()

        chunks = result.data or []
        logger.info(f"RAG: retrieved {len(chunks)} chunks for '{drug_name}'")
        return chunks

    except Exception as exc:
        logger.warning(f"RAG: pgvector retrieval failed (falling back to parametric): {exc}")
        return []


def format_rag_context(chunks: list[dict]) -> str:
    """
    Format retrieved chunks into a prompt-ready string with source citations.
    """
    if not chunks:
        return ""

    lines = ["Retrieved drug information (cite these sources in your answer):"]
    for i, chunk in enumerate(chunks, 1):
        source = chunk.get("source", "curated_open_data")
        chunk_type = chunk.get("chunk_type", "general")
        text = chunk.get("chunk_text", "")
        lines.append(f"\n[Source {i} — {source} | {chunk_type}]\n{text}")

    return "\n".join(lines)
