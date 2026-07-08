"""ChromaDB vector store for sector NLU training examples."""

from __future__ import annotations

import logging
import re
import threading
from typing import Any

import chromadb
from langchain_ollama import OllamaEmbeddings

from ..config import CHROMA_PATH, EMBED_MODEL, OLLAMA_BASE_URL
from ..knowledge.knowledge_registry import KnowledgeChunk, load_all_chunks

logger = logging.getLogger(__name__)

_client = chromadb.PersistentClient(path=CHROMA_PATH)
_embedder = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
_write_lock = threading.Lock()

COLLECTION_NAME = "nlu_knowledge"
_USER_INPUT_RE = re.compile(r"^User input:\s*(.+)$", re.M)

_NLU_SEGMENT_PREFIXES = (
    "general.sector.",
    "general.language.",
    "general.intent-taxonomy",
    "general.phase3",
    "general.phase4",
)


def get_collection():
    return _client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def chunk_embed_text(chunk: KnowledgeChunk) -> str:
    """Text to embed — prioritize user utterance over full chunk body."""
    content = chunk.content or ""
    m = _USER_INPUT_RE.search(content)
    user_input = m.group(1).strip() if m else ""
    title = (chunk.title or "").replace("…", "").strip()
    intent = str(chunk.metadata.get("intent") or "")
    sector = str(chunk.metadata.get("sector") or chunk.metadata.get("sector_slug") or "")
    parts = [user_input or title, intent, sector]
    return " | ".join(p for p in parts if p)


def _chunk_metadata(chunk: KnowledgeChunk) -> dict[str, str | int | float | bool]:
    meta = {
        "chunk_id": chunk.id,
        "segment": chunk.segment,
        "title": (chunk.title or "")[:200],
        "source": chunk.source or "",
        "intent": str(chunk.metadata.get("intent") or ""),
        "nlu_intent": str(chunk.metadata.get("nlu_intent") or ""),
        "sector_slug": str(chunk.metadata.get("sector_slug") or ""),
        "erp_action": str(chunk.metadata.get("erp_action") or "")[:200],
        "tags": ",".join(chunk.tags[:12]),
    }
    return {k: v for k, v in meta.items() if v != ""}


def is_nlu_chunk(chunk: KnowledgeChunk) -> bool:
    if chunk.id.startswith(("sector-", "phase3-", "phase4-")):
        return True
    return any(chunk.segment.startswith(p) for p in _NLU_SEGMENT_PREFIXES)


def ingest_nlu_knowledge(*, force: bool = False) -> dict[str, Any]:
    """Embed NLU-relevant knowledge chunks into Chroma."""
    collection = get_collection()
    existing = collection.count()
    if existing > 0 and not force:
        return {"status": "ready", "count": existing}

    chunks = [c for c in load_all_chunks() if is_nlu_chunk(c)]
    if not chunks:
        return {"status": "empty", "count": 0}

    if force and existing > 0:
        with _write_lock:
            _client.delete_collection(COLLECTION_NAME)
        collection = get_collection()

    batch_size = 40
    ingested = 0
    try:
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            texts = [chunk_embed_text(c) for c in batch]
            embeddings = _embedder.embed_documents(texts)
            with _write_lock:
                collection.upsert(
                    ids=[c.id for c in batch],
                    embeddings=embeddings,
                    documents=texts,
                    metadatas=[_chunk_metadata(c) for c in batch],
                )
            ingested += len(batch)
    except Exception as exc:
        logger.error("NLU knowledge ingest failed: %s", exc)
        return {"status": "error", "error": str(exc), "count": collection.count()}

    return {"status": "ingested", "count": collection.count(), "ingested": ingested}


def get_nlu_knowledge_count() -> int:
    try:
        return get_collection().count()
    except Exception:
        return 0


def search_nlu_embeddings(
    query: str,
    *,
    k: int = 12,
    sector_slug: str | None = None,
) -> list[dict[str, Any]]:
    """Semantic nearest-neighbor search over NLU examples."""
    try:
        collection = get_collection()
        if collection.count() == 0:
            return []

        vec = _embedder.embed_query(query)
        where = {"sector_slug": sector_slug} if sector_slug else None
        result = collection.query(
            query_embeddings=[vec],
            n_results=min(k, collection.count()),
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        docs = result.get("documents", [[]])[0]
        metas = result.get("metadatas", [[]])[0]
        dists = result.get("distances", [[]])[0]

        hits: list[dict[str, Any]] = []
        for doc, meta, dist in zip(docs, metas, dists):
            chunk_id = str(meta.get("chunk_id") or "")
            hits.append(
                {
                    "id": chunk_id,
                    "text": doc,
                    "distance": float(dist),
                    "metadata": dict(meta),
                    "semantic_score": 1.0 / (1.0 + float(dist)),
                }
            )
        return hits
    except Exception as exc:
        logger.warning("NLU embedding search failed: %s", exc)
        return []
