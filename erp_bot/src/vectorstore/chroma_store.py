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


def search_codebase(query: str, k: int = 8) -> list[dict]:
    try:
        collection = get_collection()
        vec = _embedder.embed_query(query)
        result = collection.query(
            query_embeddings=[vec],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )

        docs = result.get("documents", [[]])[0]
        metas = result.get("metadatas", [[]])[0]
        dists = result.get("distances", [[]])[0]

        out = []
        for doc, meta, dist in zip(docs, metas, dists):
            out.append({
                "text": doc,
                "source": meta.get("source"),
                "function_name": meta.get("function_name", ""),
                "class_name": meta.get("class_name", ""),
                "language": meta.get("language", ""),
                "distance": dist,
            })
        out.sort(key=lambda x: x["distance"])
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
