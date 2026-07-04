"""Nepali grammar reference store for e-Khata NLU and Ollama interpretation.

Loads the complete grammar reference from data/ekhata/source/nepali-grammar-reference.txt,
supports section-based keyword search, and optional ChromaDB semantic retrieval.
"""

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

COLLECTION_NAME = "nepali_grammar"
_BOT_ROOT = Path(__file__).resolve().parent.parent.parent
_REPO_ROOT = _BOT_ROOT.parent
_GRAMMAR_TXT = _REPO_ROOT / "data" / "ekhata" / "source" / "nepali-grammar-reference.txt"
_GRAMMAR_INDEX = _REPO_ROOT / "data" / "ekhata" / "nepali-grammar-index.json"

_SECTION_DELIM = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
_SECTION_HEADER = re.compile(
    r"खण्ड\s+(\d+):\s*(.+?)\s*\nSECTION\s+\d+:\s*(.+?)(?:\n|$)",
    re.MULTILINE,
)

_cached_sections: list[dict] | None = None


def get_collection():
    return _client.get_or_create_collection(COLLECTION_NAME)


def _load_sections() -> list[dict]:
    """Parse reference txt into searchable section chunks."""
    global _cached_sections
    if _cached_sections is not None:
        return _cached_sections

    if not _GRAMMAR_TXT.exists():
        _cached_sections = []
        return _cached_sections

    text = _GRAMMAR_TXT.read_text(encoding="utf-8")
    parts = text.split(_SECTION_DELIM)
    sections: list[dict] = []

    for part in parts:
        part = part.strip()
        if not part or len(part) < 80:
            continue

        match = _SECTION_HEADER.search(part)
        if match:
            section_id = int(match.group(1))
            title_ne = match.group(2).strip()
            title_en = match.group(3).strip()
        else:
            section_id = 0
            title_ne = "Introduction"
            title_en = "Introduction"

        sections.append({
            "section_id": section_id,
            "title_ne": title_ne,
            "title_en": title_en,
            "text": part[:8000],
            "keywords": _extract_keywords(part),
        })

    _cached_sections = sections
    return sections


def _extract_keywords(text: str) -> set[str]:
    """Pull romanized tokens and English keywords from section text."""
    tokens: set[str] = set()
    for m in re.finditer(r"\b([a-z]{3,}(?:\s+[a-z]{2,})?)\b", text.lower()):
        tokens.add(m.group(1))
    for m in re.finditer(r"→\s*([^\n→]+)", text):
        variant = m.group(1).strip().lower()
        if len(variant) < 60:
            tokens.add(variant)
    return tokens


def _keyword_score(query: str, section: dict) -> float:
    query_lower = query.lower()
    tokens = {t.lower() for t in query.split() if len(t) >= 2 and t.isalnum()}
    if not tokens:
        return 0.0

    text = section.get("text", "").lower()
    title = f"{section.get('title_en', '')} {section.get('title_ne', '')}".lower()
    score = 0.0

    for token in tokens:
        if token in text:
            score += 1.0
        if token in title:
            score += 3.0
        for kw in section.get("keywords", set()):
            if token in kw or kw in token:
                score += 2.0

    # Boost financial NLU sections for transaction-like queries
    if section.get("section_id") in (18, 21, 24, 26, 27, 31):
        if re.search(r"\b(\d+|saya|hajar|lakh|paisa|udhaar|tiryo|kinyo|beche|diyo|liyo)\b", query_lower):
            score += 2.0

    return score


def _load_index_section_hints() -> dict[int, list[str]]:
    if not _GRAMMAR_INDEX.exists():
        return {}
    try:
        data = json.loads(_GRAMMAR_INDEX.read_text(encoding="utf-8"))
        return {
            s["id"]: s.get("keywords", [])
            for s in data.get("sections", [])
        }
    except (json.JSONDecodeError, OSError):
        return {}


def search_nepali_grammar(query: str, k: int = 4) -> list[dict]:
    """Hybrid semantic + keyword search over Nepali grammar reference sections."""
    sections = _load_sections()
    if not sections:
        return []

    # Try Chroma first if populated
    try:
        collection = get_collection()
        if collection.count() > 0:
            vec = _embedder.embed_query(query)
            result = collection.query(
                query_embeddings=[vec],
                n_results=max(k * 2, 8),
                include=["documents", "metadatas", "distances"],
            )
            docs = result.get("documents", [[]])[0]
            metas = result.get("metadatas", [[]])[0]
            dists = result.get("distances", [[]])[0]

            hits = []
            for doc, meta, dist in zip(docs, metas, dists):
                section = {
                    "text": doc,
                    "section_id": meta.get("section_id", 0),
                    "title_en": meta.get("title_en", ""),
                    "title_ne": meta.get("title_ne", ""),
                    "distance": dist,
                }
                kw = _keyword_score(query, section)
                semantic = 1.0 / (1.0 + dist)
                section["_score"] = semantic + 0.15 * kw
                hits.append(section)

            hits.sort(key=lambda x: x["_score"], reverse=True)
            return [
                {key: val for key, val in h.items() if not key.startswith("_")}
                for h in hits[:k]
            ]
    except Exception as exc:
        print(f"[NEPALI GRAMMAR] Chroma search failed, using keyword fallback: {exc}")

    # Keyword fallback over parsed sections
    index_hints = _load_index_section_hints()
    scored = []
    for section in sections:
        sid = section.get("section_id", 0)
        if sid in index_hints:
            section = {**section, "index_keywords": index_hints[sid]}
        score = _keyword_score(query, section)
        if score > 0:
            scored.append({**section, "_score": score})

    scored.sort(key=lambda x: x["_score"], reverse=True)
    return [{key: val for key, val in s.items() if not key.startswith("_")} for s in scored[:k]]


def format_grammar_context(hits: list[dict]) -> str:
    """Format retrieved grammar sections for LLM system context."""
    if not hits:
        return ""

    lines = [
        "[NEPALI GRAMMAR REFERENCE — retrieved for interpreting user input]",
        "Use these rules to understand Devanagari, Roman Nepali, Halkhabar, and mixed input.",
        "Treat chha/cha/xa as equivalent. paisa = money. udhaar = credit (not bad debt).",
        "",
    ]
    for hit in hits:
        sid = hit.get("section_id", 0)
        title = hit.get("title_en") or hit.get("title_ne") or f"Section {sid}"
        body = hit.get("text", "")
        # Trim to keep context window manageable
        if len(body) > 2500:
            body = body[:2500] + "\n...(section truncated)..."
        lines.append(f"--- Section {sid}: {title} ---")
        lines.append(body)
        lines.append("")

    return "\n".join(lines)


def ingest_nepali_grammar() -> dict:
    """Embed and upsert all grammar reference sections into ChromaDB."""
    sections = _load_sections()
    if not sections:
        return {"status": "error", "message": f"Grammar reference not found: {_GRAMMAR_TXT}"}

    collection = get_collection()
    indexed = 0

    try:
        batch_size = 20
        for i in range(0, len(sections), batch_size):
            batch = sections[i : i + batch_size]
            texts = []
            ids = []
            metas = []

            for sec in batch:
                sid = sec.get("section_id", 0)
                title_en = sec.get("title_en", "")
                doc = f"[Section {sid}: {title_en}]\n{sec.get('text', '')}"
                chunk_id = f"ng-sec-{sid:02d}"
                texts.append(doc[:6000])
                ids.append(chunk_id)
                metas.append({
                    "section_id": sid,
                    "title_en": title_en,
                    "title_ne": sec.get("title_ne", ""),
                    "chunk_id": chunk_id,
                    "source": "nepali-grammar-reference.txt",
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

        return {"status": "indexed", "chunks": indexed, "source": str(_GRAMMAR_TXT)}
    except Exception as exc:
        return {"status": "error", "message": str(exc), "chunks": indexed}


def get_nepali_grammar_count() -> int:
    try:
        return get_collection().count()
    except Exception:
        return 0


def grammar_reference_exists() -> bool:
    return _GRAMMAR_TXT.exists()
