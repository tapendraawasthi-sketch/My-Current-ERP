"""ChromaDB vector store for IFRS Conceptual Framework CA knowledge."""

from __future__ import annotations

import json
import re
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
_NEPAL_KNOWLEDGE_JSON = _BOT_ROOT.parent / "data" / "ekhata" / "nepal-accounting-knowledge.json"


def get_collection():
    return _client.get_or_create_collection(COLLECTION_NAME)


def _nepal_items(data: dict) -> list[dict]:
    """Flatten Nepal accounting knowledge items for search/ingest."""
    items = []
    for item in data.get("items", []):
        text_parts = [
            item.get("text_en", ""),
            item.get("text_ne", ""),
            item.get("term_en", ""),
            item.get("term_ne", ""),
            " ".join(item.get("topics", [])),
            item.get("journal", ""),
            " ".join(item.get("examples_ne", [])),
        ]
        items.append({
            "id": item.get("id", ""),
            "type": item.get("type", "guidance"),
            "section": item.get("term_en", item.get("id", "")),
            "text": "\n".join(p for p in text_parts if p),
            "topics": item.get("topics", []),
            "term": item.get("term_en", ""),
        })
    return items


def _all_corpus_items(data: dict) -> list[dict]:
    """Flatten all searchable items from the complete knowledge JSON."""
    items: list[dict] = []
    for key in ("paragraphs", "tables", "glossary", "chapterTexts", "sections"):
        items.extend(data.get(key, []))
    return items


def _keyword_score(query: str, doc: dict) -> float:
    tokens = {t.lower() for t in query.split() if len(t) >= 3 and t.isalnum()}
    if not tokens:
        return 0.0

    text = " ".join(
        str(doc.get(k, "")) for k in ("text", "section", "topics", "term", "definition")
    ).lower()
    score = 0.0
    for token in tokens:
        if token in text:
            score += 1.0
        if token in str(doc.get("section", "")).lower():
            score += 2.0
    return score


def search_ca_knowledge(query: str, k: int = 6) -> list[dict]:
    """Hybrid semantic + keyword search over complete CA knowledge corpus."""
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
                "paragraph_id": meta.get("paragraph_id", meta.get("item_id", "")),
                "chapter": meta.get("chapter", 0),
                "section": meta.get("section", ""),
                "topics": meta.get("topics", ""),
                "item_type": meta.get("item_type", ""),
                "distance": dist,
            }
            kw = _keyword_score(query, item)
            semantic = 1.0 / (1.0 + dist)
            item["_score"] = semantic + 0.12 * kw
            candidates.append(item)

        candidates.sort(key=lambda x: x["_score"], reverse=True)
        return [
            {key: val for key, val in c.items() if not key.startswith("_")}
            for c in candidates[:k]
        ]
    except Exception as exc:
        print(f"[CA KNOWLEDGE ERROR] search failed: {exc}")
        return _fallback_search(query, k)


def _fallback_search(query: str, k: int) -> list[dict]:
    """JSON fallback when Chroma is empty or Ollama unavailable."""
    combined: list[dict] = []

    for path, prefix in ((_KNOWLEDGE_JSON, "cf"), (_NEPAL_KNOWLEDGE_JSON, "np")):
        if not path.exists():
            continue
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue

        items = _all_corpus_items(data) if prefix == "cf" else _nepal_items(data)
        query_lower = query.lower()
        tokens = {t.lower() for t in query.split() if len(t) >= 3}

        for item in items:
            text = item.get("text", "")
            section = item.get("section", "")
            term = item.get("term", "")
            topics = " ".join(item.get("topics", []))
            combined_text = f"{text} {section} {topics} {term}".lower()

            score = 0.0
            for token in tokens:
                if token in combined_text:
                    score += 1.0
            if term and term.lower() in query_lower:
                score += 10.0
            if prefix == "np" and item.get("type") == "tax" and re.search(
                r"\b(vat|tds|ssf|tax|ird)\b", query_lower
            ):
                score += 3.0

            if score > 0:
                combined.append({
                    "text": text,
                    "paragraph_id": item.get("id", ""),
                    "chapter": item.get("chapter", 0),
                    "section": section,
                    "topics": topics,
                    "item_type": item.get("type", ""),
                    "_score": score,
                    "_source": path.name,
                })

    combined.sort(key=lambda x: x["_score"], reverse=True)
    return [
        {key: val for key, val in c.items() if not key.startswith("_")}
        for c in combined[:k]
    ]


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
    """Embed and upsert IFRS framework + Nepal accounting knowledge."""
    indexed = 0
    errors: list[str] = []

    sources = [
        (_KNOWLEDGE_JSON, _all_corpus_items, "cf", "conceptual-framework-knowledge.json"),
        (_NEPAL_KNOWLEDGE_JSON, _nepal_items, "np", "nepal-accounting-knowledge.json"),
    ]

    collection = get_collection()

    for path, flattener, prefix, source_name in sources:
        if not path.exists():
            errors.append(f"not found: {path}")
            continue
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
            errors.append(str(exc))
            continue

        items = flattener(data)
        if not items:
            continue

        batch_size = 40
        try:
            for i in range(0, len(items), batch_size):
                batch = items[i : i + batch_size]
                texts = []
                ids = []
                metas = []

                for item in batch:
                    item_id = item.get("id", "")
                    doc_text = _item_doc_text(item)
                    chunk_id = f"{prefix}-{item_id}".replace(" ", "-")
                    texts.append(doc_text)
                    ids.append(chunk_id)
                    metas.append({
                        "paragraph_id": item_id,
                        "item_id": item_id,
                        "item_type": item.get("type", "paragraph"),
                        "chapter": item.get("chapter", 0),
                        "section": item.get("section", ""),
                        "topics": ", ".join(item.get("topics", [])) if isinstance(item.get("topics"), list) else str(item.get("topics", "")),
                        "chunk_id": chunk_id,
                        "source": source_name,
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
        except Exception as exc:
            errors.append(f"{source_name}: {exc}")

    if indexed == 0 and errors:
        return {"status": "error", "message": "; ".join(errors), "chunks": 0}

    return {"status": "indexed", "chunks": indexed, "errors": errors or None}


def get_ca_knowledge_count() -> int:
    try:
        return get_collection().count()
    except Exception:
        return 0
