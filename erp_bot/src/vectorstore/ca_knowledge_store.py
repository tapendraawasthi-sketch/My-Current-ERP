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


def _all_corpus_items(data: dict) -> list[dict]:
    """Flatten all searchable items from the complete knowledge JSON."""
    items: list[dict] = []
    for key in ("paragraphs", "tables", "glossary", "chapterTexts", "sections"):
        items.extend(data.get(key, []))
    return items


def get_ca_paragraphs_by_ids(paragraph_ids: list[str]) -> list[dict]:
    """Fetch IFRS chunks by paragraph/glossary id (for concept-matched retrieval)."""
    if not paragraph_ids:
        return []

    try:
        collection = get_collection()
        if collection.count() == 0:
            return []

        result = collection.get(
            where={"paragraph_id": {"$in": paragraph_ids}},
            include=["documents", "metadatas"],
        )

        docs = result.get("documents") or []
        metas = result.get("metadatas") or []
        hits: list[dict] = []
        for doc, meta in zip(docs, metas):
            hits.append({
                "text": doc,
                "paragraph_id": meta.get("paragraph_id", meta.get("item_id", "")),
                "chapter": meta.get("chapter", 0),
                "section": meta.get("section", ""),
                "topics": meta.get("topics", ""),
                "item_type": meta.get("item_type", ""),
                "distance": 0.0,
            })
        return hits
    except Exception as exc:
        print(f"[CA KNOWLEDGE ERROR] paragraph lookup failed: {exc}")
        return []


def search_ca_knowledge(query: str, k: int = 6) -> list[dict]:
    """Semantic vector search over IFRS/CA knowledge via Ollama embeddings."""
    try:
        collection = get_collection()
        if collection.count() == 0:
            return []

        vec = _embedder.embed_query(query)
        result = collection.query(
            query_embeddings=[vec],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )

        docs = result.get("documents", [[]])[0]
        metas = result.get("metadatas", [[]])[0]
        dists = result.get("distances", [[]])[0]

        hits: list[dict] = []
        for doc, meta, dist in zip(docs, metas, dists):
            hits.append({
                "text": doc,
                "paragraph_id": meta.get("paragraph_id", meta.get("item_id", "")),
                "chapter": meta.get("chapter", 0),
                "section": meta.get("section", ""),
                "topics": meta.get("topics", ""),
                "item_type": meta.get("item_type", ""),
                "distance": dist,
            })
        return hits
    except Exception as exc:
        print(f"[CA KNOWLEDGE ERROR] search failed: {exc}")
        return []


_MAX_CHUNK_CHARS = 2200


def format_ifrs_context(hits: list[dict]) -> str:
    """Format retrieved IFRS/CA knowledge for LLM system context."""
    if not hits:
        return ""

    lines = [
        "[IFRS CONCEPTUAL FRAMEWORK — retrieved by semantic similarity]",
        "Cite paragraph IDs when answering; do not invent rules.",
        "",
    ]
    for hit in hits:
        pid = hit.get("paragraph_id", "")
        section = hit.get("section", "")
        body = (hit.get("text") or "").strip()
        if not body:
            continue
        if len(body) > _MAX_CHUNK_CHARS:
            body = body[:_MAX_CHUNK_CHARS] + "\n...(truncated)..."
        label = f"Para {pid}" if pid else section
        lines.append(f"--- {label} ---")
        lines.append(body)
        lines.append("")

    return "\n".join(lines)


def _item_doc_text(item: dict) -> str:
    item_id = item.get("id", "")
    item_type = item.get("type", "paragraph")
    section = item.get("section", "")
    text = item.get("text", "")
    term = item.get("term", "")
    topics = ", ".join(item.get("topics", []))

    if item_type == "glossary" and term:
        return f"[Glossary: {term}] {section}\n{text}\nTopics: {topics}"
    if item_type == "table":
        return f"[{item_id}] {section}\n{text}\nTopics: {topics}"
    if item_type in ("sp_paragraph",) or str(item_id).startswith("SP"):
        return f"[{item_id}] {section}\n{text}\nTopics: {topics}"
    if item_type == "chapter_full":
        return f"[Chapter {item.get('chapter', 0)} full text] {section}\n{text[:4000]}\nTopics: {topics}"
    return f"[Para {item_id}] {section}\n{text}\nTopics: {topics}"


def ingest_ca_knowledge() -> dict:
    """Embed and upsert ALL items from conceptual-framework-knowledge.json."""
    if not _KNOWLEDGE_JSON.exists():
        return {"status": "error", "message": f"Knowledge file not found: {_KNOWLEDGE_JSON}"}

    with open(_KNOWLEDGE_JSON, encoding="utf-8") as f:
        data = json.load(f)

    items = _all_corpus_items(data)
    if not items:
        return {"status": "skipped", "chunks": 0}

    collection = get_collection()
    try:
        _client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    collection = get_collection()

    batch_size = 40
    indexed = 0

    try:
        for i in range(0, len(items), batch_size):
            batch = items[i : i + batch_size]
            texts = []
            ids = []
            metas = []

            for j, item in enumerate(batch):
                item_id = item.get("id", "") or f"item-{i + j}"
                item_type = item.get("type", "paragraph")
                doc_text = _item_doc_text(item)
                chunk_id = f"cf-{item_type}-{item_id}-{i + j}".replace(" ", "-")
                texts.append(doc_text)
                ids.append(chunk_id)
                metas.append({
                    "paragraph_id": item_id,
                    "item_id": item_id,
                    "item_type": item.get("type", "paragraph"),
                    "chapter": item.get("chapter", 0),
                    "section": item.get("section", ""),
                    "topics": ", ".join(item.get("topics", [])),
                    "chunk_id": chunk_id,
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

        return {
            "status": "indexed",
            "chunks": indexed,
            "complete": data.get("metadata", {}).get("complete", False),
            "embed_model": EMBED_MODEL,
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc), "chunks": indexed}


def get_ca_knowledge_count() -> int:
    try:
        return get_collection().count()
    except Exception:
        return 0
