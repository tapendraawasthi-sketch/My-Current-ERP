"""Chroma collection for ERP navigation — pages, components, routes only."""

from __future__ import annotations

import hashlib
import logging
import threading
from pathlib import Path

import chromadb
from langchain_ollama import OllamaEmbeddings

from ..config import CHROMA_PATH, EMBED_MODEL, ERP_PATH, OLLAMA_BASE_URL
from ..knowledge.embed_cache import embed_query_cached

logger = logging.getLogger(__name__)

_client = chromadb.PersistentClient(path=CHROMA_PATH)
_embedder = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
_write_lock = threading.Lock()

COLLECTION_NAME = "nav_index"

NAV_PREFIXES = ("src/pages/", "src/components/")
NAV_EXTRA_FILES = (
    "src/App.tsx",
    "src/routeTree.gen.ts",
    "src/components/layout/BusyMenuBar.tsx",
    "src/components/layout/Sidebar.tsx",
)


def get_collection():
    return _client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "ERP UI navigation — pages, components, routes"},
    )


def _nav_files() -> list[Path]:
    files: list[Path] = []
    for prefix in NAV_PREFIXES:
        root = ERP_PATH / prefix
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.suffix.lower() in {".tsx", ".ts"} and path.is_file():
                files.append(path.resolve())
    for rel in NAV_EXTRA_FILES:
        path = (ERP_PATH / rel).resolve()
        if path.exists():
            files.append(path)
    return sorted(set(files))


def _chunk_id(source: str, idx: int) -> str:
    return hashlib.md5(f"{source}:{idx}".encode()).hexdigest()


def ingest_nav_index(force_reindex: bool = False) -> dict:
    paths = _nav_files()
    if not paths:
        return {"status": "skipped", "message": "No nav files found", "files": 0}

    collection = get_collection()

    if force_reindex:
        try:
            _client.delete_collection(COLLECTION_NAME)
            collection = get_collection()
        except Exception as exc:
            logger.warning("nav_index clear failed: %s", exc)

    if not force_reindex and collection.count() > 0:
        return {"status": "ready", "chunks": collection.count(), "files": len(paths)}

    chunks: list[dict] = []
    for path in paths:
        try:
            rel = str(path.relative_to(ERP_PATH)).replace("\\", "/")
            text = path.read_text(encoding="utf-8", errors="ignore")[:4000]
            if not text.strip():
                continue
            chunks.append(
                {
                    "id": _chunk_id(rel, 0),
                    "text": f"File: {rel}\n\n{text}",
                    "source": rel,
                }
            )
        except OSError as exc:
            logger.warning("nav_index skip %s: %s", path, exc)

    if not chunks:
        return {"status": "error", "message": "No chunks generated"}

    batch_size = 32
    indexed = 0
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        texts = [c["text"] for c in batch]
        embeddings = _embedder.embed_documents(texts)
        with _write_lock:
            collection.upsert(
                ids=[c["id"] for c in batch],
                embeddings=embeddings,
                documents=texts,
                metadatas=[{"source": c["source"]} for c in batch],
            )
        indexed += len(batch)

    return {"status": "indexed", "chunks": indexed, "files": len(paths)}


def get_nav_index_count() -> int:
    try:
        return get_collection().count()
    except Exception:
        return 0


def search_nav_index(query: str, k: int = 5) -> list[dict]:
    collection = get_collection()
    if collection.count() == 0:
        return []
    try:
        embedding = embed_query_cached(query)
        results = collection.query(query_embeddings=[embedding], n_results=min(k, collection.count()))
        out: list[dict] = []
        for i, doc_id in enumerate(results.get("ids", [[]])[0]):
            out.append(
                {
                    "id": doc_id,
                    "text": results["documents"][0][i],
                    "source": (results.get("metadatas") or [{}])[0][i].get("source", ""),
                    "distance": (results.get("distances") or [[0]])[0][i],
                }
            )
        return out
    except Exception as exc:
        logger.warning("nav_index search failed: %s", exc)
        return []
