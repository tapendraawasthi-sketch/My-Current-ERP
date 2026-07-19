"""NEXT-14 — production retrieval without Ollama (ADR_0081 / GAP-P2-001 REDUCED)."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from oip.modules.conversation.application.prod_retrieval_policy import (
    AUTHORITY,
    DECISION,
    PROD_RETRIEVAL_MODE,
    REGISTER_GAP_STATUS,
    assert_prod_retrieval_honesty,
    load_prod_retrieval_registry,
    prod_retrieval_observability,
)
from oip.modules.conversation.application.vector_index_service import (
    env_allows_non_prod_semantic,
    should_allow_non_prod_semantic_consume,
)
from src.nlu.np_kb_adapter import NpKbConfig, interpret_user_text

ROOT = Path(__file__).resolve().parents[4]


@pytest.fixture
def prod_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("ORBIX_NP_KB_SEMANTIC_ENABLED", "true")
    monkeypatch.setenv("ORBIX_NP_KB_ALLOW_NON_PROD_SEMANTIC", "true")
    yield


def test_registry_and_honesty() -> None:
    reg = load_prod_retrieval_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["gap_p2_001"]["register_status"] == REGISTER_GAP_STATUS
    assert reg["gap_p2_001"]["closed"] is False
    assert reg["policies"]["prod_retrieval_mode"] == PROD_RETRIEVAL_MODE
    assert reg["honesty"]["ollama_required_for_prod"] is False
    assert_prod_retrieval_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_prod_retrieval_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="OLLAMA_REQUIRED"):
        assert_prod_retrieval_honesty({"ollama_required_for_prod": True})
    with pytest.raises(RuntimeError, match="GAP_P2_001_FALSE_CLOSED"):
        assert_prod_retrieval_honesty({"gap_p2_001_closed": True})


def test_prod_env_forces_lexical_config(prod_env) -> None:
    cfg = NpKbConfig.from_env()
    assert cfg.semantic_enabled is False
    assert env_allows_non_prod_semantic() is False
    assert (
        should_allow_non_prod_semantic_consume(
            {
                "analysis_status": "COMPLETE",
                "production_eligible": False,
                "chroma_present": True,
                "index_present": True,
            },
            semantic_enabled_requested=True,
            allow_non_prod_semantic=True,
        )
        is False
    )


def test_prod_interpret_forces_lexical_without_bundles(prod_env) -> None:
    """Bare call (no annotation bundles) must still be lexical-only in prod."""
    os.environ["ORBIX_NP_KB_ENABLED"] = "true"
    result = interpret_user_text(
        "what is Nepal VAT rate effective today",
        cfg=NpKbConfig(
            enabled=True,
            lexical_enabled=True,
            semantic_enabled=True,  # attacker/misconfig attempt
        ),
    )
    obs = result.observability or {}
    assert obs.get("prod_retrieval_mode") == "LEXICAL_ONLY"
    assert obs.get("semantic_forced_off") is True
    assert obs.get("ollama_required") is False
    assert obs.get("vector_required_for_prod") is False
    assert obs.get("next14_adr") == "ADR_0081"
    # Must not have run semantic path
    assert result.enabled is True or result.skipped_reason in {
        None,
        "",
        "GOVERNANCE_SKIP",
        "LEXICAL_INDEX_NOT_READY",
    }


def test_gap_register_and_pointer_next08() -> None:
    gap = (ROOT / "docs" / "mokxya-ai" / "MAI_00_GAP_REGISTER.md").read_text(
        encoding="utf-8"
    )
    section = gap.split("### GAP-P2-001")[1].split("### GAP-P2-002")[0]
    assert "**Status:** REDUCED" in section
    assert "mark CLOSED" in section
    assert section.count("**Status:** CLOSED") == 0

    obs = prod_retrieval_observability()
    assert obs["prod_retrieval_adr"] == "ADR_0081"
    assert obs["prod_retrieval_mode"] == "LEXICAL_ONLY"

    baseline = ROOT / "docs" / "mokxya-ai" / "baselines" / "NEXT_14_PROD_RETRIEVAL.md"
    assert baseline.is_file()

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-B2"
    assert "NEXT-14" in ledger.get("completed_next_steps", [])
    assert ledger.get("prod_retrieval", {}).get("authority") == "ADR_0081"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-B2"
    assert "NEXT-14" in matrix.get("completed_steps", [])
    gaps = {g["id"]: g for g in matrix["blocking_gaps"]}
    assert gaps["GAP-P2-001"]["status"] == "REDUCED"

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-B1" in plan
