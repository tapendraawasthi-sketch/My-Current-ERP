"""Orbix Nepali Language KB runtime adapter.

Extends existing NLU/Orbix retrieval without granting posting authority.
Enabled by default (owner-attested); set ORBIX_NP_KB_ENABLED=false to disable.
"""

from __future__ import annotations

import logging
import os
import re
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

logger = logging.getLogger(__name__)

DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
PROTECTED_TOKEN_RE = re.compile(
    r"\b(?:PAN|VAT|TDS|IRD|NPR|NRs?|SKU|PO|INV|JV|//|[A-Z]{2,}\d{2,}|\d{5,})\b"
    r"|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
    r"|\b\d{1,3}(?:,\d{2,3})+(?:\.\d+)?\b",
    re.IGNORECASE,
)


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _resolve_kb_root(root_env: str = "") -> Path:
    """Resolve knowledgebase root for local monorepo and Render (erp_bot rootDir)."""
    here = Path(__file__).resolve()
    erp_bot_root = here.parents[2]
    monorepo_root = here.parents[3] if len(here.parents) > 3 else Path.cwd()
    candidates: list[Path] = []
    if root_env:
        raw = Path(root_env)
        if raw.is_absolute():
            candidates.append(raw)
        else:
            candidates.extend(
                [
                    erp_bot_root / root_env,
                    Path.cwd() / root_env,
                    monorepo_root / root_env,
                ]
            )
    candidates.extend(
        [
            erp_bot_root / "knowledgebase",  # bundled on Render
            monorepo_root / "knowledgebase",  # local monorepo
        ]
    )
    for candidate in candidates:
        if (candidate / "indexes" / "lexical" / "kb_lexical.sqlite").exists():
            return candidate
    return candidates[0] if candidates else (monorepo_root / "knowledgebase")


@dataclass
class NpKbConfig:
    enabled: bool = False
    root: Path = field(default_factory=lambda: _resolve_kb_root())
    lexical_enabled: bool = True
    semantic_enabled: bool = False
    lexical_top_k: int = 8
    semantic_top_k: int = 8
    min_quality_score: float = 0.35
    review_policy: str = "development_all"
    citations_enabled: bool = True

    @classmethod
    def from_env(cls) -> "NpKbConfig":
        root_env = os.environ.get("ORBIX_NP_KB_ROOT", "").strip()
        root = _resolve_kb_root(root_env)
        policy = os.environ.get("ORBIX_NP_KB_REVIEW_POLICY", "development_all").strip()
        if policy not in {"reviewed_only", "reviewed_and_generated", "development_all"}:
            policy = "development_all"
        return cls(
            enabled=_bool_env("ORBIX_NP_KB_ENABLED", True),
            root=root,
            lexical_enabled=_bool_env("ORBIX_NP_KB_LEXICAL_ENABLED", True),
            semantic_enabled=_bool_env("ORBIX_NP_KB_SEMANTIC_ENABLED", False),
            lexical_top_k=int(os.environ.get("ORBIX_NP_KB_LEXICAL_TOP_K", "8")),
            semantic_top_k=int(os.environ.get("ORBIX_NP_KB_SEMANTIC_TOP_K", "8")),
            min_quality_score=float(os.environ.get("ORBIX_NP_KB_MIN_QUALITY_SCORE", "0.35")),
            review_policy=policy,
            citations_enabled=_bool_env("ORBIX_NP_KB_CITATIONS_ENABLED", True),
        )


@dataclass
class ScriptDetection:
    has_devanagari: bool
    has_latin: bool
    language_form: str
    protected_tokens: list[str]


@dataclass
class KbCitation:
    record_id: str
    source_file_id: str | None
    source_filename: str | None
    source_line_start: int | None
    source_line_end: int | None
    domain: str | None
    record_type: str | None
    quality_score: float | None
    review_status: str | None
    safety_labels: list[str]
    content: str
    score: float
    retrieval_collection: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "record_id": self.record_id,
            "source_file_id": self.source_file_id,
            "source_filename": self.source_filename,
            "source_line_range": [self.source_line_start, self.source_line_end],
            "domain": self.domain,
            "record_type": self.record_type,
            "retrieval_collection": self.retrieval_collection,
            "quality_score": self.quality_score,
            "review_status": self.review_status,
            "safety_labels": self.safety_labels,
            "content": self.content[:500],
            "score": self.score,
        }


@dataclass
class NpKbInterpretResult:
    enabled: bool
    skipped_reason: str | None = None
    script: ScriptDetection | None = None
    normalized_text: str | None = None
    citations: list[KbCitation] = field(default_factory=list)
    observability: dict[str, Any] = field(default_factory=dict)
    # Knowledge never authorizes execution:
    execution_allowed: bool = False
    interpretation_only: bool = True

    def to_optional_metadata(self) -> dict[str, Any]:
        """Backward-compatible optional payload for SSE/chat responses."""
        if not self.enabled:
            return {"np_kb": {"enabled": False, "reason": self.skipped_reason}}
        return {
            "np_kb": {
                "enabled": True,
                "interpretation_only": True,
                "execution_allowed": False,
                "language_form": self.script.language_form if self.script else None,
                "protected_tokens": self.script.protected_tokens if self.script else [],
                "normalized_text": self.normalized_text,
                "citations": [c.to_dict() for c in self.citations]
                if self.observability.get("citations_enabled", True)
                else [],
                "observability": self.observability,
            }
        }


def detect_script_and_tokens(text: str) -> ScriptDetection:
    has_dev = bool(DEVANAGARI_RE.search(text or ""))
    has_latin = bool(re.search(r"[A-Za-z]", text or ""))
    tokens = list(dict.fromkeys(PROTECTED_TOKEN_RE.findall(text or "")))
    if has_dev and has_latin:
        form = "mixed_script"
    elif has_dev:
        form = "devanagari_nepali"
    elif has_latin:
        form = "romanized_or_english"
    else:
        form = "unknown"
    return ScriptDetection(
        has_devanagari=has_dev,
        has_latin=has_latin,
        language_form=form,
        protected_tokens=tokens,
    )


def protect_tokens(text: str) -> tuple[str, dict[str, str]]:
    mapping: dict[str, str] = {}
    counter = 0

    def _sub(m: re.Match[str]) -> str:
        nonlocal counter
        key = f"__PROT_{counter}__"
        counter += 1
        mapping[key] = m.group(0)
        return key

    return PROTECTED_TOKEN_RE.sub(_sub, text), mapping


def restore_tokens(text: str, mapping: dict[str, str]) -> str:
    out = text
    for key, val in mapping.items():
        out = out.replace(key, val)
    return out


def lightweight_normalize(text: str) -> str:
    """Local normalize that preserves protected tokens. Does not call network."""
    try:
        from .text_normalize import normalize_accounting_text as _normalize
    except Exception:
        def _normalize(value: str) -> str:
            return re.sub(r"\s+", " ", (value or "").strip())

    protected, mapping = protect_tokens(text)
    norm = _normalize(protected)
    return restore_tokens(norm, mapping)


_FTS_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "the",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "do",
        "does",
        "did",
        "you",
        "your",
        "me",
        "my",
        "we",
        "our",
        "it",
        "its",
        "this",
        "that",
        "these",
        "those",
        "what",
        "which",
        "who",
        "whom",
        "how",
        "why",
        "when",
        "where",
        "about",
        "with",
        "from",
        "into",
        "for",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "at",
        "as",
        "by",
        "can",
        "could",
        "would",
        "should",
        "please",
        "tell",
        "explain",
        "understand",
        "know",
        "mean",
        "meaning",
        "means",
    }
)


def _sanitize_fts_query(query: str) -> str:
    """Build an FTS5 query with OR tokens for recall; drop English stopwords."""
    cleaned = re.sub(r"[^\w\u0900-\u097F\s]", " ", query or "", flags=re.UNICODE)
    raw_tokens = [t for t in cleaned.split() if t]
    if not raw_tokens:
        return ""
    kept = [t for t in raw_tokens if t.lower() not in _FTS_STOPWORDS]
    if not kept:
        # All-stopword queries (e.g. "do you understand it") must not FTS-blast;
        # prompt_grounding applies language fallback seeds when appropriate.
        return ""
    tokens = kept
    # Quote tokens that are purely alphanumeric to avoid FTS operator issues.
    parts: list[str] = []
    for t in tokens[:24]:
        if re.fullmatch(r"[\w\u0900-\u097F]+", t, flags=re.UNICODE):
            parts.append(t)
        else:
            parts.append(f'"{t}"')
    if len(parts) == 1:
        return parts[0]
    return " OR ".join(parts)


def _lookup_overlay_status(metadata_db: Path | None, record_id: str) -> str | None:
    if not metadata_db or not metadata_db.exists():
        return None
    try:
        conn = sqlite3.connect(str(metadata_db))
        row = conn.execute(
            "SELECT review_status FROM kb_review_overlays WHERE record_id = ?",
            (record_id,),
        ).fetchone()
        if row:
            conn.close()
            return row[0]
        row = conn.execute(
            "SELECT review_status FROM kb_records WHERE record_id = ?",
            (record_id,),
        ).fetchone()
        conn.close()
        return row[0] if row else None
    except sqlite3.Error:
        return None


class NpKbLexicalRetriever:
    def __init__(self, lexical_db: Path, metadata_db: Path | None = None) -> None:
        self.lexical_db = lexical_db
        self.metadata_db = metadata_db
        if metadata_db is None:
            candidate = lexical_db.parent.parent / "metadata" / "kb_metadata.sqlite"
            self.metadata_db = candidate if candidate.exists() else None

    def _overlay_status(self, record_id: str) -> str | None:
        return _lookup_overlay_status(self.metadata_db, record_id)

    def search(
        self,
        query: str,
        *,
        top_k: int = 8,
        min_quality: float = 0.0,
        review_policy: str = "development_all",
        include_eval: bool = False,
        allowed_collections: frozenset[str] | None = None,
        blocked_collections: frozenset[str] | None = None,
    ) -> list[KbCitation]:
        if not self.lexical_db.exists():
            return []
        # MAI-24: evaluation corpus never joins production grounding path.
        include_eval = False
        blocked = set(blocked_collections or ())
        blocked.add("evaluation_only")
        q = _sanitize_fts_query(query)
        if not q:
            return []
        conn = sqlite3.connect(str(self.lexical_db))
        conn.row_factory = sqlite3.Row
        try:
            sql = """
                SELECT record_id, retrieval_collection, record_type, domain,
                       source_file_id, source_filename, source_line_start, source_line_end,
                       quality_score, review_status, safety_labels, content_text,
                       bm25(prod_fts) AS rank
                FROM prod_fts
                WHERE prod_fts MATCH ?
                ORDER BY rank
                LIMIT ?
            """
            rows = list(conn.execute(sql, (q, top_k * 5)))
            if include_eval:
                rows += list(
                    conn.execute(
                        sql.replace("prod_fts", "eval_fts"),
                        (q, top_k),
                    )
                )
        except sqlite3.OperationalError as exc:
            logger.warning("NP KB FTS query failed: %s", exc)
            return []
        finally:
            conn.close()

        citations: list[KbCitation] = []
        for row in rows:
            coll = str(row["retrieval_collection"] or "")
            if coll in blocked:
                continue
            if allowed_collections is not None and coll not in allowed_collections:
                continue
            qs = row["quality_score"]
            if qs is not None and qs < min_quality:
                continue
            review = self._overlay_status(row["record_id"]) or row["review_status"] or "unreviewed"
            if review_policy == "reviewed_only" and review not in {
                "approved",
                "reviewed",
                "gold",
            }:
                continue
            if review_policy == "reviewed_and_generated" and review in {
                "rejected",
                "blocked",
            }:
                continue
            labels = [
                x for x in str(row["safety_labels"] or "").split(",") if x
            ]
            citations.append(
                KbCitation(
                    record_id=row["record_id"],
                    source_file_id=row["source_file_id"],
                    source_filename=row["source_filename"],
                    source_line_start=row["source_line_start"],
                    source_line_end=row["source_line_end"],
                    domain=row["domain"],
                    record_type=row["record_type"],
                    quality_score=qs,
                    review_status=review,
                    safety_labels=labels,
                    content=row["content_text"] or "",
                    score=float(row["rank"] or 0.0),
                    retrieval_collection=coll or None,
                )
            )
            if len(citations) >= top_k:
                break
        return citations


class NpKbSemanticRetriever:
    """Optional Chroma+Ollama semantic search. Never overrides safety policy."""

    def __init__(self, semantic_dir: Path, metadata_db: Path | None = None) -> None:
        self.semantic_dir = semantic_dir
        self.metadata_db = metadata_db

    def _embed(self, text: str, model: str = "nomic-embed-text") -> list[float] | None:
        import json
        import urllib.request

        req = urllib.request.Request(
            "http://localhost:11434/api/embeddings",
            data=json.dumps({"model": model, "prompt": text[:4000]}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            vec = data.get("embedding")
            return vec if isinstance(vec, list) else None
        except Exception as exc:
            logger.debug("semantic embed unavailable: %s", exc)
            return None

    def search(
        self,
        query: str,
        *,
        top_k: int = 8,
        review_policy: str = "development_all",
    ) -> list[KbCitation]:
        chroma_path = self.semantic_dir / "chroma"
        if not chroma_path.exists():
            return []
        try:
            import chromadb
        except ImportError:
            return []
        vec = self._embed(query)
        if not vec:
            return []
        try:
            client = chromadb.PersistentClient(path=str(chroma_path))
            collection = client.get_or_create_collection(name="onli_np_kb_prod")
            result = collection.query(query_embeddings=[vec], n_results=top_k)
        except Exception as exc:
            logger.debug("semantic query failed: %s", exc)
            return []

        ids = (result.get("ids") or [[]])[0]
        docs = (result.get("documents") or [[]])[0]
        metas = (result.get("metadatas") or [[]])[0]
        dists = (result.get("distances") or [[]])[0]
        citations: list[KbCitation] = []
        for i, rid in enumerate(ids):
            meta = metas[i] if i < len(metas) else {}
            review = _lookup_overlay_status(self.metadata_db, rid) or "unreviewed"
            if review_policy == "reviewed_only" and review not in {
                "approved",
                "reviewed",
                "gold",
            }:
                continue
            if review_policy == "reviewed_and_generated" and review in {
                "rejected",
                "blocked",
            }:
                continue
            dist = float(dists[i]) if i < len(dists) else 0.0
            citations.append(
                KbCitation(
                    record_id=rid,
                    source_file_id=str((meta or {}).get("source_file_id") or "") or None,
                    source_filename=None,
                    source_line_start=None,
                    source_line_end=None,
                    domain=None,
                    record_type=str((meta or {}).get("record_type") or "") or None,
                    quality_score=None,
                    review_status=review,
                    safety_labels=["semantic_hit"],
                    content=docs[i] if i < len(docs) else "",
                    score=-dist,
                    retrieval_collection=str(
                        (meta or {}).get("retrieval_collection") or ""
                    )
                    or None,
                )
            )
        return citations


def _merge_citations(
    lexical: list[KbCitation],
    semantic: list[KbCitation],
    *,
    top_k: int,
) -> list[KbCitation]:
    """Prefer lexical for safety/authority; use semantic as filler only."""
    by_id: dict[str, KbCitation] = {}
    for c in lexical:
        by_id[c.record_id] = c
    for c in semantic:
        if c.record_id not in by_id:
            by_id[c.record_id] = c
    # preserve lexical order first
    ordered = list(lexical)
    for c in semantic:
        if all(x.record_id != c.record_id for x in ordered):
            ordered.append(c)
    return ordered[:top_k]


def interpret_user_text(
    text: str,
    *,
    cfg: NpKbConfig | None = None,
    knowledge_source_governance: Mapping[str, Any] | None = None,
    lexical_index: Mapping[str, Any] | None = None,
    vector_index: Mapping[str, Any] | None = None,
    hybrid_fusion: Mapping[str, Any] | None = None,
    allow_non_prod_semantic: bool | None = None,
) -> NpKbInterpretResult:
    """Main adapter entry: detect → protect → normalize → retrieve → cite.

    Never posts transactions. execution_allowed is always False from KB path.
    MAI-24: optional knowledge_source_governance filters collections / skips OOD.
    MAI-27: optional lexical_index prefers SQLITE FTS and forces semantic off.
    MAI-28: optional non-prod semantic filler only when explicitly allow-listed.
    MAI-29: optional RRF / evidence candidates from hybrid_fusion policy.
    """
    from dataclasses import replace

    cfg = cfg or NpKbConfig.from_env()
    obs: dict[str, Any] = {
        "citations_enabled": cfg.citations_enabled,
        "review_policy": cfg.review_policy,
    }
    if not cfg.enabled:
        return NpKbInterpretResult(
            enabled=False,
            skipped_reason="ORBIX_NP_KB_ENABLED is false",
            observability=obs,
        )

    gov = (
        knowledge_source_governance
        if isinstance(knowledge_source_governance, Mapping)
        else None
    )
    lex = lexical_index if isinstance(lexical_index, Mapping) else None
    vec = vector_index if isinstance(vector_index, Mapping) else None
    hyb = hybrid_fusion if isinstance(hybrid_fusion, Mapping) else None
    semantic_requested = bool(cfg.semantic_enabled)
    try:
        from src.oip.modules.conversation.application.knowledge_source_governance_service import (
            filter_citations_by_governance,
            resolve_allowed_collections,
            resolve_blocked_collections,
            should_skip_retrieval_for_governance,
        )
    except Exception:  # noqa: BLE001
        filter_citations_by_governance = None  # type: ignore[assignment]
        resolve_allowed_collections = None  # type: ignore[assignment]
        resolve_blocked_collections = None  # type: ignore[assignment]
        should_skip_retrieval_for_governance = None  # type: ignore[assignment]

    try:
        from src.oip.modules.conversation.application.lexical_index_service import (
            resolve_lexical_retrieval_mode,
            should_block_retrieval_for_lexical_index,
            should_prefer_lexical_retrieval,
        )
    except Exception:  # noqa: BLE001
        resolve_lexical_retrieval_mode = None  # type: ignore[assignment]
        should_block_retrieval_for_lexical_index = None  # type: ignore[assignment]
        should_prefer_lexical_retrieval = None  # type: ignore[assignment]

    try:
        from src.oip.modules.conversation.application.vector_index_service import (
            resolve_vector_retrieval_mode,
            should_allow_non_prod_semantic_consume,
            should_force_semantic_off_for_vector_policy,
        )
    except Exception:  # noqa: BLE001
        resolve_vector_retrieval_mode = None  # type: ignore[assignment]
        should_allow_non_prod_semantic_consume = None  # type: ignore[assignment]
        should_force_semantic_off_for_vector_policy = None  # type: ignore[assignment]

    if (
        should_skip_retrieval_for_governance is not None
        and should_skip_retrieval_for_governance(gov)
    ):
        obs["governance_skip"] = True
        return NpKbInterpretResult(
            enabled=False,
            skipped_reason="GOVERNANCE_SKIP",
            observability=obs,
        )

    if (
        should_block_retrieval_for_lexical_index is not None
        and should_block_retrieval_for_lexical_index(lex)
    ):
        obs["lexical_index_blocked"] = True
        obs["retrieval_mode"] = (
            resolve_lexical_retrieval_mode(lex)
            if resolve_lexical_retrieval_mode is not None
            else "BLOCKED"
        )
        return NpKbInterpretResult(
            enabled=False,
            skipped_reason="LEXICAL_INDEX_NOT_READY",
            observability=obs,
        )

    if (
        should_prefer_lexical_retrieval is not None
        and should_prefer_lexical_retrieval(lex)
    ):
        cfg = replace(cfg, lexical_enabled=True, semantic_enabled=False)
        obs["lexical_preferred"] = True
        obs["semantic_forced_off"] = True
        obs["retrieval_mode"] = "LEXICAL_ONLY"
        obs["ollama_required"] = False
        obs["vector_backend_required"] = False
        obs["citations_verified"] = False

    # MAI-28: vector annotation present → semantic only via explicit non-prod gate.
    if (
        should_force_semantic_off_for_vector_policy is not None
        and should_force_semantic_off_for_vector_policy(
            vec,
            semantic_enabled_requested=semantic_requested,
            allow_non_prod_semantic=allow_non_prod_semantic,
        )
    ):
        cfg = replace(cfg, lexical_enabled=True, semantic_enabled=False)
        obs["semantic_blocked_by_vector_policy"] = True
        obs["production_eligible"] = False
        obs["lexical_authoritative"] = True
        if resolve_vector_retrieval_mode is not None:
            obs["vector_retrieval_mode"] = resolve_vector_retrieval_mode(
                vec,
                semantic_enabled_requested=semantic_requested,
                allow_non_prod_semantic=allow_non_prod_semantic,
            )

    if (
        should_allow_non_prod_semantic_consume is not None
        and should_allow_non_prod_semantic_consume(
            vec,
            semantic_enabled_requested=semantic_requested,
            allow_non_prod_semantic=allow_non_prod_semantic,
        )
    ):
        cfg = replace(cfg, lexical_enabled=True, semantic_enabled=True)
        obs["semantic_non_prod_filler"] = True
        obs["semantic_forced_off"] = False
        obs["lexical_authoritative"] = True
        obs["production_eligible"] = False
        obs["ollama_required"] = True
        obs["citations_verified"] = False
        obs["retrieval_mode"] = "LEXICAL_PLUS_NON_PROD_SEMANTIC"
        if resolve_vector_retrieval_mode is not None:
            obs["vector_retrieval_mode"] = resolve_vector_retrieval_mode(
                vec,
                semantic_enabled_requested=semantic_requested,
                allow_non_prod_semantic=allow_non_prod_semantic,
            )

    allowed_collections = (
        resolve_allowed_collections(gov)
        if resolve_allowed_collections is not None
        else None
    )
    blocked_collections = (
        resolve_blocked_collections(gov)
        if resolve_blocked_collections is not None
        else frozenset({"evaluation_only"})
    )

    t0 = time.perf_counter()
    script = detect_script_and_tokens(text or "")
    t1 = time.perf_counter()
    normalized = lightweight_normalize(text or "")
    t2 = time.perf_counter()

    lexical_hits: list[KbCitation] = []
    semantic_hits: list[KbCitation] = []
    retrieval_ms = 0.0
    semantic_ms = 0.0
    if cfg.lexical_enabled:
        lexical_db = cfg.root / "indexes" / "lexical" / "kb_grounding.sqlite"
        if not lexical_db.exists():
            lexical_db = cfg.root / "indexes" / "lexical" / "kb_lexical.sqlite"
        if not lexical_db.exists():
            lexical_db = Path(cfg.root) / "indexes" / "lexical" / "kb_lexical.sqlite"
        retriever = NpKbLexicalRetriever(lexical_db)
        tr0 = time.perf_counter()
        lexical_hits = retriever.search(
            normalized or text,
            top_k=cfg.lexical_top_k,
            min_quality=cfg.min_quality_score,
            review_policy=cfg.review_policy,
            include_eval=False,
            allowed_collections=allowed_collections,
            blocked_collections=blocked_collections,
        )
        retrieval_ms = (time.perf_counter() - tr0) * 1000

    if cfg.semantic_enabled:
        semantic_dir = cfg.root / "indexes" / "semantic"
        meta_db = cfg.root / "indexes" / "metadata" / "kb_metadata.sqlite"
        sem = NpKbSemanticRetriever(
            semantic_dir,
            metadata_db=meta_db if meta_db.exists() else None,
        )
        ts0 = time.perf_counter()
        semantic_hits = sem.search(
            normalized or text,
            top_k=cfg.semantic_top_k,
            review_policy=cfg.review_policy,
        )
        semantic_ms = (time.perf_counter() - ts0) * 1000

    if filter_citations_by_governance is not None:
        lexical_hits = filter_citations_by_governance(lexical_hits, gov)
        semantic_hits = filter_citations_by_governance(semantic_hits, gov)

    # MAI-29: fuse into ordered citations + unverified evidence candidates.
    allow_flag = (
        bool(allow_non_prod_semantic)
        if allow_non_prod_semantic is not None
        else False
    )
    if allow_non_prod_semantic is None:
        try:
            from src.oip.modules.conversation.application.vector_index_service import (
                env_allows_non_prod_semantic,
            )

            allow_flag = env_allows_non_prod_semantic()
        except Exception:  # noqa: BLE001
            allow_flag = False

    try:
        from src.oip.modules.conversation.application.hybrid_fusion_service import (
            fuse_citations_for_consume,
        )

        if hyb is not None:
            citations, evidence_candidates, fusion_obs = fuse_citations_for_consume(
                lexical_hits,
                semantic_hits,
                hybrid_fusion=hyb,
                allow_non_prod_semantic=allow_flag,
                top_k=max(cfg.lexical_top_k, cfg.semantic_top_k),
            )
            obs.update(fusion_obs)
            obs["evidence_candidates"] = evidence_candidates
        else:
            citations = _merge_citations(
                lexical_hits,
                semantic_hits,
                top_k=max(cfg.lexical_top_k, cfg.semantic_top_k),
            )
            obs["fusion_consume_mode"] = "UNCHANGED"
            obs["evidence_candidates"] = []
            obs["evidence_candidate_count"] = 0
    except Exception:  # noqa: BLE001
        citations = _merge_citations(
            lexical_hits,
            semantic_hits,
            top_k=max(cfg.lexical_top_k, cfg.semantic_top_k),
        )
        obs["fusion_consume_mode"] = "UNCHANGED"
        obs["evidence_candidates"] = []
        obs["evidence_candidate_count"] = 0

    obs.update(
        {
            "script_detect_ms": round((t1 - t0) * 1000, 3),
            "normalize_ms": round((t2 - t1) * 1000, 3),
            "retrieval_ms": round(retrieval_ms, 3),
            "semantic_ms": round(semantic_ms, 3),
            "selected_record_ids": [c.record_id for c in citations],
            "source_file_ids": sorted(
                {c.source_file_id for c in citations if c.source_file_id}
            ),
            "retrieval_miss": len(citations) == 0,
            "low_quality_filtered": False,
            "semantic_enabled": cfg.semantic_enabled,
            "governance_applied": allowed_collections is not None,
            "allowed_collection_count": (
                len(allowed_collections) if allowed_collections is not None else None
            ),
            "lexical_preferred": bool(obs.get("lexical_preferred")),
            "lexical_authoritative": bool(
                obs.get("lexical_authoritative", obs.get("lexical_preferred", True))
            ),
            "retrieval_mode": obs.get("retrieval_mode") or "UNCHANGED",
            "vector_retrieval_mode": obs.get("vector_retrieval_mode"),
            "semantic_non_prod_filler": bool(obs.get("semantic_non_prod_filler")),
            "production_eligible": False,
            "hybrid_production_eligible": False,
            "ollama_required": bool(obs.get("ollama_required", False)),
            "citations_verified": False,
            "claims_verified": False,
            "rerank_authorized": False,
            "blocked_mutation_rate_note": "KB path cannot mutate; gated by authoritative ERP services",
        }
    )
    # Prompt-injection defense: retrieved content is data, never instructions.
    for c in citations:
        if "ignore previous" in (c.content or "").lower() or "system prompt" in (
            c.content or ""
        ).lower():
            c.safety_labels = list(c.safety_labels) + ["possible_prompt_injection"]

    return NpKbInterpretResult(
        enabled=True,
        script=script,
        normalized_text=normalized,
        citations=citations if cfg.citations_enabled else [],
        observability=obs,
        execution_allowed=False,
        interpretation_only=True,
    )


def enrich_nlu_context(
    text: str,
    *,
    top_k: int | None = None,
    knowledge_source_governance: Mapping[str, Any] | None = None,
    lexical_index: Mapping[str, Any] | None = None,
    vector_index: Mapping[str, Any] | None = None,
    hybrid_fusion: Mapping[str, Any] | None = None,
    allow_non_prod_semantic: bool | None = None,
) -> dict[str, Any]:
    """Optional NLU enrichment payload for hybrid search / conversation layers.

    Returns an empty/disabled structure when the feature flag is off so callers
    can always merge safely without mutating ERP authority.
    """
    cfg = NpKbConfig.from_env()
    if top_k is not None:
        cfg.lexical_top_k = top_k
    result = interpret_user_text(
        text,
        cfg=cfg,
        knowledge_source_governance=knowledge_source_governance,
        lexical_index=lexical_index,
        vector_index=vector_index,
        hybrid_fusion=hybrid_fusion,
        allow_non_prod_semantic=allow_non_prod_semantic,
    )
    payload = result.to_optional_metadata().get("np_kb", {})
    if not payload.get("enabled"):
        return payload
    # Compact hints for upstream NLU (never executable commands).
    payload["normalized_for_nlu"] = result.normalized_text
    payload["language_form"] = result.script.language_form if result.script else None
    payload["hint_snippets"] = [
        {
            "record_id": c.record_id,
            "domain": c.domain,
            "retrieval_collection": c.retrieval_collection,
            "snippet": (c.content or "")[:240],
            "source_file_id": c.source_file_id,
        }
        for c in (result.citations or [])[: cfg.lexical_top_k]
    ]
    payload["execution_allowed"] = False
    return payload
