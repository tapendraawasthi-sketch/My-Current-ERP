"""MAI-24 slice 2 — consume knowledge-source governance into NP KB retrieval."""

from __future__ import annotations

from datetime import datetime, timezone

from src.nlu.np_kb_adapter import KbCitation, enrich_nlu_context
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
    RUNTIME_VERSION,
    assert_knowledge_source_governance_authority,
    attach_knowledge_source_governance_to_request,
    filter_citations_by_governance,
    knowledge_source_governance_to_metadata,
    should_skip_retrieval_for_governance,
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
    return attach_knowledge_source_governance_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-24.0.2-slice2"


def test_skip_blocks_retrieval() -> None:
    req = _pipeline("asdf qwer zxcv")
    meta = knowledge_source_governance_to_metadata(req.knowledge_source_governance_bundle)
    assert should_skip_retrieval_for_governance(meta) is True
    payload = enrich_nlu_context(
        "asdf qwer zxcv",
        knowledge_source_governance=meta,
    )
    assert payload.get("enabled") is False
    assert payload.get("reason") == "GOVERNANCE_SKIP"
    assert_knowledge_source_governance_authority(req.knowledge_source_governance_bundle)


def test_filter_drops_evaluation_and_out_of_policy() -> None:
    gov = {
        "analysis_status": "COMPLETE",
        "allowed_retrieval_collections": ["accounting_and_erp"],
        "blocked_retrieval_collections": ["evaluation_only"],
        "allow_evaluation_corpus": False,
        "is_execution_authority": False,
        "documents_retrieved": 0,
        "index_mutations": 0,
        "draft_mutations": 0,
        "model_invocations": 0,
    }
    citations = [
        KbCitation(
            record_id="a",
            source_file_id="0001",
            source_filename="x",
            source_line_start=1,
            source_line_end=1,
            domain="ACCOUNTING",
            record_type="domain_records",
            quality_score=0.9,
            review_status="approved",
            safety_labels=[],
            content="ok",
            score=1.0,
            retrieval_collection="accounting_and_erp",
        ),
        KbCitation(
            record_id="b",
            source_file_id="0002",
            source_filename="y",
            source_line_start=1,
            source_line_end=1,
            domain="EVAL",
            record_type="gold_tests",
            quality_score=0.9,
            review_status="approved",
            safety_labels=[],
            content="eval",
            score=1.0,
            retrieval_collection="evaluation_only",
        ),
        KbCitation(
            record_id="c",
            source_file_id="0003",
            source_filename="z",
            source_line_start=1,
            source_line_end=1,
            domain="LANG",
            record_type="language_rules",
            quality_score=0.9,
            review_status="approved",
            safety_labels=[],
            content="lang",
            score=1.0,
            retrieval_collection="language_and_normalization",
        ),
    ]
    filtered = filter_citations_by_governance(citations, gov)
    assert [c.record_id for c in filtered] == ["a"]


def test_complete_governance_passed_to_grounding(monkeypatch) -> None:
    captured: dict = {}

    def _fake_enrich(text, *, top_k=None, knowledge_source_governance=None):
        captured["gov"] = knowledge_source_governance
        return {
            "enabled": True,
            "execution_allowed": False,
            "hint_snippets": [
                {
                    "record_id": "r1",
                    "domain": "ACCOUNTING",
                    "retrieval_collection": "accounting_and_erp",
                    "snippet": "purchase draft preview",
                    "source_file_id": "0033",
                }
            ],
            "citations": [],
        }

    monkeypatch.setattr("src.nlu.np_kb_adapter.enrich_nlu_context", _fake_enrich)

    req = _pipeline("Ram bata 500 ko saman kine")
    meta = knowledge_source_governance_to_metadata(req.knowledge_source_governance_bundle)
    g = build_prompt_grounding(
        "Ram bata 500 ko saman kine",
        knowledge_source_governance=meta,
    )
    assert captured.get("gov") is not None
    assert captured["gov"].get("analysis_status") == "COMPLETE"
    assert "accounting_and_erp" in (
        captured["gov"].get("allowed_retrieval_collections") or []
    )
    assert g.np_kb_enabled is True


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai24"
        / "frozen"
        / "knowledge_source_governance_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        meta = knowledge_source_governance_to_metadata(
            req.knowledge_source_governance_bundle
        )
        assert meta.get("documents_retrieved") == 0
        assert meta.get("allow_evaluation_corpus") is False
        skip = should_skip_retrieval_for_governance(meta)
        assert skip is bool(case["expected_skip"]), case["case_id"]
        if case.get("expected_apply_filter"):
            assert meta.get("analysis_status") == "COMPLETE"
            assert "evaluation_only" in (
                meta.get("blocked_retrieval_collections") or []
            )
