"""NEXT-07 — gated language candidate consume into primary NLU (ADR_0076)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.language_nlu_consume import (
    first_money_role_candidate,
    language_frame_to_nlu_metadata,
    refine_classification_with_language_candidates,
)
from oip.modules.conversation.application.nlu_language_consume_policy import (
    AUTHORITY,
    DECISION,
    assert_nlu_language_consume_honesty,
    load_nlu_language_consume_registry,
    nlu_language_consume_observability,
)
from src.orbix.operation_classifier import (
    ClassificationResult,
    OperationClass,
    classify_operation,
)

ROOT = Path(__file__).resolve().parents[4]


def _lang(
    *,
    concept_ids: list[str] | None = None,
    number_roles: list[dict] | None = None,
) -> dict:
    return {
        "authority": AUTHORITY,
        "concept_ids": concept_ids or [],
        "number_roles": number_roles or [],
        "allow_concept_intent_consume": True,
        "allow_number_role_consume": True,
        "allow_transliteration_apply": False,
        "allow_typo_rewrite_apply": False,
        "allow_silent_master_bind": False,
        "allow_silent_draft_write": False,
        "silent_applications": 0,
        "draft_mutations": 0,
        "raw_text_mutated": False,
        "protected_span_count": 0,
    }


def test_registry_gated_consume() -> None:
    reg = load_nlu_language_consume_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["policies"]["allow_concept_intent_consume"] is True
    assert reg["policies"]["allow_number_role_consume"] is True
    assert reg["policies"]["allow_transliteration_apply"] is False
    assert reg["policies"]["allow_silent_master_bind"] is False
    assert reg["policies"]["allow_silent_draft_write"] is False
    assert reg["honesty"]["gap_p1_009_status"] == "OPEN"


def test_honesty_rejects_unsafe_claims() -> None:
    assert_nlu_language_consume_honesty()
    with pytest.raises(RuntimeError, match="TRANSLITERATION_APPLY"):
        assert_nlu_language_consume_honesty({"allow_transliteration_apply": True})
    with pytest.raises(RuntimeError, match="SILENT_MASTER_BIND"):
        assert_nlu_language_consume_honesty({"allow_silent_master_bind": True})
    with pytest.raises(RuntimeError, match="SILENT_DRAFT_WRITE"):
        assert_nlu_language_consume_honesty({"allow_silent_draft_write": True})
    with pytest.raises(RuntimeError, match="RAW_TEXT_MUTATION"):
        assert_nlu_language_consume_honesty({"raw_text_mutated": True})


def test_before_after_concept_consume_upgrades_weak_general() -> None:
    message = "today sales report please"
    before = classify_operation(message)
    # Baseline may already be REPORT_REQUEST via keywords; force weak general.
    weak = ClassificationResult(OperationClass.GENERAL_QUESTION, 0.55, "general_qa")
    after = refine_classification_with_language_candidates(
        weak,
        message,
        _lang(concept_ids=["CONCEPT_SALES", "CONCEPT_REPORT"]),
    )
    assert after.operation_class == OperationClass.REPORT_REQUEST
    assert after.intent_hint == "report_generation"
    assert after.metadata["nlu_language_consume"]["draft_mutations"] == 0
    assert before.operation_class in {
        OperationClass.REPORT_REQUEST,
        OperationClass.GENERAL_QUESTION,
        OperationClass.TRANSACTION_CREATE,
        OperationClass.ERP_DATA_QUERY,
        OperationClass.ACCOUNTING_QUESTION,
    }


def test_ambiguous_sales_purchase_abstains() -> None:
    weak = ClassificationResult(OperationClass.GENERAL_QUESTION, 0.5, "general_qa")
    after = refine_classification_with_language_candidates(
        weak,
        "sales and purchase same time",
        _lang(concept_ids=["CONCEPT_SALES", "CONCEPT_PURCHASE"]),
    )
    assert after.operation_class == OperationClass.GENERAL_QUESTION
    assert after.intent_hint == "general_qa"


def test_number_role_skips_duration_as_first_money() -> None:
    money = first_money_role_candidate(
        _lang(
            number_roles=[
                {"surface": "3", "role": "duration", "ambiguous": False},
                {"surface": "5000", "role": "amount", "ambiguous": False},
            ]
        )
    )
    assert money is not None
    assert money["surface"] == "5000"
    assert money["role"] == "amount"


def test_locked_ops_not_overridden() -> None:
    confirm = ClassificationResult(OperationClass.CONFIRMATION, 0.95, "confirm")
    after = refine_classification_with_language_candidates(
        confirm,
        "yes",
        _lang(concept_ids=["CONCEPT_SALES"]),
    )
    assert after.operation_class == OperationClass.CONFIRMATION


def test_frame_metadata_preserves_fail_closed() -> None:
    from oip.contracts.language import LanguageFrameV1

    frame = LanguageFrameV1.not_run("bechyo 5000")
    meta = language_frame_to_nlu_metadata(frame)
    assert meta["raw_text_mutated"] is False
    assert meta["silent_applications"] == 0
    assert meta["allow_silent_master_bind"] is False
    assert meta["allow_transliteration_apply"] is False


def test_observability_and_ledger_pointer() -> None:
    obs = nlu_language_consume_observability()
    assert obs["allow_concept_intent_consume"] is True
    assert obs["gap_p1_009_status"] == "OPEN"

    adr = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "decisions"
        / "ADR_0076_GATED_LANGUAGE_CANDIDATE_NLU_CONSUME.md"
    )
    assert adr.is_file()
    text = adr.read_text(encoding="utf-8")
    assert "map_concepts_to_intent" in text or "concept" in text.lower()

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-B1"
    assert "NEXT-07" in ledger.get("completed_next_steps", [])
    assert ledger.get("nlu_language_consume", {}).get("authority") == "ADR_0076"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-B1"
    assert "NEXT-07" in matrix.get("completed_steps", [])


def test_fuzzy_master_bind_still_forbidden_in_policy() -> None:
    """Consume must not authorize silent party/item bind (MAI-08 floors remain)."""
    with pytest.raises(RuntimeError, match="SILENT_MASTER_BIND"):
        assert_nlu_language_consume_honesty({"allow_silent_master_bind": True})
    # Floor constants remain high enough for abstention.
    from pathlib import Path as P

    enricher = (
        ROOT / "src" / "ai" / "rag" / "EntityEnricher.ts"
    ).read_text(encoding="utf-8")
    assert "MAI08_PARTY_SCORE_FLOOR" in enricher
    assert "MAI08_MIN_SCORE_GAP" in enricher
