"""MAI-29 slice 2 — bounded evidence candidates / optional RRF consume."""

from __future__ import annotations

from datetime import datetime, timezone

from src.nlu.np_kb_adapter import KbCitation, interpret_user_text
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.hierarchical_router_service import (
    attach_router_decision_to_request,
)
from src.oip.modules.conversation.application.hybrid_fusion_service import (
    RUNTIME_VERSION,
    assert_hybrid_fusion_authority,
    attach_hybrid_fusion_to_request,
    fuse_citations_for_consume,
    hybrid_fusion_to_metadata,
    resolve_fusion_consume_mode,
    rrf_fuse_record_ids,
    should_apply_rrf_fusion,
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
    return attach_hybrid_fusion_to_request(req)


def _cite(rid: str, coll: str = "accounting_and_erp") -> KbCitation:
    return KbCitation(
        record_id=rid,
        source_file_id="0001",
        source_filename="x",
        source_line_start=1,
        source_line_end=1,
        domain="ACCOUNTING",
        record_type="domain_records",
        quality_score=0.9,
        review_status="approved",
        safety_labels=[],
        content=f"content {rid}",
        score=1.0,
        retrieval_collection=coll,
    )


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-29.0.2-slice2"


def test_default_lexical_only_consume() -> None:
    req = _pipeline("show VAT report for this month")
    meta = hybrid_fusion_to_metadata(req.hybrid_fusion_bundle)
    assert_hybrid_fusion_authority(req.hybrid_fusion_bundle)
    assert should_apply_rrf_fusion(meta, allow_non_prod_semantic=False) is False
    assert (
        resolve_fusion_consume_mode(meta, allow_non_prod_semantic=False)
        == "LEXICAL_ONLY"
    )
    lex = [_cite("a"), _cite("b")]
    sem = [_cite("c")]
    ordered, candidates, obs = fuse_citations_for_consume(
        lex,
        sem,
        hybrid_fusion=meta,
        allow_non_prod_semantic=False,
    )
    assert obs["fusion_consume_mode"] == "LEXICAL_ONLY"
    assert obs["claims_verified"] is False
    assert obs["citations_verified"] is False
    assert obs["rerank_authorized"] is False
    assert obs["hybrid_production_eligible"] is False
    assert [c.record_id for c in ordered[:2]] == ["a", "b"]
    assert len(candidates) >= 1
    assert candidates[0]["claims_verified"] is False


def test_rrf_when_allowed() -> None:
    req = _pipeline("show VAT report for this month")
    meta = hybrid_fusion_to_metadata(req.hybrid_fusion_bundle)
    if meta.get("fusion_mode") != "RRF_CANDIDATE":
        return
    assert should_apply_rrf_fusion(meta, allow_non_prod_semantic=True) is True
    assert (
        resolve_fusion_consume_mode(meta, allow_non_prod_semantic=True)
        == "RRF_APPLIED"
    )
    lex = [_cite("L1"), _cite("L2")]
    sem = [_cite("S1"), _cite("L1")]
    ordered, candidates, obs = fuse_citations_for_consume(
        lex,
        sem,
        hybrid_fusion=meta,
        allow_non_prod_semantic=True,
    )
    assert obs["fusion_consume_mode"] == "RRF_APPLIED"
    assert "L1" in [c.record_id for c in ordered]
    assert any(c.get("source_leg") == "both" for c in candidates)
    ranked = rrf_fuse_record_ids(["L1", "L2"], ["S1", "L1"], rrf_k=60, top_k=3)
    assert ranked[0][0] == "L1"  # appears in both legs


def test_prod_claim_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "fusion_mode": "RRF_CANDIDATE",
        "rrf_k": 60,
        "hybrid_production_eligible": True,
        "rerank_authorized": False,
        "claims_verified": False,
        "citations_verified": False,
        "is_execution_authority": False,
    }
    assert resolve_fusion_consume_mode(meta, allow_non_prod_semantic=True) == "BLOCKED"
    ordered, candidates, obs = fuse_citations_for_consume(
        [_cite("a")],
        [_cite("b")],
        hybrid_fusion=meta,
        allow_non_prod_semantic=True,
    )
    assert ordered == []
    assert candidates == []
    assert obs["fusion_consume_mode"] == "BLOCKED"


def test_interpret_attaches_evidence_candidates() -> None:
    req = _pipeline("show ledger balance report for cash account")
    meta = hybrid_fusion_to_metadata(req.hybrid_fusion_bundle)
    result = interpret_user_text(
        "show ledger balance report for cash account",
        knowledge_source_governance={
            "analysis_status": "COMPLETE",
            "allowed_retrieval_collections": [
                "accounting_and_erp",
                "language_and_normalization",
            ],
            "blocked_retrieval_collections": ["evaluation_only"],
            "allow_evaluation_corpus": False,
        },
        hybrid_fusion=meta,
        allow_non_prod_semantic=False,
    )
    if result.enabled:
        assert result.observability.get("claims_verified") is False
        assert result.observability.get("citations_verified") is False
        assert result.observability.get("rerank_authorized") is False
        assert result.observability.get("fusion_consume_mode") == "LEXICAL_ONLY"
        assert isinstance(result.observability.get("evidence_candidates"), list)


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai29"
        / "frozen"
        / "hybrid_fusion_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            meta = case["synthetic_meta"]
        else:
            req = _pipeline(case["text"])
            meta = hybrid_fusion_to_metadata(req.hybrid_fusion_bundle)
        mode = resolve_fusion_consume_mode(
            meta,
            allow_non_prod_semantic=bool(case.get("allow_non_prod", False)),
        )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
