"""Nepali grammar reference store for e-Khata — ChromaDB + Ollama embeddings.

Sources:
  - data/ekhata/source/nepali-grammar-reference*.txt
"""

from __future__ import annotations

import re
import threading
from pathlib import Path

import chromadb
from langchain_ollama import OllamaEmbeddings

from ..config import CHROMA_PATH, EMBED_MODEL, OLLAMA_BASE_URL

_BOT_ROOT = Path(__file__).resolve().parent.parent.parent
_REPO_ROOT = _BOT_ROOT.parent
_GRAMMAR_TXT = _REPO_ROOT / "data" / "ekhata" / "source" / "nepali-grammar-reference.txt"
_GRAMMAR_VERBATIM = _REPO_ROOT / "data" / "ekhata" / "source" / "nepali-grammar-reference-verbatim.txt"
_GRAMMAR_VERBATIM_PART2 = _REPO_ROOT / "data" / "ekhata" / "source" / "nepali-grammar-reference-verbatim-part2.txt"
_GRAMMAR_VERBATIM_PART3 = _REPO_ROOT / "data" / "ekhata" / "source" / "nepali-grammar-reference-verbatim-part3.txt"

_SECTION_DELIM = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
_SECTION_HEADER = re.compile(
    r"खण्ड\s+(\d+):\s*(.+?)\s*\nSECTION\s+\d+:\s*(.+?)(?:\n|$)",
    re.MULTILINE,
)

_client = chromadb.PersistentClient(path=CHROMA_PATH)
_embedder = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
_write_lock = threading.Lock()

COLLECTION_NAME = "nepali_grammar"

_build_lock = threading.Lock()
_cached_sections: list[dict] | None = None


def get_collection():
    return _client.get_or_create_collection(COLLECTION_NAME)


def _parse_sections_from_text(text: str, source: str) -> list[dict]:
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
            "text": part,
            "source": source,
        })

    return sections


def _load_sections() -> list[dict]:
    global _cached_sections
    if _cached_sections is not None:
        return _cached_sections

    sections: list[dict] = []
    for path, label in (
        (_GRAMMAR_TXT, "nepali-grammar-reference.txt"),
        (_GRAMMAR_VERBATIM, "nepali-grammar-reference-verbatim.txt"),
        (_GRAMMAR_VERBATIM_PART2, "nepali-grammar-reference-verbatim-part2.txt"),
        (_GRAMMAR_VERBATIM_PART3, "nepali-grammar-reference-verbatim-part3.txt"),
    ):
        if path.exists():
            sections.extend(_parse_sections_from_text(path.read_text(encoding="utf-8"), label))

    _cached_sections = sections
    return sections


def _source_slug(source: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", source.replace(".txt", "").lower()).strip("_")
    return slug[:40] or "grammar"


def _chunk_long_section(section: dict, max_chars: int = 1800) -> list[dict]:
    src_slug = _source_slug(section.get("source", ""))
    text = section.get("text", "")
    if len(text) <= max_chars:
        return [section]

    chunks: list[dict] = []
    sid = section.get("section_id", 0)
    lines = text.split("\n")
    buf: list[str] = []
    buf_len = 0
    chunk_idx = 0

    for line in lines:
        if buf_len + len(line) > max_chars and buf:
            chunk_idx += 1
            chunk_text = "\n".join(buf)
            chunks.append({
                **section,
                "chunk_id": f"sec-{sid:03d}-{src_slug}-c{chunk_idx}",
                "text": chunk_text,
            })
            buf = [line]
            buf_len = len(line)
        else:
            buf.append(line)
            buf_len += len(line) + 1

    if buf:
        chunk_idx += 1
        chunks.append({
            **section,
            "chunk_id": f"sec-{sid:03d}-{src_slug}-c{chunk_idx}",
            "text": "\n".join(buf),
        })

    return chunks


def _build_chunks() -> list[dict]:
    chunks: list[dict] = []
    seen_section_source: set[tuple[int, str]] = set()

    for section in _load_sections():
        sid = section.get("section_id", 0)
        source = section.get("source", "")
        key = (sid, source)
        if key in seen_section_source:
            continue
        seen_section_source.add(key)

        if "verbatim" in source and len(section.get("text", "")) > 2000:
            chunks.extend(_chunk_long_section(section))
        else:
            src_slug = _source_slug(source)
            chunks.append({**section, "chunk_id": f"sec-{sid:03d}-{src_slug}"})

    return chunks


def _chunk_doc_text(chunk: dict) -> str:
    sid = chunk.get("section_id", 0)
    title = chunk.get("title_en") or chunk.get("title_ne") or f"Section {sid}"
    return f"[Section {sid}: {title}]\n{chunk.get('text', '')}"


def search_nepali_grammar(query: str, k: int = 6) -> list[dict]:
    """Semantic vector search over Nepali grammar chunks via Ollama embeddings."""
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
                "section_id": meta.get("section_id", 0),
                "title_en": meta.get("title_en", ""),
                "title_ne": meta.get("title_ne", ""),
                "text": doc,
                "source": meta.get("source", ""),
                "chunk_id": meta.get("chunk_id", ""),
                "distance": dist,
            })
        return hits
    except Exception as exc:
        print(f"[NEPALI GRAMMAR ERROR] search failed: {exc}")
        return []


_MAX_CHUNK_CHARS = 2200


def format_grammar_context(hits: list[dict]) -> str:
    """Format retrieved grammar sections for LLM system context."""
    if not hits:
        return ""

    lines = [
        "[NEPALI GRAMMAR REFERENCE — retrieved by semantic similarity]",
        "Use these rules to understand Devanagari, Roman Nepali, Halkhabar, and mixed input.",
        "",
    ]
    for hit in hits:
        sid = hit.get("section_id", 0)
        title = hit.get("title_en") or hit.get("title_ne") or f"Section {sid}"
        body = hit.get("text", "")
        if len(body) > _MAX_CHUNK_CHARS:
            body = body[:_MAX_CHUNK_CHARS] + "\n...(truncated)..."
        src = hit.get("source", "")
        src_tag = f" [{src}]" if src else ""
        lines.append(f"--- Section {sid}: {title}{src_tag} ---")
        lines.append(body)
        lines.append("")

    return "\n".join(lines)


def ingest_nepali_grammar() -> dict:
    """Embed and upsert all Nepali grammar chunks into ChromaDB."""
    if not grammar_reference_exists():
        return {"status": "error", "message": f"Grammar reference not found: {_GRAMMAR_TXT}"}

    chunks = _build_chunks()
    if not chunks:
        return {"status": "error", "message": "No chunks to index"}

    collection = get_collection()
    try:
        _client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    collection = get_collection()

    batch_size = 50
    indexed = 0

    try:
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            texts = []
            ids = []
            metas = []

            for chunk in batch:
                chunk_id = chunk.get("chunk_id", f"ng-{i}")
                texts.append(_chunk_doc_text(chunk))
                ids.append(chunk_id.replace(" ", "-"))
                metas.append({
                    "section_id": chunk.get("section_id", 0),
                    "title_en": chunk.get("title_en", ""),
                    "title_ne": chunk.get("title_ne", ""),
                    "source": chunk.get("source", ""),
                    "chunk_id": chunk_id,
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
            print(f"[NEPALI GRAMMAR] Indexed {indexed}/{len(chunks)} chunks...", flush=True)

        return {
            "status": "indexed",
            "engine": "chroma_ollama",
            "chunks": indexed,
            "embed_model": EMBED_MODEL,
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc), "chunks": indexed}


def get_nepali_grammar_count() -> int:
    try:
        return get_collection().count()
    except Exception:
        return 0


def grammar_reference_exists() -> bool:
    return (
        _GRAMMAR_TXT.exists()
        or _GRAMMAR_VERBATIM.exists()
        or _GRAMMAR_VERBATIM_PART2.exists()
        or _GRAMMAR_VERBATIM_PART3.exists()
    )
