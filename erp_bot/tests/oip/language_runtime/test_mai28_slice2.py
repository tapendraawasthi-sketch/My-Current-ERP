"""MAI-28 slice 2 — optional non-prod semantic filler; lexical authoritative."""

from __future__ import annotations

from datetime import datetime, timezone

from src.nlu.np_kb_adapter import NpKbConfig, interpret_user_text
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
    attach_lexical_index_to_request,
    lexical_index_to_metadata,
)
from src.oip.modules.conversation.application.vector_index_service import (
    RUNTIME_VERSION,
    assert_vector_index_authority,
    attach_vector_index_to_request,
    resolve_vector_retrieval_mode,
    should_allow_non_prod_semantic_consume,
    should_force_semantic_off_for_vector_policy,
    vector_index_to_metadata,
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
    req = attach_lexical_index_to_request(req)
    return attach_vector_index_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-28.0.2-slice2"


def test_default_blocks_semantic_without_allow() -> None:
    req = _pipeline("show VAT report for this month")
    vec = vector_index_to_metadata(req.vector_index_bundle)
    assert_vector_index_authority(req.vector_index_bundle)
    assert vec.get("production_eligible") is False
    assert should_allow_non_prod_semantic_consume(
        vec,
        semantic_enabled_requested=True,
        allow_non_prod_semantic=False,
    ) is False
    assert should_force_semantic_off_for_vector_policy(
        vec,
        semantic_enabled_requested=True,
        allow_non_prod_semantic=False,
    ) is True
    assert (
        resolve_vector_retrieval_mode(
            vec,
            semantic_enabled_requested=True,
            allow_non_prod_semantic=False,
        )
        == "LEXICAL_AUTHORITATIVE"
    )


def test_allow_non_prod_filler_when_chroma_ready() -> None:
    req = _pipeline("show VAT report for this month")
    vec = vector_index_to_metadata(req.vector_index_bundle)
    if not vec.get("chroma_present"):
        assert should_allow_non_prod_semantic_consume(
            vec,
            semantic_enabled_requested=True,
            allow_non_prod_semantic=True,
        ) is False
        return
    assert should_allow_non_prod_semantic_consume(
        vec,
        semantic_enabled_requested=True,
        allow_non_prod_semantic=True,
    ) is True
    assert (
        resolve_vector_retrieval_mode(
            vec,
            semantic_enabled_requested=True,
            allow_non_prod_semantic=True,
        )
        == "LEXICAL_PLUS_NON_PROD_SEMANTIC"
    )
    cfg = NpKbConfig.from_env()
    cfg.semantic_enabled = True
    lex = lexical_index_to_metadata(req.lexical_index_bundle)
    result = interpret_user_text(
        "show VAT report for this month",
        cfg=cfg,
        knowledge_source_governance={
            "analysis_status": "COMPLETE",
            "allowed_retrieval_collections": ["accounting_and_erp"],
            "blocked_retrieval_collections": ["evaluation_only"],
            "allow_evaluation_corpus": False,
        },
        lexical_index=lex,
        vector_index=vec,
        allow_non_prod_semantic=True,
    )
    assert result.execution_allowed is False
    assert result.observability.get("production_eligible") is False
    assert result.observability.get("lexical_authoritative") is True
    # Soft-fail if Ollama is down: enabled path still lexical-first.
    if result.enabled:
        assert result.observability.get("retrieval_mode") == (
            "LEXICAL_PLUS_NON_PROD_SEMANTIC"
        )
        assert result.observability.get("semantic_non_prod_filler") is True


def test_production_eligible_claim_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "index_present": True,
        "chroma_present": True,
        "production_eligible": True,
        "ollama_required": True,
        "citations_verified": False,
        "is_execution_authority": False,
    }
    assert should_allow_non_prod_semantic_consume(
        meta,
        semantic_enabled_requested=True,
        allow_non_prod_semantic=True,
    ) is False
    assert (
        resolve_vector_retrieval_mode(
            meta,
            semantic_enabled_requested=True,
            allow_non_prod_semantic=True,
        )
        == "BLOCKED"
    )


def test_skip_vector_does_not_enable_semantic() -> None:
    req = _pipeline("asdf qwer zxcv")
    vec = vector_index_to_metadata(req.vector_index_bundle)
    assert vec.get("analysis_status") == "SKIP"
    assert should_allow_non_prod_semantic_consume(
        vec,
        semantic_enabled_requested=True,
        allow_non_prod_semantic=True,
    ) is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai28"
        / "frozen"
        / "vector_index_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            meta = case["synthetic_meta"]
        else:
            req = _pipeline(case["text"])
            meta = vector_index_to_metadata(req.vector_index_bundle)
        mode = resolve_vector_retrieval_mode(
            meta,
            semantic_enabled_requested=bool(case.get("semantic_requested", True)),
            allow_non_prod_semantic=bool(case.get("allow_non_prod", False)),
        )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
        if case.get("expect_allow") is True:
            assert should_allow_non_prod_semantic_consume(
                meta,
                semantic_enabled_requested=True,
                allow_non_prod_semantic=True,
            ) is True
        if case.get("expect_allow") is False and case.get("allow_non_prod"):
            assert should_allow_non_prod_semantic_consume(
                meta,
                semantic_enabled_requested=True,
                allow_non_prod_semantic=True,
            ) is False
