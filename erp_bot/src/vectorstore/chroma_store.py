"""All reads/writes against ChromaDB, using Ollama for embeddings."""

from __future__ import annotations

import threading

import chromadb
from langchain_ollama import OllamaEmbeddings

from ..config import CHROMA_PATH, EMBED_MODEL, OLLAMA_BASE_URL

_client = chromadb.PersistentClient(path=CHROMA_PATH)
_embedder = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
_write_lock = threading.Lock()

COLLECTION_NAME = "erp_codebase"


def get_collection():
    return _client.get_or_create_collection(COLLECTION_NAME)


def upsert_chunks(chunks: list) -> None:
    """Embed and upsert CodeChunk objects into ChromaDB."""
    valid = [c for c in chunks if c.text.strip()]
    if not valid:
        return

    collection = get_collection()
    batch_size = 50

    try:
        for i in range(0, len(valid), batch_size):
            batch = valid[i : i + batch_size]
            texts = [c.text for c in batch]
            embeddings = _embedder.embed_documents(texts)

            with _write_lock:
                collection.upsert(
                    ids=[c.metadata["chunk_id"] for c in batch],
                    embeddings=embeddings,
                    documents=texts,
                    metadatas=[c.metadata for c in batch],
                )
    except Exception as e:
        sources = {c.metadata.get("source", "?") for c in valid}
        print(f"[CHROMA ERROR] upsert failed for {sources}: {e}")


def delete_by_file(relative_source_path: str) -> None:
    try:
        collection = get_collection()
        with _write_lock:
            collection.delete(where={"source": relative_source_path})
    except Exception as e:
        print(f"[CHROMA ERROR] delete failed for {relative_source_path}: {e}")


def _compute_keyword_score(query: str, doc: dict) -> float:
    """Compute keyword overlap score between query and document.

    Returns a score based on how many query tokens (lowercased, length >= 3)
    appear in the document's source path, function_name, or text.
    """
    # Extract query tokens (lowercase, length >= 3)
    query_tokens = set(
        t.lower() for t in query.split()
        if len(t) >= 3 and t.isalnum()
    )
    if not query_tokens:
        return 0.0

    # Build searchable text from document metadata and content
    source = (doc.get("source") or "").lower()
    func_name = (doc.get("function_name") or "").lower()
    class_name = (doc.get("class_name") or "").lower()
    text = (doc.get("text") or "").lower()

    # Count token hits in source/function_name (high value) vs text (lower value)
    score = 0.0
    for token in query_tokens:
        # Source path matches are most valuable (exact file/folder names)
        if token in source:
            score += 3.0
        # Function/class name matches are also high value
        if token in func_name or token in class_name:
            score += 2.5
        # Text content matches have moderate value
        if token in text:
            score += 1.0

    return score


def search_codebase(query: str, k: int = 8) -> list[dict]:
    """Hybrid retrieval: semantic vector search + keyword overlap scoring.

    1. Fetch more candidates than needed (k*3) via semantic search.
    2. Compute keyword overlap score for each candidate.
    3. Combine: final_rank favors lower semantic distance and higher keyword score.
    4. Return top k results.
    """
    try:
        collection = get_collection()
        vec = _embedder.embed_query(query)

        # Fetch more candidates for hybrid re-ranking
        fetch_count = max(k * 3, 24)
        result = collection.query(
            query_embeddings=[vec],
            n_results=fetch_count,
            include=["documents", "metadatas", "distances"],
        )

        docs = result.get("documents", [[]])[0]
        metas = result.get("metadatas", [[]])[0]
        dists = result.get("distances", [[]])[0]

        # Build candidate list with both semantic and keyword scores
        candidates = []
        for doc, meta, dist in zip(docs, metas, dists):
            candidate = {
                "text": doc,
                "source": meta.get("source"),
                "function_name": meta.get("function_name", ""),
                "class_name": meta.get("class_name", ""),
                "language": meta.get("language", ""),
                "distance": dist,
            }
            keyword_score = _compute_keyword_score(query, candidate)
            candidate["_keyword_score"] = keyword_score
            candidates.append(candidate)

        # Hybrid ranking: combine semantic distance (lower is better) with
        # keyword score (higher is better). Normalize distance to a score
        # and weight keyword matching.
        # Formula: hybrid_score = (1 / (1 + distance)) + (keyword_weight * keyword_score)
        keyword_weight = 0.1  # Tune this to balance semantic vs keyword
        for c in candidates:
            semantic_score = 1.0 / (1.0 + c["distance"])
            c["_hybrid_score"] = semantic_score + (keyword_weight * c["_keyword_score"])

        # Sort by hybrid score (descending) and take top k
        candidates.sort(key=lambda x: x["_hybrid_score"], reverse=True)

        # Remove internal scoring fields and return top k
        out = []
        for c in candidates[:k]:
            out.append({
                "text": c["text"],
                "source": c["source"],
                "function_name": c["function_name"],
                "class_name": c["class_name"],
                "language": c["language"],
                "distance": c["distance"],
            })

        return out
    except Exception as e:
        print(f"[CHROMA ERROR] search failed: {e}")
        return []


def get_indexed_file_count() -> int:
    try:
        collection = get_collection()
        result = collection.get(include=["metadatas"])
        metas = result.get("metadatas", [])
        sources = {m.get("source") for m in metas if m.get("source")}
        return len(sources)
    except Exception:
        return 0
