"""
Tiered knowledge registry — load segmented files, score by task, resolve conflicts.

Hierarchy:
  general (language, plain concepts) < professional (standards, legal)

Task-aware boost:
  compliance_qa → legal-compliance wins
  framework_qa / accounting_qa → accounting-standards wins
  language / NLU → general.language wins
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..config import ERP_PATH

logger = logging.getLogger(__name__)

KNOWLEDGE_ROOT = ERP_PATH / "data" / "ekhata" / "knowledge"
REGISTRY_PATH = KNOWLEDGE_ROOT / "_registry.json"

# Map conversation route modes → registry task keys
ROUTE_TO_TASK: dict[str, str] = {
    "journal_entry": "journal_entry",
    "accounting_qa": "accounting_qa",
    "framework_qa": "framework_qa",
    "compliance_qa": "compliance_qa",
    "education": "education",
    "report": "accounting_qa",
    "correction": "journal_entry",
    "casual": "casual",
    "external_fact": "casual",
    "language": "language",
    "nlu": "nlu",
}


@dataclass
class KnowledgeChunk:
    id: str
    content: str
    segment: str
    title: str = ""
    language: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    source: str = ""
    effective_from: str = ""
    supersedes: list[str] = field(default_factory=list)
    authority: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_rag_doc(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "text": self.content if not self.title else f"{self.title}\n{self.content}",
            "metadata": {
                "segment": self.segment,
                "authority": self.authority,
                "source": self.source,
                "tags": self.tags,
                "language": self.language,
                **self.metadata,
            },
        }


_registry_cache: dict[str, Any] | None = None
_chunks_cache: list[KnowledgeChunk] | None = None


def load_registry() -> dict[str, Any]:
    global _registry_cache
    if _registry_cache is not None:
        return _registry_cache
    if not REGISTRY_PATH.exists():
        _registry_cache = {"segments": {}, "conflict_rules": []}
        return _registry_cache
    _registry_cache = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return _registry_cache


def _segment_config(segment_id: str) -> dict[str, Any]:
    return load_registry().get("segments", {}).get(segment_id, {})


def authority_score(segment_id: str, task: str = "accounting_qa") -> float:
    """Compute authority for segment given task type."""
    cfg = _segment_config(segment_id)
    if not cfg:
        # Unknown segment — treat as weak general
        if segment_id.startswith("professional"):
            return 60.0
        return 15.0
    base = float(cfg.get("base_authority", 20))
    boost = float(cfg.get("task_boost", {}).get(task, 0))
    use_for = cfg.get("use_for") or []
    if task in use_for:
        boost += 5
    tier = cfg.get("tier", "general")
    if tier == "professional":
        base += 5
    return base + boost


def _parse_chunk(raw: dict[str, Any], default_segment: str) -> KnowledgeChunk | None:
    content = (raw.get("content") or raw.get("text") or "").strip()
    chunk_id = raw.get("id") or raw.get("chunk_id")
    if not content or not chunk_id:
        return None
    segment = raw.get("segment") or default_segment
    lang = raw.get("language") or []
    if isinstance(lang, str):
        lang = [lang]
    tags = raw.get("tags") or []
    if isinstance(tags, str):
        tags = [tags]
    return KnowledgeChunk(
        id=str(chunk_id),
        content=content,
        segment=segment,
        title=str(raw.get("title") or ""),
        language=lang,
        tags=tags,
        source=str(raw.get("source") or ""),
        effective_from=str(raw.get("effective_from") or ""),
        supersedes=list(raw.get("supersedes") or []),
        metadata={k: v for k, v in raw.items() if k not in {
            "id", "content", "text", "segment", "title", "language", "tags",
            "source", "effective_from", "supersedes", "chunk_id",
        }},
    )


def _load_jsonl(path: Path, default_segment: str) -> list[KnowledgeChunk]:
    chunks: list[KnowledgeChunk] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            raw = json.loads(line)
            c = _parse_chunk(raw, default_segment)
            if c:
                chunks.append(c)
        except json.JSONDecodeError as exc:
            logger.warning("Bad JSONL line in %s: %s", path, exc)
    return chunks


def _load_json_file(path: Path, default_segment: str) -> list[KnowledgeChunk]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        rows = data
    elif isinstance(data, dict):
        if "chunks" in data:
            rows = data["chunks"]
        else:
            # Legacy conceptual framework shape
            rows = []
            for key in ("paragraphs", "tables", "glossary", "chapterTexts", "sections"):
                for i, item in enumerate(data.get(key, [])):
                    text = item.get("text") or item.get("definition") or ""
                    if text:
                        rows.append({
                            "id": item.get("id", f"{key}-{i}"),
                            "content": text,
                            "segment": default_segment,
                            "source": "conceptual-framework",
                        })
    else:
        return []
    out: list[KnowledgeChunk] = []
    for raw in rows:
        if isinstance(raw, dict):
            c = _parse_chunk(raw, default_segment)
            if c:
                out.append(c)
    return out


def _segment_from_path(rel: Path) -> str:
    """Map folder path to segment id: general/language/nepali → general.language.nepali"""
    parts = rel.parts
    if not parts:
        return "general.accounting-concepts"
    return ".".join(parts)


def load_all_chunks(*, force_reload: bool = False) -> list[KnowledgeChunk]:
    global _chunks_cache
    if _chunks_cache is not None and not force_reload:
        return _chunks_cache

    registry = load_registry()
    segments = registry.get("segments", {})
    path_to_segment = {cfg["path"]: seg_id for seg_id, cfg in segments.items() if cfg.get("path")}

    chunks: list[KnowledgeChunk] = []
    superseded: set[str] = set()

    if KNOWLEDGE_ROOT.exists():
        for path in sorted(KNOWLEDGE_ROOT.rglob("*")):
            if path.name.startswith("_") or path.name == "HOW_TO_ADD.md":
                continue
            if path.suffix not in (".jsonl", ".json"):
                continue
            rel = path.relative_to(KNOWLEDGE_ROOT).parent
            rel_str = str(rel).replace("\\", "/")
            default_seg = path_to_segment.get(rel_str) or _segment_from_path(rel)

            if path.suffix == ".jsonl":
                chunks.extend(_load_jsonl(path, default_seg))
            else:
                chunks.extend(_load_json_file(path, default_seg))

    # Legacy imports
    data_dir = ERP_PATH / "data" / "ekhata"
    legacy = registry.get("legacy_sources", {})
    cf = data_dir / "conceptual-framework-knowledge.json"
    if cf.exists() and "conceptual-framework-knowledge.json" in legacy:
        seg = legacy["conceptual-framework-knowledge.json"]
        for c in _load_json_file(cf, seg):
            if not any(x.id == c.id for x in chunks):
                chunks.append(c)

    grammar_idx = data_dir / "nepali-grammar-index.json"
    if grammar_idx.exists() and grammar_idx.name in legacy:
        seg = legacy.get("nepali-grammar-index.json", "general.language.nepali")
        try:
            gdata = json.loads(grammar_idx.read_text(encoding="utf-8"))
            for i, item in enumerate(gdata if isinstance(gdata, list) else gdata.get("entries", [])):
                text = item.get("text") or item.get("rule") or ""
                if text:
                    chunks.append(
                        KnowledgeChunk(
                            id=item.get("id", f"grammar-{i}"),
                            content=text,
                            segment=seg,
                            title=item.get("title", ""),
                            source="nepali-grammar-index",
                        )
                    )
        except Exception as exc:
            logger.warning("Grammar index load failed: %s", exc)

    for c in chunks:
        superseded.update(c.supersedes)

    active = [c for c in chunks if c.id not in superseded]
    _chunks_cache = active
    logger.info("Loaded %d knowledge chunks (%d superseded)", len(active), len(superseded))
    return active


def _chunk_matches_query(chunk: KnowledgeChunk, query: str) -> float:
    """Cheap relevance score 0–1."""
    q = query.lower()
    text = f"{chunk.title} {chunk.content} {' '.join(chunk.tags)}".lower()
    if not q.strip():
        return 0.0
    score = 0.0
    for token in re.findall(r"[\w\u0900-\u097F]+", q):
        if len(token) < 2:
            continue
        if token in text:
            score += 1.0
    # Phrase bonus
    if len(q) > 4 and q in text:
        score += 3.0
    return score


def _apply_conflict_rules(chunks: list[KnowledgeChunk], task: str) -> list[KnowledgeChunk]:
    """Prefer authoritative segment prefix per task."""
    registry = load_registry()
    prefer_prefix: str | None = None
    for rule in registry.get("conflict_rules", []):
        when = rule.get("when_task") or []
        if task in when or (task == "casual" and "language" in when):
            prefer_prefix = rule.get("prefer_segment_prefix")
            break

    if not prefer_prefix:
        return chunks

    preferred = [c for c in chunks if c.segment.startswith(prefer_prefix)]
    if preferred:
        # Keep top preferred + fill with others if needed
        other = [c for c in chunks if c not in preferred]
        return preferred + other[: max(0, 5 - len(preferred))]
    return chunks


_tiered_search_cache: dict[tuple[str, str, int, float], list[KnowledgeChunk]] = {}
_TIERED_CACHE_MAX = 64


def search_tiered_knowledge(
    query: str,
    *,
    task: str = "accounting_qa",
    top_k: int = 6,
    min_relevance: float = 0.5,
    sector_profile: str | None = None,
    session_sector: Any = None,
) -> list[KnowledgeChunk]:
    """
    Search all segments, rank by relevance × authority, resolve conflicts.
    Professional beats general when scores are close.
    """
    from .sector_profile import compute_sector_boost, effective_sector_profile

    active_sector = effective_sector_profile(
        sector_profile=sector_profile,
        query=query,
        session_sector=session_sector,
    )

    cache_key = (query.strip().lower(), task, top_k, min_relevance)
    if cache_key in _tiered_search_cache:
        return _tiered_search_cache[cache_key]

    chunks = load_all_chunks()
    scored: list[tuple[float, KnowledgeChunk]] = []

    for c in chunks:
        rel = _chunk_matches_query(c, query)
        if rel < min_relevance:
            continue
        auth = authority_score(c.segment, task)
        c.authority = auth
        sector_boost = compute_sector_boost(c, active_sector, task=task)
        # Combined score: relevance + authority + sector profile
        combined = rel * 2.0 + auth * 0.15 + sector_boost * 0.35
        scored.append((combined, c))

    scored.sort(key=lambda x: -x[0])
    top = [c for _, c in scored[: top_k * 2]]
    resolved = _apply_conflict_rules(top, task)
    result = resolved[:top_k]
    if len(_tiered_search_cache) >= _TIERED_CACHE_MAX:
        _tiered_search_cache.pop(next(iter(_tiered_search_cache)))
    _tiered_search_cache[cache_key] = result
    return result


def format_tiered_context(
    query: str,
    *,
    task: str = "accounting_qa",
    max_chars: int = 2500,
) -> str:
    """Format retrieved chunks for LLM prompt with source labels."""
    hits = search_tiered_knowledge(query, task=task)
    if not hits:
        return ""

    parts = [f"[TIERED KNOWLEDGE — task={task}, professional > general on conflict]"]
    for c in hits:
        cfg = _segment_config(c.segment)
        label = cfg.get("label") or c.segment
        header = f"[{label} | authority={c.authority:.0f}]"
        if c.source:
            header += f" (source: {c.source})"
        body = f"{c.title}\n{c.content}".strip() if c.title else c.content
        parts.append(f"{header}\n{body}")

    text = "\n\n".join(parts)
    return text[:max_chars] if len(text) > max_chars else text


def chunks_to_rag_documents() -> list[dict[str, Any]]:
    """All active chunks as RAG index documents."""
    return [c.to_rag_doc() for c in load_all_chunks()]


def segment_for_new_content(content_type: str) -> str:
    """
    Helper for agents when user uploads info — suggest segment path.

    content_type: nepali | english | romanized | general_accounting |
                  conceptual_framework | nfrs | nfrs_sme | nas_micro |
                  vat | income_tax | ssf | nrb | coa
    """
    mapping = {
        "nepali": "general.language.nepali",
        "english": "general.language.english",
        "romanized": "general.language.romanized",
        "general_accounting": "general.accounting-concepts",
        "conceptual_framework": "professional.accounting-standards.conceptual-framework",
        "nfrs": "professional.accounting-standards.nfrs",
        "nfrs_sme": "professional.accounting-standards.nfrs-sme",
        "nas_micro": "professional.accounting-standards.nas-micro",
        "vat": "professional.legal-compliance.vat",
        "income_tax": "professional.legal-compliance.income-tax",
        "ssf": "professional.legal-compliance.ssf",
        "nrb": "professional.legal-compliance.nrb",
        "coa": "professional.sector.coa",
    }
    return mapping.get(content_type, "general.accounting-concepts")


def write_chunk_file(
    segment: str,
    chunk: dict[str, Any],
    *,
    filename: str | None = None,
) -> Path:
    """
    Append one chunk to the correct segment folder (for agent ingestion).
    """
    registry = load_registry()
    cfg = registry.get("segments", {}).get(segment)
    if not cfg:
        raise ValueError(f"Unknown segment: {segment}")

    folder = KNOWLEDGE_ROOT / cfg["path"]
    folder.mkdir(parents=True, exist_ok=True)
    chunk.setdefault("segment", segment)
    if not chunk.get("id"):
        raise ValueError("chunk must have id")

    fname = filename or f"{chunk['id']}.jsonl"
    if not fname.endswith(".jsonl"):
        fname += ".jsonl"
    path = folder / fname

    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(chunk, ensure_ascii=False) + "\n")

    global _chunks_cache
    _chunks_cache = None
    return path
