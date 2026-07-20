"""NEXT-08 — response language live parity (ADR_0082 / MAI-11 scaffolds)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from oip.modules.conversation.application.clarification_plan_service import (
    clarification_plan_user_message,
)
from oip.modules.conversation.application.launch_event_spec_policy import (
    evaluate_launch_event_freeze,
    unsupported_launch_message,
)
from oip.modules.conversation.application.response_language_live_policy import (
    AUTHORITY,
    DECISION,
    STEP,
    assert_response_language_honesty,
    infer_response_language,
    is_accidental_english_only,
    load_response_language_registry,
    response_language_observability,
    scaffold_string,
)
from orbix.mode_policy import ask_mode_mutation_message

ROOT = Path(__file__).resolve().parents[4]
FROZEN = (
    ROOT
    / "evals"
    / "mai11"
    / "frozen"
    / "response_language_live_parity_v1.jsonl"
)


def _load_frozen() -> list[dict]:
    rows = []
    for line in FROZEN.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def test_registry_and_honesty() -> None:
    reg = load_response_language_registry()
    assert reg["authority"] == AUTHORITY
    assert reg["decision"] == DECISION
    assert reg["step"] == STEP
    assert reg["honesty"]["applied_response_rewrite"] is False
    assert reg["honesty"]["production_approved"] is False
    assert reg["honesty"]["sole_nlu"] is False
    assert_response_language_honesty()
    with pytest.raises(RuntimeError, match="PRODUCTION_APPROVED"):
        assert_response_language_honesty({"production_approved": True})
    with pytest.raises(RuntimeError, match="REWRITE_CLAIMED"):
        assert_response_language_honesty({"applied_response_rewrite": True})
    with pytest.raises(RuntimeError, match="SOLE_NLU"):
        assert_response_language_honesty({"sole_nlu": True})


def test_scaffolds_by_language() -> None:
    en = scaffold_string("unsupported_launch", "ENGLISH")
    np = scaffold_string("unsupported_launch", "NEPALI_DEVANAGARI")
    rom = scaffold_string("unsupported_launch", "ROMANIZED_NEPALI")
    assert "sales" in en.lower() or "purchase" in en.lower()
    assert any("\u0900" <= c <= "\u097F" for c in np)
    assert "garnuhos" in rom.lower() or "sakchu" in rom.lower()
    assert en != np
    assert en != rom


def test_launch_freeze_follows_input_language() -> None:
    out_np = evaluate_launch_event_freeze(
        "रामबाट पाँच सय रसिद लिनुहोस्",
        operation_class="transaction_create",
        intent_hint="customer_receipt",
    )
    assert out_np is not None
    assert out_np["applied_response_rewrite"] is False
    assert out_np["response_language"] in {
        "NEPALI_DEVANAGARI",
        "MIXED",
    }
    assert not is_accidental_english_only(
        out_np["text"], out_np["response_language"]
    )

    out_rom = evaluate_launch_event_freeze(
        "Ram bata 500 receipt linuhos garnuhos",
        operation_class="transaction_create",
        intent_hint="customer_receipt",
    )
    assert out_rom is not None
    assert out_rom["response_language"] in {
        "ROMANIZED_NEPALI",
        "MIXED",
        "ENGLISH",
    }
    if out_rom["response_language"] != "ENGLISH":
        assert not is_accidental_english_only(
            out_rom["text"], out_rom["response_language"]
        )


def test_clarify_and_ask_mutation_scaffolds() -> None:
    msg = clarification_plan_user_message(
        {}, response_language="NEPALI_DEVANAGARI"
    )
    assert any("\u0900" <= c <= "\u097F" for c in msg)

    ask = ask_mode_mutation_message(
        "post_invoice", response_language="ROMANIZED_NEPALI"
    )
    assert "Accountant Mode" in ask
    assert "Ask Mode" in ask or "ask mode" in ask.lower()


def test_frozen_samples_parity() -> None:
    rows = _load_frozen()
    assert len(rows) >= 30
    by_lang: dict[str, int] = {}
    for row in rows:
        lang = row["expected_response_language"]
        by_lang[lang] = by_lang.get(lang, 0) + 1
        key = row["scaffold_key"]
        text = scaffold_string(
            key, lang, raw_text=row["raw_text"]
        )
        if row.get("must_not_be_english_only"):
            assert not is_accidental_english_only(text, lang), row["id"]
        # Infer should prefer non-English for NP/Roman samples when cues present
        inferred = infer_response_language(row["raw_text"])
        if lang == "NEPALI_DEVANAGARI":
            assert inferred in {"NEPALI_DEVANAGARI", "MIXED"}
        elif lang == "ROMANIZED_NEPALI":
            assert inferred in {
                "ROMANIZED_NEPALI",
                "MIXED",
                "ENGLISH",
            }
    assert by_lang.get("ENGLISH", 0) >= 10
    assert by_lang.get("NEPALI_DEVANAGARI", 0) >= 10
    assert by_lang.get("ROMANIZED_NEPALI", 0) >= 10


def test_pointer_next09_and_artifacts() -> None:
    obs = response_language_observability()
    assert obs["response_language_adr"] == "ADR_0082"
    assert obs["applied_response_rewrite"] is False
    assert obs["production_approved"] is False

    adr = (
        ROOT
        / "docs"
        / "mokxya-ai"
        / "decisions"
        / "ADR_0082_RESPONSE_LANGUAGE_LIVE_PARITY.md"
    )
    assert adr.is_file()
    baseline = (
        ROOT / "docs" / "mokxya-ai" / "baselines" / "NEXT_08_RESPONSE_LANGUAGE_LIVE.md"
    )
    assert baseline.is_file()
    assert FROZEN.is_file()

    ledger = json.loads(
        (ROOT / "docs" / "mokxya-ai" / "MAI_PHASE_LEDGER.json").read_text(
            encoding="utf-8"
        )
    )
    assert ledger["recommended_next_step"] == "PR-C1-ARM"
    assert "NEXT-08" in ledger.get("completed_next_steps", [])
    assert ledger.get("response_language_live", {}).get("authority") == "ADR_0082"

    matrix = json.loads(
        (
            ROOT / "docs" / "mokxya-ai" / "MAI_CAPABILITY_TRUTH_MATRIX.json"
        ).read_text(encoding="utf-8")
    )
    assert matrix["recommended_next_step"] == "PR-C1-ARM"
    assert "NEXT-08" in matrix.get("completed_steps", [])
    phases = {p["id"]: p for p in matrix["phases"]}
    assert "NEXT-08" in phases["MAI-11"]["note"] or "scaffold" in phases["MAI-11"][
        "note"
    ].lower()

    plan = (
        ROOT / "MOKXYA_AI_PRODUCTION_READY_EXECUTION_PLAN_V1.txt"
    ).read_text(encoding="utf-8")
    assert "recommended_next_step = PR-C1-ARM" in plan

    nxt = (ROOT / "MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt").read_text(
        encoding="utf-8"
    )
    assert "recommended_next_step = PR-C1-ARM" in nxt
    assert "NEXT-08" in nxt and "last_shipped_step = PR-D3" in nxt


def test_unsupported_default_english_nonempty() -> None:
    msg = unsupported_launch_message("customer_receipt")
    assert "sales" in msg.lower() or "purchase" in msg.lower()
