"""Nepali grammar reference store for e-Khata NLU and Ollama interpretation.

Pure-local retrieval: BM25 + keyword hybrid over prebuilt JSON index.
No ChromaDB, Ollama embeddings, or API keys required.

Sources:
  - data/ekhata/source/nepali-grammar-reference.txt (structured 33 sections)
  - data/ekhata/source/nepali-grammar-reference-verbatim.txt (Part 1 verbatim)
  - data/ekhata/source/nepali-grammar-reference-verbatim-part2.txt (Part 2 verbatim, sections 34–80)
  - data/ekhata/source/nepali-grammar-reference-verbatim-part3.txt (Part 3 verbatim, sections 81–105)
  - data/ekhata/nepali-grammar-search-index.json (prebuilt at ingest / commit time)
"""

from __future__ import annotations

import json
import math
import re
import threading
from collections import Counter
from pathlib import Path

_BOT_ROOT = Path(__file__).resolve().parent.parent.parent
_REPO_ROOT = _BOT_ROOT.parent
_GRAMMAR_TXT = _REPO_ROOT / "data" / "ekhata" / "source" / "nepali-grammar-reference.txt"
_GRAMMAR_VERBATIM = _REPO_ROOT / "data" / "ekhata" / "source" / "nepali-grammar-reference-verbatim.txt"
_GRAMMAR_VERBATIM_PART2 = _REPO_ROOT / "data" / "ekhata" / "source" / "nepali-grammar-reference-verbatim-part2.txt"
_GRAMMAR_VERBATIM_PART3 = _REPO_ROOT / "data" / "ekhata" / "source" / "nepali-grammar-reference-verbatim-part3.txt"
_GRAMMAR_INDEX = _REPO_ROOT / "data" / "ekhata" / "nepali-grammar-index.json"
_SEARCH_INDEX = _REPO_ROOT / "data" / "ekhata" / "nepali-grammar-search-index.json"

_SECTION_DELIM = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
_SECTION_HEADER = re.compile(
    r"खण्ड\s+(\d+):\s*(.+?)\s*\nSECTION\s+\d+:\s*(.+?)(?:\n|$)",
    re.MULTILINE,
)

_TOKEN_RE = re.compile(
    r"[\u0900-\u097F]+|[a-zA-Z]{2,}|\d+(?:\.\d+)?(?:k|hajar|saya|lakh)?",
    re.I,
)

_build_lock = threading.Lock()
_cached_sections: list[dict] | None = None
_cached_search_index: dict | None = None

# Financial / NLU sections get a boost for transaction queries
_FINANCIAL_SECTIONS = frozenset({
    18, 21, 24, 26, 27, 31, 70, 71, 72, 75, 78, 79,
    81, 82, 83, 84, 85, 86, 87, 88, 97, 98, 99, 101, 102, 103, 104,
})


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text)]


def _extract_keywords(text: str) -> set[str]:
    tokens: set[str] = set()
    for m in re.finditer(r"\b([a-z]{3,}(?:\s+[a-z]{2,})?)\b", text.lower()):
        tokens.add(m.group(1))
    for m in re.finditer(r"→\s*([^\n→]+)", text):
        variant = m.group(1).strip().lower()
        if len(variant) < 80:
            tokens.add(variant)
    return tokens


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
            "keywords": _extract_keywords(part),
            "source": source,
        })

    return sections


def _load_sections() -> list[dict]:
    global _cached_sections
    if _cached_sections is not None:
        return _cached_sections

    sections: list[dict] = []
    if _GRAMMAR_TXT.exists():
        sections.extend(
            _parse_sections_from_text(
                _GRAMMAR_TXT.read_text(encoding="utf-8"),
                "nepali-grammar-reference.txt",
            )
        )
    if _GRAMMAR_VERBATIM.exists():
        sections.extend(
            _parse_sections_from_text(
                _GRAMMAR_VERBATIM.read_text(encoding="utf-8"),
                "nepali-grammar-reference-verbatim.txt",
            )
        )
    if _GRAMMAR_VERBATIM_PART2.exists():
        sections.extend(
            _parse_sections_from_text(
                _GRAMMAR_VERBATIM_PART2.read_text(encoding="utf-8"),
                "nepali-grammar-reference-verbatim-part2.txt",
            )
        )
    if _GRAMMAR_VERBATIM_PART3.exists():
        sections.extend(
            _parse_sections_from_text(
                _GRAMMAR_VERBATIM_PART3.read_text(encoding="utf-8"),
                "nepali-grammar-reference-verbatim-part3.txt",
            )
        )

    _cached_sections = sections
    return sections


def _chunk_long_section(section: dict, max_chars: int = 1800) -> list[dict]:
    """Split long verbatim sections into searchable chunks."""
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
                "chunk_id": f"sec-{sid:02d}-c{chunk_idx}",
                "text": chunk_text,
                "keywords": _extract_keywords(chunk_text),
            })
            buf = [line]
            buf_len = len(line)
        else:
            buf.append(line)
            buf_len += len(line) + 1

    if buf:
        chunk_idx += 1
        chunk_text = "\n".join(buf)
        chunks.append({
            **section,
            "chunk_id": f"sec-{sid:02d}-c{chunk_idx}",
            "text": chunk_text,
            "keywords": _extract_keywords(chunk_text),
        })

    return chunks


def _build_chunks() -> list[dict]:
    """Flatten sections into search chunks (verbatim sections may split)."""
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
            chunks.append({**section, "chunk_id": f"sec-{sid:02d}-{source[:4]}"})

    return chunks


def _bm25_vector(tokens: list[str], df: dict[str, int], n_docs: int, avg_dl: float) -> tuple[dict[str, float], float]:
    k1, b = 1.5, 0.75
    tf = Counter(tokens)
    dl = len(tokens) or 1
    vec: dict[str, float] = {}
    norm_sq = 0.0

    for term, freq in tf.items():
        idf = math.log((n_docs - df.get(term, 0) + 0.5) / (df.get(term, 0) + 0.5) + 1.0)
        tf_norm = (freq * (k1 + 1)) / (freq + k1 * (1 - b + b * dl / avg_dl))
        weight = idf * tf_norm
        if weight > 0:
            vec[term] = weight
            norm_sq += weight * weight

    return vec, math.sqrt(norm_sq) or 1.0


def build_local_search_index() -> dict:
    """Build BM25 search index from grammar reference files (stdlib only)."""
    chunks = _build_chunks()
    if not chunks:
        return {"version": 1, "chunks": [], "n_docs": 0, "avg_dl": 1.0, "df": {}}

    all_tokens = [_tokenize(c.get("text", "") + " " + c.get("title_en", "")) for c in chunks]
    n_docs = len(chunks)
    avg_dl = sum(len(t) for t in all_tokens) / max(n_docs, 1)

    df: dict[str, int] = Counter()
    for tokens in all_tokens:
        for term in set(tokens):
            df[term] += 1

    indexed_chunks = []
    for chunk, tokens in zip(chunks, all_tokens):
        vec, norm = _bm25_vector(tokens, df, n_docs, avg_dl)
        indexed_chunks.append({
            "chunk_id": chunk.get("chunk_id", ""),
            "section_id": chunk.get("section_id", 0),
            "title_en": chunk.get("title_en", ""),
            "title_ne": chunk.get("title_ne", ""),
            "source": chunk.get("source", ""),
            "text": chunk.get("text", "")[:6000],
            "norm": norm,
            "vector": {k: round(v, 6) for k, v in vec.items()},
        })

    return {
        "version": 1,
        "n_docs": n_docs,
        "avg_dl": round(avg_dl, 4),
        "df": dict(df),
        "chunks": indexed_chunks,
    }


def _save_search_index(index: dict) -> Path:
    _SEARCH_INDEX.parent.mkdir(parents=True, exist_ok=True)
    _SEARCH_INDEX.write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    return _SEARCH_INDEX


def _load_search_index() -> dict:
    global _cached_search_index
    if _cached_search_index is not None:
        return _cached_search_index

    if _SEARCH_INDEX.exists():
        try:
            _cached_search_index = json.loads(_SEARCH_INDEX.read_text(encoding="utf-8"))
            return _cached_search_index
        except (json.JSONDecodeError, OSError):
            pass

    with _build_lock:
        if _SEARCH_INDEX.exists():
            try:
                _cached_search_index = json.loads(_SEARCH_INDEX.read_text(encoding="utf-8"))
                return _cached_search_index
            except (json.JSONDecodeError, OSError):
                pass
        index = build_local_search_index()
        if index.get("chunks"):
            _save_search_index(index)
        _cached_search_index = index
        return index


def _cosine_sparse(a: dict[str, float], a_norm: float, b: dict[str, float], b_norm: float) -> float:
    if not a or not b:
        return 0.0
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    dot = sum(v * longer.get(k, 0.0) for k, v in shorter.items())
    return dot / (a_norm * b_norm)


def _keyword_score(query: str, chunk: dict) -> float:
    query_lower = query.lower()
    tokens = set(_tokenize(query))
    if not tokens:
        return 0.0

    text = chunk.get("text", "").lower()
    title = f"{chunk.get('title_en', '')} {chunk.get('title_ne', '')}".lower()
    score = 0.0

    for token in tokens:
        if token in text:
            score += 1.0
        if token in title:
            score += 3.0
        for kw in chunk.get("keywords", []) if isinstance(chunk.get("keywords"), list) else []:
            if token in str(kw) or str(kw) in token:
                score += 2.0

    if chunk.get("section_id") in _FINANCIAL_SECTIONS:
        if re.search(r"\b(\d+|saya|hajar|lakh|paisa|udhaar|tiryo|kinyo|beche|diyo|liyo)\b", query_lower):
            score += 2.5

    # Prefer verbatim chunks for spelling-variant queries
    if "verbatim" in chunk.get("source", "") and re.search(r"\b(xa|xaina|chha|halkhabar)\b", query_lower):
        score += 1.5

    return score


def _load_index_section_hints() -> dict[int, list[str]]:
    if not _GRAMMAR_INDEX.exists():
        return {}
    try:
        data = json.loads(_GRAMMAR_INDEX.read_text(encoding="utf-8"))
        return {s["id"]: s.get("keywords", []) for s in data.get("sections", [])}
    except (json.JSONDecodeError, OSError):
        return {}


def search_nepali_grammar(query: str, k: int = 4) -> list[dict]:
    """BM25 + keyword hybrid search — no external services required."""
    index = _load_search_index()
    chunks = index.get("chunks", [])
    if not chunks:
        return []

    q_tokens = _tokenize(query)
    n_docs = index.get("n_docs", len(chunks))
    avg_dl = index.get("avg_dl", 1.0)
    df = index.get("df", {})
    q_vec, q_norm = _bm25_vector(q_tokens, df, n_docs, avg_dl)

    index_hints = _load_index_section_hints()
    scored: list[dict] = []

    for chunk in chunks:
        vec = chunk.get("vector", {})
        norm = chunk.get("norm", 1.0)
        bm25 = _cosine_sparse(q_vec, q_norm, vec, norm)

        kw_chunk = {**chunk, "keywords": index_hints.get(chunk.get("section_id", 0), [])}
        kw = _keyword_score(query, kw_chunk)

        # Hybrid: BM25 semantic-ish + keyword boost
        total = bm25 * 4.0 + kw * 0.35
        if total > 0.05:
            scored.append({
                "section_id": chunk.get("section_id", 0),
                "title_en": chunk.get("title_en", ""),
                "title_ne": chunk.get("title_ne", ""),
                "text": chunk.get("text", ""),
                "source": chunk.get("source", ""),
                "chunk_id": chunk.get("chunk_id", ""),
                "score": round(total, 4),
                "_score": total,
            })

    scored.sort(key=lambda x: x["_score"], reverse=True)

    # Deduplicate by section_id keeping best chunk per section
    seen_sections: set[int] = set()
    results: list[dict] = []
    for hit in scored:
        sid = hit.get("section_id", 0)
        if sid in seen_sections and len(results) >= k // 2:
            continue
        seen_sections.add(sid)
        results.append({key: val for key, val in hit.items() if not key.startswith("_")})
        if len(results) >= k:
            break

    return results


def get_chunks_for_sections(section_ids: list[int], max_per_section: int = 1) -> list[dict]:
    """Return best chunk per section from the local search index."""
    if not section_ids:
        return []

    index = _load_search_index()
    chunks = index.get("chunks", [])
    if not chunks:
        return []

    want = set(section_ids)
    by_section: dict[int, list[dict]] = {}
    for chunk in chunks:
        sid = chunk.get("section_id", 0)
        if sid in want:
            by_section.setdefault(sid, []).append(chunk)

    results: list[dict] = []
    for sid in section_ids:
        candidates = by_section.get(sid, [])
        if not candidates:
            continue
        # Prefer verbatim sources with more keyword overlap potential
        candidates.sort(
            key=lambda c: (1 if "verbatim" in c.get("source", "") else 0, len(c.get("text", ""))),
            reverse=True,
        )
        for chunk in candidates[:max_per_section]:
            results.append({
                "section_id": chunk.get("section_id", 0),
                "title_en": chunk.get("title_en", ""),
                "title_ne": chunk.get("title_ne", ""),
                "text": chunk.get("text", ""),
                "source": chunk.get("source", ""),
                "chunk_id": chunk.get("chunk_id", ""),
                "score": 0.0,
            })
    return results


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
        if len(body) > 2500:
            body = body[:2500] + "\n...(section truncated)..."
        src = hit.get("source", "")
        src_tag = f" [{src}]" if src else ""
        lines.append(f"--- Section {sid}: {title}{src_tag} ---")
        lines.append(body)
        lines.append("")

    return "\n".join(lines)


def ingest_nepali_grammar() -> dict:
    """Build local BM25 search index — no ChromaDB or Ollama required."""
    global _cached_search_index, _cached_sections
    _cached_sections = None
    _cached_search_index = None

    if not grammar_reference_exists():
        return {"status": "error", "message": f"Grammar reference not found: {_GRAMMAR_TXT}"}

    index = build_local_search_index()
    if not index.get("chunks"):
        return {"status": "error", "message": "No chunks indexed"}

    path = _save_search_index(index)
    _cached_search_index = index

    return {
        "status": "indexed",
        "engine": "local_bm25",
        "chunks": len(index["chunks"]),
        "index_path": str(path),
        "sources": [
            str(_GRAMMAR_TXT.name),
            str(_GRAMMAR_VERBATIM.name) if _GRAMMAR_VERBATIM.exists() else None,
            str(_GRAMMAR_VERBATIM_PART2.name) if _GRAMMAR_VERBATIM_PART2.exists() else None,
            str(_GRAMMAR_VERBATIM_PART3.name) if _GRAMMAR_VERBATIM_PART3.exists() else None,
        ],
    }


def get_nepali_grammar_count() -> int:
    index = _load_search_index()
    return len(index.get("chunks", []))


def grammar_reference_exists() -> bool:
    return (
        _GRAMMAR_TXT.exists()
        or _GRAMMAR_VERBATIM.exists()
        or _GRAMMAR_VERBATIM_PART2.exists()
        or _GRAMMAR_VERBATIM_PART3.exists()
    )
