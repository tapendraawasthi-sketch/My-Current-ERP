"""ChromaDB vector store for IFRS Conceptual Framework CA knowledge."""

from __future__ import annotations

import json
import threading
from pathlib import Path

import chromadb
from langchain_ollama import OllamaEmbeddings

from ..config import CHROMA_PATH, EMBED_MODEL, OLLAMA_BASE_URL

_client = chromadb.PersistentClient(path=CHROMA_PATH)
_embedder = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
_write_lock = threading.Lock()

COLLECTION_NAME = "ca_knowledge"
_BOT_ROOT = Path(__file__).resolve().parent.parent.parent
_KNOWLEDGE_JSON = _BOT_ROOT.parent / "data" / "ekhata" / "conceptual-framework-knowledge.json"


def get_collection():
    return _client.get_or_create_collection(COLLECTION_NAME)


def _keyword_score(query: str, doc: dict) -> float:
    tokens = {t.lower() for t in query.split() if len(t) >= 3 and t.isalnum()}
    if not tokens:
        return 0.0

    text = " ".join(
        str(doc.get(k, "")) for k in ("text", "section", "topics", "concepts")
    ).lower()
    score = 0.0
    for token in tokens:
        if token in text:
            score += 1.0
        if token in str(doc.get("section", "")).lower():
            score += 2.0
    return score


def search_ca_knowledge(query: str, k: int = 6) -> list[dict]:
    """Hybrid semantic + keyword search over CA knowledge corpus."""
    try:
        collection = get_collection()
        if collection.count() == 0:
            return _fallback_search(query, k)

        vec = _embedder.embed_query(query)
        fetch_count = max(k * 3, 18)
        result = collection.query(
            query_embeddings=[vec],
            n_results=fetch_count,
            include=["documents", "metadatas", "distances"],
        )

        docs = result.get("documents", [[]])[0]
        metas = result.get("metadatas", [[]])[0]
        dists = result.get("distances", [[]])[0]

        candidates = []
        for doc, meta, dist in zip(docs, metas, dists):
            item = {
                "text": doc,
                "paragraph_id": meta.get("paragraph_id", ""),
                "chapter": meta.get("chapter", 0),
                "section": meta.get("section", ""),
                "topics": meta.get("topics", ""),
                "distance": dist,
            }
            kw = _keyword_score(query, item)
            semantic = 1.0 / (1.0 + dist)
            item["_score"] = semantic + 0.12 * kw
            candidates.append(item)

        candidates.sort(key=lambda x: x["_score"], reverse=True)
        return [
            {k: v for k, v in c.items() if not k.startswith("_")}
            for c in candidates[:k]
        ]
    except Exception as exc:
        print(f"[CA KNOWLEDGE ERROR] search failed: {exc}")
        return _fallback_search(query, k)


def _fallback_search(query: str, k: int) -> list[dict]:
    """JSON fallback when Chroma is empty or Ollama unavailable."""
    if not _KNOWLEDGE_JSON.exists():
        return []

    try:
        with open(_KNOWLEDGE_JSON, encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []

    query_lower = query.lower()
    tokens = {t.lower() for t in query.split() if len(t) >= 3}

    scored = []
    for para in data.get("paragraphs", []):
        text = para.get("text", "")
        section = para.get("section", "")
        topics = " ".join(para.get("topics", []))
        combined = f"{text} {section} {topics}".lower()

        score = 0.0
        for token in tokens:
            if token in combined:
                score += 1.0
        if any(alias in query_lower for concept in data.get("concepts", []) for alias in concept.get("ne", []) + concept.get("en", []) if alias.lower() in query_lower and any(pid == para.get("id") for pid in concept.get("paragraphs", []))):
            score += 5.0

        if score > 0:
            scored.append({
                "text": text,
                "paragraph_id": para.get("id", ""),
                "chapter": para.get("chapter", 0),
                "section": section,
                "topics": topics,
                "_score": score,
            })

    scored.sort(key=lambda x: x["_score"], reverse=True)
    return [{k: v for k, v in c.items() if k != "_score"} for c in scored[:k]]


def ingest_ca_knowledge() -> dict:
    """Embed and upsert all paragraphs from conceptual-framework-knowledge.json."""
    if not _KNOWLEDGE_JSON.exists():
        return {"status": "error", "message": f"Knowledge file not found: {_KNOWLEDGE_JSON}"}

    with open(_KNOWLEDGE_JSON, encoding="utf-8") as f:
        data = json.load(f)

    paragraphs = data.get("paragraphs", [])
    if not paragraphs:
        return {"status": "skipped", "chunks": 0}

    collection = get_collection()
    batch_size = 50
    indexed = 0

    try:
        for i in range(0, len(paragraphs), batch_size):
            batch = paragraphs[i : i + batch_size]
            texts = []
            ids = []
            metas = []

            for para in batch:
                pid = para.get("id", "")
                section = para.get("section", "")
                text = para.get("text", "")
                topics = ", ".join(para.get("topics", []))
                doc_text = f"[Para {pid}] {section}\n{text}\nTopics: {topics}"
                texts.append(doc_text)
                ids.append(f"cf-{pid}")
                metas.append({
                    "paragraph_id": pid,
                    "chapter": para.get("chapter", 0),
                    "section": section,
                    "topics": topics,
                    "chunk_id": f"cf-{pid}",
                    "source": "conceptual-framework-knowledge.json",
                })

            embeddings = _embedder.embed_documents(texts)
            with _write_lock:
                collection.upsert(
                    ids=ids,
                    embeddings=embeddings,
                    documents=texts,
                    metadatas=metas,
                )
            indexed += len(batch)

        return {"status": "indexed", "chunks": indexed}
    except Exception as exc:
        return {"status": "error", "message": str(exc), "chunks": indexed}


def get_ca_knowledge_count() -> int:
    try:
        return get_collection().count()
    except Exception:
        return 0
