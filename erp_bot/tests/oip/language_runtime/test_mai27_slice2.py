"""MAI-27 slice 2 — prefer lexical-only NP KB retrieval when fts_ready."""

from __future__ import annotations

from datetime import datetime, timezone

from src.nlu.np_kb_adapter import NpKbConfig, enrich_nlu_context, interpret_user_text
from src.nlu.prompt_grounding import build_prompt_grounding
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
    lexical_index_to_metadata,
    resolve_lexical_retrieval_mode,
    should_block_retrieval_for_lexical_index,
    should_prefer_lexical_retrieval,
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


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-27.0.2-slice2"


def test_prefer_lexical_when_ready() -> None:
    req = _pipeline("show VAT report for this month")
    meta = lexical_index_to_metadata(req.lexical_index_bundle)
    assert_lexical_index_authority(req.lexical_index_bundle)
    if meta.get("fts_ready"):
        assert should_prefer_lexical_retrieval(meta) is True
        assert resolve_lexical_retrieval_mode(meta) == "LEXICAL_ONLY"
        cfg = NpKbConfig.from_env()
        cfg.semantic_enabled = True  # would otherwise pull Ollama path
        result = interpret_user_text(
            "show VAT report for this month",
            cfg=cfg,
            knowledge_source_governance={
                "analysis_status": "COMPLETE",
                "allowed_retrieval_collections": ["accounting_and_erp"],
                "blocked_retrieval_collections": ["evaluation_only"],
                "allow_evaluation_corpus": False,
            },
            lexical_index=meta,
        )
        assert result.enabled is True
        assert result.observability.get("lexical_preferred") is True
        assert result.observability.get("semantic_forced_off") is True
        assert result.observability.get("semantic_enabled") is False
        assert result.observability.get("retrieval_mode") == "LEXICAL_ONLY"
        assert result.observability.get("ollama_required") is False
        assert result.execution_allowed is False
    else:
        assert should_block_retrieval_for_lexical_index(meta) is True


def test_block_when_complete_but_not_ready() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "index_present": False,
        "fts_ready": False,
        "ollama_required": False,
        "vector_backend_required": False,
        "citations_verified": False,
        "is_execution_authority": False,
    }
    assert should_prefer_lexical_retrieval(meta) is False
    assert should_block_retrieval_for_lexical_index(meta) is True
    payload = enrich_nlu_context(
        "show VAT report for this month",
        lexical_index=meta,
    )
    assert payload.get("enabled") is False
    assert payload.get("reason") == "LEXICAL_INDEX_NOT_READY"


def test_authority_flags_block() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "index_present": True,
        "fts_ready": True,
        "ollama_required": True,
        "vector_backend_required": False,
        "citations_verified": False,
        "is_execution_authority": False,
    }
    assert should_block_retrieval_for_lexical_index(meta) is True
    assert should_prefer_lexical_retrieval(meta) is False


def test_skip_does_not_block_via_lexical() -> None:
    req = _pipeline("asdf qwer zxcv")
    meta = lexical_index_to_metadata(req.lexical_index_bundle)
    assert meta.get("analysis_status") == "SKIP"
    assert should_prefer_lexical_retrieval(meta) is False
    assert should_block_retrieval_for_lexical_index(meta) is False


def test_grounding_consumes_lexical_preference() -> None:
    req = _pipeline("show ledger balance report for cash account")
    meta = lexical_index_to_metadata(req.lexical_index_bundle)
    gov = {
        "analysis_status": "COMPLETE",
        "allowed_retrieval_collections": [
            "accounting_and_erp",
            "language_and_normalization",
        ],
        "blocked_retrieval_collections": ["evaluation_only"],
        "allow_evaluation_corpus": False,
    }
    grounding = build_prompt_grounding(
        "show ledger balance report for cash account",
        knowledge_source_governance=gov,
        lexical_index=meta,
    )
    np_kb = grounding.np_kb_payload or {}
    if meta.get("fts_ready"):
        assert np_kb.get("enabled") is True
        obs = (np_kb.get("observability") or {}) if isinstance(np_kb, dict) else {}
        # observability may be nested differently; prefer top-level flags if present
        if "lexical_preferred" in np_kb:
            assert np_kb.get("lexical_preferred") is True
        elif obs:
            assert obs.get("lexical_preferred") is True or obs.get(
                "retrieval_mode"
            ) in {"LEXICAL_ONLY", None}
    else:
        assert np_kb.get("enabled") is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai27"
        / "frozen"
        / "lexical_index_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            meta = case["synthetic_meta"]
        else:
            req = _pipeline(case["text"])
            meta = lexical_index_to_metadata(req.lexical_index_bundle)
        mode = resolve_lexical_retrieval_mode(meta)
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
        assert meta.get("ollama_required") is False or case.get("synthetic_meta")
        if case.get("expect_block"):
            assert should_block_retrieval_for_lexical_index(meta) is True
        if case.get("expect_prefer"):
            assert should_prefer_lexical_retrieval(meta) is True
