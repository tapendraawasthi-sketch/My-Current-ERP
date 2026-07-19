"""NEXT-02 — mutation authority convergence (ADR_0072 / GAP-P0-001)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.mutation_authority_policy import (
    AUTHORITY,
    PRODUCT_MUTATION_PATH,
    REGISTER_GAP_STATUS,
    RUNTIME_GAP_STATUS,
    assert_mutation_authority_honesty,
    classified_path_ids,
    load_mutation_authority_registry,
    mutation_authority_observability,
    oec_is_sole_mutation_authority,
    product_mutation_path,
    registry_path,
)

ROOT = Path(__file__).resolve().parents[4]


def test_registry_option_a_model_b() -> None:
    reg = load_mutation_authority_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == "OPTION_A_MODEL_B_PRODUCT_AUTHORITY"
    assert product_mutation_path() == PRODUCT_MUTATION_PATH
    assert oec_is_sole_mutation_authority() is False
    assert reg["gap_p0_001"]["register_status"] == REGISTER_GAP_STATUS
    assert reg["gap_p0_001"]["runtime_status"] == RUNTIME_GAP_STATUS
    assert reg["gap_p0_001"]["closed"] is False
    assert "NODE_KHATA_CONFIRM" in classified_path_ids()
    assert "OEC_ACTION_RUNTIME" in classified_path_ids()
    assert registry_path().is_file()


def test_honesty_rejects_sole_oec_claim() -> None:
    assert_mutation_authority_honesty()
    with pytest.raises(RuntimeError, match="SOLE_OEC"):
        assert_mutation_authority_honesty(
            {"oec_is_sole_mutation_authority": True}
        )
    with pytest.raises(RuntimeError, match="NL_ASSENT"):
        assert_mutation_authority_honesty({"nl_assent_posts": True})
    with pytest.raises(RuntimeError, match="PRODUCT_MUTATION_PATH"):
        assert_mutation_authority_honesty(
            {"product_mutation_path": "OEC_ONLY"}
        )


def test_confirm_consume_wires_mutation_authority() -> None:
    from oip.modules.conversation.application.explicit_confirmation_oec_dispatch_consume_service import (
        assert_confirm_oec_consume_authority,
    )

    obs = mutation_authority_observability()
    obs.update(
        {
            "confirm_oec_consume_mode": "SKIP",
            "confirm_oec_consume_ready": False,
            "is_execution_authority": False,
            "confirm_token_minted": False,
            "confirm_accepted": False,
            "oec_dispatch_invoked": False,
            "action_runtime_invoked": False,
            "erp_command_posted": False,
            "dexie_post_invoked": False,
            "draft_mutations": 0,
            "posting_mutations": 0,
        }
    )
    assert_confirm_oec_consume_authority(obs)
    with pytest.raises(RuntimeError):
        bad = dict(obs)
        bad["oec_is_sole_mutation_authority"] = True
        assert_confirm_oec_consume_authority(bad)


def test_adr_and_gap_register_reduced() -> None:
    adr = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "decisions"
        / "ADR_0072_MUTATION_AUTHORITY_CONVERGENCE.md"
    )
    assert adr.is_file()
    text = adr.read_text(encoding="utf-8")
    assert "OPTION_A" in text or "Option A" in text
    assert "DEXIE_EXECUTE_ORBIX_CONFIRM" in text

    gap = ROOT / "docs" / "mokxya-ai" / "MAI_00_GAP_REGISTER.md"
    gap_text = gap.read_text(encoding="utf-8")
    # Status line for GAP-P0-001 must be REDUCED after NEXT-02
    section = gap_text.split("### GAP-P0-001")[1].split("### ")[0]
    assert "**Status:** REDUCED" in section
    assert "CLOSED" not in section.split("**Status:**")[1].split("\n")[0]

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "NEXT-10"
    assert ledger["mutation_authority"]["decision"] == (
        "OPTION_A_MODEL_B_PRODUCT_AUTHORITY"
    )
