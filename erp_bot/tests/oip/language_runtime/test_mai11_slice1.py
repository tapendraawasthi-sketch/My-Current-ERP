"""MAI-11 slice 1 — response language / register policy."""

from __future__ import annotations

from src.oip.contracts.language import LanguageFrameV1
from src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from src.oip.modules.language_runtime.response_register import RUNTIME_VERSION
from src.oip.modules.language_runtime.response_register.application.response_register_service import (
    attach_response_register_to_frame,
    decide_response_register,
)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-11.0.1-slice1"


def test_devanagari_shop_response_language() -> None:
    frame = analyze_language("आजको बिक्री कति भयो")
    updated = attach_response_register_to_frame(frame)
    assert updated.raw_text == frame.raw_text
    bundle = updated.response_register_bundle
    assert bundle is not None
    assert bundle.response_language.value == "NEPALI_DEVANAGARI"
    assert updated.dominant_response_language == "NEPALI_DEVANAGARI"
    assert bundle.mirror_user_language is True
    assert bundle.silent_applications == 0
    assert bundle.applied_response_rewrite is False


def test_romanized_shop_response_language() -> None:
    frame = analyze_language("aaja ko bikri kati bhayo")
    updated = attach_response_register_to_frame(frame)
    bundle = updated.response_register_bundle
    assert bundle is not None
    assert bundle.response_language.value == "ROMANIZED_NEPALI"
    assert updated.linguistic_register in {"SHOP_INFORMAL", "NEUTRAL"}


def test_english_accounting_formal() -> None:
    frame = analyze_language("Please post the journal entry to the ledger")
    updated = attach_response_register_to_frame(frame)
    bundle = updated.response_register_bundle
    assert bundle is not None
    assert bundle.response_language.value == "ENGLISH"
    assert bundle.linguistic_register.value == "ACCOUNTING_FORMAL"


def test_honorific_shop_informal() -> None:
    bundle = decide_response_register(
        raw_text="tapai ko hisaab kati cha",
        language_distribution={"ROMANIZED_NEPALI": 0.8},
        code_mix_pattern="ROMANIZED_NEPALI_ONLY",
    )
    assert bundle.linguistic_register.value == "SHOP_INFORMAL"
    assert bundle.honorific_cue is not None


def test_never_rewrites() -> None:
    from pydantic import ValidationError
    from src.oip.contracts.response_register import ResponseRegisterBundleV1

    try:
        ResponseRegisterBundleV1(applied_response_rewrite=True)
        raise AssertionError("expected ValidationError")
    except ValidationError:
        pass


def test_attach_fills_frame_fields() -> None:
    frame = LanguageFrameV1.not_run("sales report please")
    # Simulate MAI-05 distribution without full analyzer path.
    frame = frame.model_copy(
        update={
            "language_distribution": {"ENGLISH": 0.9},
            "code_mix_pattern": "ENGLISH_ONLY",
        }
    )
    updated = attach_response_register_to_frame(frame)
    assert updated.dominant_response_language == "ENGLISH"
    assert updated.linguistic_register is not None
    assert updated.analyzer_versions.get("response_register") == RUNTIME_VERSION


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai11"
        / "frozen"
        / "response_register_critical_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        frame = analyze_language(case["raw_text"])
        updated = attach_response_register_to_frame(frame)
        bundle = updated.response_register_bundle
        assert bundle is not None
        if "expected_response_language" in case:
            assert bundle.response_language.value == case["expected_response_language"], case[
                "case_id"
            ]
        if "expected_register" in case:
            assert bundle.linguistic_register.value == case["expected_register"], case["case_id"]
        if "expected_mirror" in case:
            assert bundle.mirror_user_language is case["expected_mirror"], case["case_id"]
        assert bundle.silent_applications == 0
        assert bundle.applied_response_rewrite is False
