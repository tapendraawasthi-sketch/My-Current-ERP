"""MAI-05 language runtime unit and integration tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.oip.contracts.language import AnalysisStatus
from src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from src.oip.modules.language_runtime.domain.offsets import assert_span_roundtrip, covered_exactly, slice_codepoints
from src.oip.modules.language_runtime.domain.protected import detect_protected_spans
from src.oip.modules.language_runtime.domain.script import ScriptCategory, classify_char_script, detect_quality_flags
from src.oip.modules.language_runtime.infrastructure.compact_resource_repository import load_resources
from src.oip.infrastructure.observability import mai03 as mai03_obs

REPO = Path(__file__).resolve().parents[4]
MAI04_MANIFEST = REPO / "evals" / "mai04" / "manifests" / "MAI_04_FROZEN_V1.manifest.json"
MAI05_MANIFEST = REPO / "evals" / "mai05" / "manifests" / "MAI_05_LANGUAGE_SPANS_V1.manifest.json"


def test_script_categories():
    assert classify_char_script("क") is ScriptCategory.DEVANAGARI
    assert classify_char_script("a") is ScriptCategory.LATIN
    assert classify_char_script("5") is ScriptCategory.ASCII_DIGIT
    assert classify_char_script("५") is ScriptCategory.DEVANAGARI_DIGIT
    assert classify_char_script(" ") is ScriptCategory.WHITESPACE
    assert classify_char_script("😀") in {ScriptCategory.EMOJI, ScriptCategory.SYMBOL}
    assert classify_char_script("\u202e") is ScriptCategory.CONTROL


def test_offset_roundtrip_emoji_combining():
    text = "नेपाला hi 😀"
    for start in range(len(text)):
        for end in range(start, len(text) + 1):
            surface = slice_codepoints(text, start, end)
            assert_span_roundtrip(text, start, end, surface)


def test_analyze_does_not_mutate_raw():
    raw = "mero cash balance kati xa"
    frame = analyze_language(raw)
    assert frame.raw_text == raw
    assert frame.analysis_status is AnalysisStatus.COMPLETE
    assert covered_exactly(raw, [(a.start_offset, a.end_offset) for a in frame.span_annotations])


def test_url_email_protected_atomic():
    text = "mail eval.user@example.test and https://example.test/x"
    hits = detect_protected_spans(text)
    kinds = {h.kind.value for h in hits}
    assert "EMAIL" in kinds
    assert "URL" in kinds
    frame = analyze_language(text)
    for a in frame.span_annotations:
        if a.protected_reason == "URL":
            assert " " not in a.original_text
            assert a.original_text.startswith("https://")


def test_ambiguous_latin_not_forced():
    frame = analyze_language("ma bill check")
    forms = {a.language_form for a in frame.span_annotations if not a.original_text.isspace()}
    assert "SHARED_OR_AMBIGUOUS_LATIN" in forms or any(
        a.confidence and a.confidence.value < 0.7
        for a in frame.span_annotations
        if a.original_text.lower() in {"ma", "bill"}
    )


def test_romanized_high_confidence():
    frame = analyze_language("kati xa paisa")
    assert any(a.language_form == "ROMANIZED_NEPALI" for a in frame.span_annotations)


def test_devanagari_form():
    frame = analyze_language("नगद मौज्दात कति छ")
    assert any(a.language_form == "NEPALI_DEVANAGARI" for a in frame.span_annotations)


def test_number_not_auto_pan():
    frame = analyze_language("code 123456789 alone")
    kinds = {a.protected_reason for a in frame.span_annotations if a.protected_reason}
    assert "PAN_CANDIDATE" not in kinds


def test_explicit_pan_protected():
    frame = analyze_language("supplier PAN EVAL123456 details")
    assert any(a.protected_reason == "PAN_CANDIDATE" for a in frame.span_annotations)


def test_bidi_and_zw_flags():
    flags = detect_quality_flags("hi\u202eworld\u200b")
    assert "BIDI_CONTROL_PRESENT" in flags
    assert "ZERO_WIDTH_PRESENT" in flags
    frame = analyze_language("hi\u202eworld\u200b")
    assert frame.raw_text == "hi\u202eworld\u200b"


def test_resources_cached_not_reloaded():
    a = load_resources()
    b = load_resources()
    assert a is b
    assert a.content_hash


def test_analyzer_failure_preserves_text():
    # empty invalid for LanguageFrame min_length — empty string bypass via whitespace only
    frame = analyze_language(" ")
    assert frame.raw_text == " "


@pytest.mark.asyncio
async def test_ingress_attaches_language_frame_without_routing_change(monkeypatch):
    from unittest.mock import MagicMock, patch
    from src.api.oip_chat_ingress import build_canonical_ai_request

    trusted = MagicMock()
    trusted.principal_id = "user-1"
    trusted.tenant_id = "tenant-1"
    trusted.active_company_id = "co-1"
    trusted.allows_company = lambda c: True
    trusted.authentication_method = "jwt"
    trusted.roles = ("accountant",)
    trusted.permissions = ("oip:read",)

    mai03_obs.reset_trace_recorder_for_tests()
    mai03_obs.clear_trace_context()
    with patch(
        "src.oip.domain.constitution.enforcement.enforce_chat_identity_and_mode",
        return_value=(trusted, None),
    ):
        mai03_obs.start_request_trace()
        canonical = await build_canonical_ai_request(
            message="mero balance kati xa",
            session_id="sess-mai05",
            orbix_mode="ask",
        )
    assert canonical.language_frame is not None
    assert canonical.language_frame.raw_text == canonical.raw_text
    assert canonical.raw_text == "mero balance kati xa"
    events = mai03_obs.get_memory_trace_sink().all_events()
    stages = [e.get("stage") for e in events]
    assert "LANGUAGE_ANALYSIS_STARTED" in stages
    blob = str(events)
    assert "mero" not in blob
    assert "kati" not in blob


def test_mai04_hash_unchanged():
    man = json.loads(MAI04_MANIFEST.read_text(encoding="utf-8"))
    assert man["dataset_hash"] == "1fe463dc302b7e990b8e3bb0abcd5a0cbf4e05fcab4eaec30a27ed3b4a1b6fac"


def test_mai05_manifest_min_coverage():
    man = json.loads(MAI05_MANIFEST.read_text(encoding="utf-8"))
    assert man["total_cases"] >= 300
    assert man["prohibited_for_training"] is True
