"""NEXT-05 — confirm path honesty (ADR_0075 / Model B tokens)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.confirm_path_authority_policy import (
    AUTHORITY,
    DECISION,
    PRODUCT_MUTATION_PATH,
    assert_confirm_path_honesty,
    confirm_path_observability,
    load_confirm_path_registry,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_model_b_confirm_tokens() -> None:
    reg = load_confirm_path_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["product_mutation_path"] == PRODUCT_MUTATION_PATH
    assert reg["nl_assent_posts"] is False
    assert reg["ai_confirm_oec_is_authority"] is False
    assert reg["ai_may_mint_product_confirm_token"] is False
    assert reg["token_policy"]["single_use"] is True
    assert reg["receipt_required_for_success"] is True


def test_honesty_rejects_false_claims() -> None:
    assert_confirm_path_honesty()
    with pytest.raises(RuntimeError, match="NL_ASSENT_POSTS"):
        assert_confirm_path_honesty({"nl_assent_posts": True})
    with pytest.raises(RuntimeError, match="AI_CONFIRM_OEC"):
        assert_confirm_path_honesty({"ai_confirm_oec_is_authority": True})
    with pytest.raises(RuntimeError, match="CONFIRM_TOKEN_REUSE"):
        assert_confirm_path_honesty({"confirm_token_reuse_allowed": True})
    with pytest.raises(RuntimeError, match="SUCCESS_WITHOUT_RECEIPT"):
        assert_confirm_path_honesty({"success_without_receipt": True})


def test_observability_fail_closed() -> None:
    obs = confirm_path_observability()
    assert obs["nl_assent_posts"] is False
    assert obs["ai_confirm_oec_is_authority"] is False
    assert obs["product_mutation_path"] == PRODUCT_MUTATION_PATH
    assert obs["oec_is_sole_mutation_authority"] is False


def test_mai34_ai_candidate_still_non_authority() -> None:
    from pydantic import ValidationError

    from oip.contracts.explicit_confirmation_oec_dispatch import (
        ExplicitConfirmationOecDispatchBundleV1,
    )

    # Contract still forbids issued tokens on AI bundle.
    with pytest.raises(ValidationError, match="CONFIRM_TOKEN_MUST_NOT_BE_ISSUED"):
        ExplicitConfirmationOecDispatchBundleV1(
            confirm_token_status="ISSUED",
        )


def test_adr_gap_ledger_pointer() -> None:
    adr = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "decisions"
        / "ADR_0075_CONFIRM_PATH_HONESTY_MODEL_B.md"
    )
    assert adr.is_file()
    text = adr.read_text(encoding="utf-8")
    assert "DEXIE_EXECUTE_ORBIX_CONFIRM" in text
    assert "nl_assent" in text.lower()

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "NEXT-07"
    assert "NEXT-05" in ledger.get("completed_next_steps", [])
    assert ledger.get("confirm_path_authority", {}).get("authority") == "ADR_0075"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "NEXT-07"
    assert "NEXT-05" in matrix.get("completed_steps", [])
