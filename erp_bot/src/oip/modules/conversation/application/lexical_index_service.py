"""MAI-27 — lexical index readiness annotation.

Slice 1: probe SQLITE FTS lexical DB presence/schema when knowledge-source
governance is COMPLETE. Never runs MATCH queries, never requires Ollama/vector,
never claims citations verified, never mutates indexes.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from ....contracts.knowledge_source_governance import KnowledgeSourceGovernanceStatus
from ....contracts.lexical_index import LexicalIndexBundleV1, LexicalIndexStatus
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-27.0.1-slice1"
AUTHORITY = "ADR_0044"


def _resolve_kb_root() -> Path:
    try:
        from src.nlu.np_kb_adapter import NpKbConfig

        return Path(NpKbConfig.from_env().root)
    except Exception:  # noqa: BLE001
        # Fallbacks for test isolation / alternate import roots.
        here = Path(__file__).resolve()
        for parent in here.parents:
            candidate = parent / "knowledgebase"
            if (candidate / "indexes" / "lexical").is_dir():
                return candidate
        return Path.cwd() / "knowledgebase"


def _resolve_active_lexical_db(root: Path) -> Path | None:
    lexical_dir = root / "indexes" / "lexical"
    grounding = lexical_dir / "kb_grounding.sqlite"
    if grounding.is_file():
        return grounding
    lex = lexical_dir / "kb_lexical.sqlite"
    if lex.is_file():
        return lex
    return None


def _probe_fts_ready(db_path: Path) -> bool:
    """Schema probe only — never executes a MATCH / user query."""
    try:
        conn = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
        try:
            row = conn.execute(
                "SELECT 1 FROM sqlite_master "
                "WHERE type IN ('table','virtual table') AND name='prod_fts' "
                "LIMIT 1"
            ).fetchone()
            return row is not None
        finally:
            conn.close()
    except sqlite3.Error:
        return False


def build_lexical_index_bundle(
    request: CanonicalAIRequestV1,
) -> LexicalIndexBundleV1:
    gov = request.knowledge_source_governance_bundle
    if gov is None:
        return LexicalIndexBundleV1(
            analysis_status=LexicalIndexStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("NO_GOVERNANCE",),
            warnings=("NO_GOVERNANCE",),
        )

    if gov.analysis_status != KnowledgeSourceGovernanceStatus.COMPLETE:
        return LexicalIndexBundleV1(
            analysis_status=LexicalIndexStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("GOVERNANCE_NOT_COMPLETE",),
            warnings=("GOVERNANCE_NOT_COMPLETE",),
        )

    root = _resolve_kb_root()
    active = _resolve_active_lexical_db(root)
    index_present = active is not None
    fts_ready = _probe_fts_ready(active) if active is not None else False

    reasons: list[str] = [
        "GOVERNANCE_COMPLETE",
        "LEXICAL_BACKEND_SQLITE_FTS",
        "OLLAMA_NOT_REQUIRED",
        "VECTOR_NOT_REQUIRED",
        "CITATIONS_NOT_VERIFIED",
    ]
    warnings: list[str] = []
    if not index_present:
        reasons.append("INDEX_MISSING")
        warnings.append("INDEX_MISSING")
    elif not fts_ready:
        reasons.append("FTS_NOT_READY")
        warnings.append("FTS_NOT_READY")
    else:
        reasons.append("FTS_READY")

    return LexicalIndexBundleV1(
        analysis_status=LexicalIndexStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        index_present=index_present,
        fts_ready=fts_ready,
        active_lexical_db=active.name if active is not None else None,
        lexical_backend="SQLITE_FTS",
        ollama_required=False,
        vector_backend_required=False,
        citations_verified=False,
        reason_codes=tuple(reasons),
        warnings=tuple(warnings),
        documents_retrieved=0,
        index_mutations=0,
        query_executions=0,
    )


def attach_lexical_index_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_lexical_index_bundle(request)
    return request.model_copy(update={"lexical_index_bundle": bundle})


def assert_lexical_index_authority(
    bundle: LexicalIndexBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.ollama_required
        or bundle.vector_backend_required
        or bundle.citations_verified
        or bundle.documents_retrieved != 0
        or bundle.index_mutations != 0
        or bundle.query_executions != 0
    ):
        raise RuntimeError("LEXICAL_INDEX_AUTHORITY")


def lexical_index_to_metadata(
    bundle: LexicalIndexBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "index_present": bundle.index_present,
        "fts_ready": bundle.fts_ready,
        "active_lexical_db": bundle.active_lexical_db,
        "lexical_backend": bundle.lexical_backend,
        "ollama_required": False,
        "vector_backend_required": False,
        "citations_verified": False,
        "reason_codes": list(bundle.reason_codes),
        "documents_retrieved": bundle.documents_retrieved,
        "index_mutations": bundle.index_mutations,
        "query_executions": bundle.query_executions,
        "is_execution_authority": False,
    }
