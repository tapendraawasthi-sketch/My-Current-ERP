"""MAI-30 slice 2 — gate ungrounded answers / safe no-answer consume."""

from __future__ import annotations

from datetime import datetime, timezone

from src.nlu.prompt_grounding import build_prompt_grounding
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.claim_citation_service import (
    RUNTIME_VERSION,
    SAFE_NO_ANSWER_BLOCK,
    assert_claim_citation_authority,
    attach_claim_citation_to_request,
    claim_citation_to_metadata,
    grounded_answer_gate_metadata,
    resolve_grounded_answer_gate,
    should_emit_safe_no_answer,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.hybrid_fusion_service import (
    attach_hybrid_fusion_to_request,
)
from src.oip.modules.conversation.application.knowledge_source_governance_service import (
    attach_knowledge_source_governance_to_request,
)
from src.oip.modules.conversation.application.lexical_index_service import (
    attach_lexical_index_to_request,
)
from src.oip.modules.conversation.application.vector_index_service import (
    attach_vector_index_to_request,
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
    req = attach_vector_index_to_request(req)
    req = attach_hybrid_fusion_to_request(req)
    return attach_claim_citation_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-30.0.2-slice2"


def test_ungrounded_legal_tax_abstains() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    meta = claim_citation_to_metadata(req.claim_citation_bundle)
    assert_claim_citation_authority(req.claim_citation_bundle)
    assert resolve_grounded_answer_gate(meta, citation_count=0) == "ABSTAIN_UNGROUNDED"
    assert should_emit_safe_no_answer(meta, citation_count=0) is True
    gate = grounded_answer_gate_metadata(meta, citation_count=0)
    assert gate["safe_no_answer"] is True
    assert gate["claims_verified"] is False
    assert gate["citations_verified"] is False


def test_grounded_candidates_allow_unverified() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    meta = claim_citation_to_metadata(req.claim_citation_bundle)
    assert (
        resolve_grounded_answer_gate(meta, citation_count=2, evidence_candidate_count=1)
        == "ALLOW_WITH_CANDIDATES"
    )
    assert should_emit_safe_no_answer(meta, citation_count=2) is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "verification_status": "UNVERIFIED",
        "grounded_answer_policy": "ABSTAIN_WHEN_UNGROUNDED",
        "claim_cue_kinds": ["LEGAL_TAX"],
        "claims_verified": True,
        "citations_verified": False,
        "is_execution_authority": False,
    }
    assert resolve_grounded_answer_gate(meta, citation_count=3) == "BLOCKED"
    assert should_emit_safe_no_answer(meta, citation_count=3) is True


def test_skip_when_not_complete() -> None:
    meta = {
        "analysis_status": "SKIP",
        "verification_status": "UNVERIFIED",
        "grounded_answer_policy": "ABSTAIN_WHEN_UNGROUNDED",
        "claim_cue_kinds": [],
        "claims_verified": False,
        "citations_verified": False,
        "is_execution_authority": False,
    }
    assert resolve_grounded_answer_gate(meta, citation_count=0) == "SKIP"


def test_prompt_grounding_safe_no_answer() -> None:
    req = _pipeline("show VAT rate as of 2024-07-16 under VAT Act")
    meta = claim_citation_to_metadata(req.claim_citation_bundle)
    grounding = build_prompt_grounding(
        "show VAT rate as of 2024-07-16 under VAT Act",
        claim_citation=meta,
        knowledge_source_governance={
            "analysis_status": "COMPLETE",
            "allowed_retrieval_collections": [],
            "blocked_retrieval_collections": ["evaluation_only"],
            "allow_evaluation_corpus": False,
        },
    )
    # Empty allowed collections → zero cites → abstain for legal/tax cue.
    assert grounding.safe_no_answer is True
    assert grounding.abstain_ungrounded is True
    assert grounding.grounded_answer_gate == "ABSTAIN_UNGROUNDED"
    assert "ABSTAIN_UNGROUNDED" in grounding.block
    assert grounding.citation_count == 0
    assert "claims_verified=false" in SAFE_NO_ANSWER_BLOCK
    md = grounding.to_metadata()
    assert md["claims_verified"] is False
    assert md["citations_verified"] is False
    assert md["legal_proof_claimed"] is False
    assert md["is_execution_authority"] is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai30"
        / "frozen"
        / "claim_citation_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            meta = case["synthetic_meta"]
        else:
            req = _pipeline(case["text"])
            meta = claim_citation_to_metadata(req.claim_citation_bundle)
        gate = resolve_grounded_answer_gate(
            meta,
            citation_count=int(case.get("citation_count") or 0),
            evidence_candidate_count=int(case.get("evidence_candidate_count") or 0),
        )
        if case.get("expected_gate"):
            assert gate == case["expected_gate"], case["case_id"]
        # Synthetic BLOCKED fixture intentionally sets claims_verified=true.
        if case.get("expected_gate") != "BLOCKED":
            assert meta.get("claims_verified") is not True
            assert meta.get("citations_verified") is not True
