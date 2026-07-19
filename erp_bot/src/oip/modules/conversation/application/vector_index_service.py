"""MAI-28 — multilingual vector index readiness annotation.

Slice 1: probe Chroma semantic index presence when knowledge-source governance
is COMPLETE. Current backend is CHROMA_OLLAMA → production_eligible=false.
Never embeds, queries, mutates indexes, or claims citation verification.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ....contracts.knowledge_source_governance import KnowledgeSourceGovernanceStatus
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.vector_index import VectorIndexBundleV1, VectorIndexStatus

RUNTIME_VERSION = "mai-28.0.1-slice1"
AUTHORITY = "ADR_0045"


def _resolve_kb_root() -> Path:
    try:
        from src.nlu.np_kb_adapter import NpKbConfig

        return Path(NpKbConfig.from_env().root)
    except Exception:  # noqa: BLE001
        here = Path(__file__).resolve()
        for parent in here.parents:
            candidate = parent / "knowledgebase"
            if (candidate / "indexes").is_dir():
                return candidate
        return Path.cwd() / "knowledgebase"


def _chromadb_importable() -> bool:
    try:
        import chromadb  # noqa: F401

        return True
    except Exception:  # noqa: BLE001
        return False


def _read_status_hint(semantic_dir: Path) -> dict[str, Any]:
    path = semantic_dir / "semantic_index_status.json"
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def build_vector_index_bundle(
    request: CanonicalAIRequestV1,
) -> VectorIndexBundleV1:
    gov = request.knowledge_source_governance_bundle
    if gov is None:
        return VectorIndexBundleV1(
            analysis_status=VectorIndexStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("NO_GOVERNANCE",),
            warnings=("NO_GOVERNANCE",),
        )

    if gov.analysis_status != KnowledgeSourceGovernanceStatus.COMPLETE:
        return VectorIndexBundleV1(
            analysis_status=VectorIndexStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            reason_codes=("GOVERNANCE_NOT_COMPLETE",),
            warnings=("GOVERNANCE_NOT_COMPLETE",),
        )

    root = _resolve_kb_root()
    semantic_dir = root / "indexes" / "semantic"
    chroma_path = semantic_dir / "chroma"
    chroma_present = chroma_path.is_dir() and (
        (chroma_path / "chroma.sqlite3").is_file()
        or any(chroma_path.iterdir())
    )
    index_present = semantic_dir.is_dir() and (
        chroma_present or (semantic_dir / "semantic_index_status.json").is_file()
    )
    status_hint = _read_status_hint(semantic_dir)
    chromadb_ok = _chromadb_importable()

    # Honest: current NpKbSemanticRetriever requires localhost Ollama embeddings.
    ollama_required = True
    production_eligible = False
    multilingual_capable = bool(
        index_present
        and (
            status_hint.get("multilingual") is True
            or status_hint.get("languages")
            or chroma_present
        )
    )

    reasons: list[str] = [
        "GOVERNANCE_COMPLETE",
        "VECTOR_BACKEND_CHROMA_OLLAMA",
        "OLLAMA_REQUIRED_FOR_EMBED",
        "NOT_PRODUCTION_ELIGIBLE",
        "CITATIONS_NOT_VERIFIED",
        "NO_EMBED_OR_QUERY",
    ]
    warnings: list[str] = ["PROD_MUST_USE_LEXICAL_NOT_VECTOR"]
    if not index_present:
        reasons.append("INDEX_MISSING")
        warnings.append("INDEX_MISSING")
        multilingual_capable = False
    elif not chroma_present:
        reasons.append("CHROMA_MISSING")
        warnings.append("CHROMA_MISSING")
    else:
        reasons.append("CHROMA_PRESENT")
    if not chromadb_ok:
        warnings.append("CHROMADB_IMPORT_UNAVAILABLE")
        reasons.append("CHROMADB_IMPORT_UNAVAILABLE")

    return VectorIndexBundleV1(
        analysis_status=VectorIndexStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        index_present=index_present,
        chroma_present=chroma_present,
        vector_backend="CHROMA_OLLAMA",
        ollama_required=ollama_required,
        production_eligible=production_eligible,
        multilingual_capable=multilingual_capable,
        citations_verified=False,
        reason_codes=tuple(reasons),
        warnings=tuple(warnings),
        documents_retrieved=0,
        index_mutations=0,
        query_executions=0,
        embed_invocations=0,
    )


def attach_vector_index_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_vector_index_bundle(request)
    return request.model_copy(update={"vector_index_bundle": bundle})


def assert_vector_index_authority(
    bundle: VectorIndexBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.production_eligible
        or bundle.citations_verified
        or bundle.documents_retrieved != 0
        or bundle.index_mutations != 0
        or bundle.query_executions != 0
        or bundle.embed_invocations != 0
    ):
        raise RuntimeError("VECTOR_INDEX_AUTHORITY")


def vector_index_to_metadata(
    bundle: VectorIndexBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "index_present": bundle.index_present,
        "chroma_present": bundle.chroma_present,
        "vector_backend": bundle.vector_backend,
        "ollama_required": True,
        "production_eligible": False,
        "multilingual_capable": bundle.multilingual_capable,
        "citations_verified": False,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "documents_retrieved": bundle.documents_retrieved,
        "index_mutations": bundle.index_mutations,
        "query_executions": bundle.query_executions,
        "embed_invocations": bundle.embed_invocations,
        "is_execution_authority": False,
    }
