"""MAI-27 slice 1 — lexical index readiness annotation (no MATCH query)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.lexical_index import LexicalIndexStatus
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.knowledge_source_governance_service import (
    attach_knowledge_source_governance_to_request,
)
from src.oip.modules.conversation.application.lexical_index_service import (
    RUNTIME_VERSION,
    assert_lexical_index_authority,
    attach_lexical_index_to_request,
    build_lexical_index_bundle,
)


def _pipeline(text: str):
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text=text,
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
    )
    req = attach_router_decision_to_request(req)
    req = attach_knowledge_source_governance_to_request(req)
    return attach_lexical_index_to_request(req)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION.startswith("mai-27.")


def test_complete_without_retrieval_or_ollama() -> None:
    req = _pipeline("show VAT report for this month")
    bundle = req.lexical_index_bundle
    assert bundle is not None
    assert bundle.analysis_status == LexicalIndexStatus.COMPLETE
    assert bundle.ollama_required is False
    assert bundle.vector_backend_required is False
    assert bundle.citations_verified is False
    assert bundle.query_executions == 0
    assert bundle.documents_retrieved == 0
    assert bundle.index_mutations == 0
    assert bundle.is_execution_authority is False
    assert bundle.lexical_backend == "SQLITE_FTS"
    assert_lexical_index_authority(bundle)
    if bundle.index_present:
        assert bundle.active_lexical_db in {
            "kb_grounding.sqlite",
            "kb_lexical.sqlite",
        }


def test_ood_skips() -> None:
    req = _pipeline("asdf qwer zxcv")
    bundle = req.lexical_index_bundle
    assert bundle is not None
    assert bundle.analysis_status == LexicalIndexStatus.SKIP
    assert bundle.query_executions == 0
    assert bundle.ollama_required is False


def test_adapter_metadata() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    lex = (dto.metadata or {}).get("lexical_index") or {}
    assert lex.get("ollama_required") is False
    assert lex.get("vector_backend_required") is False
    assert lex.get("citations_verified") is False
    assert lex.get("is_execution_authority") is False
    assert lex.get("query_executions") == 0


def test_build_without_governance_skips() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="show balance",
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
    )
    bundle = build_lexical_index_bundle(req)
    assert bundle.analysis_status == LexicalIndexStatus.SKIP


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai27"
        / "frozen"
        / "lexical_index_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.lexical_index_bundle
        assert bundle is not None
        assert bundle.ollama_required is False
        assert bundle.vector_backend_required is False
        assert bundle.citations_verified is False
        assert bundle.query_executions == 0
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
