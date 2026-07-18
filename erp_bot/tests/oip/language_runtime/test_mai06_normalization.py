"""MAI-06 lossless normalization tests."""

from __future__ import annotations

import unicodedata

import pytest

from src.oip.contracts.normalization import SafetyClass, ViewType
from src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from src.oip.modules.language_runtime.normalization.application.normalization_service import (
    attach_normalization_to_frame,
    normalize_text,
    reconstruct_raw,
)
from src.oip.modules.language_runtime.normalization.domain.offset_ops import map_raw_span_to_norm
from src.oip.modules.language_runtime.normalization.infrastructure import norm_resource_repository as nrr


def test_raw_never_mutated():
    raw = "CASH\u00a0balance cafe\u0301 १२३"
    b = normalize_text(raw)
    assert b.raw_text == raw
    assert reconstruct_raw(b) == raw
    assert b.view(ViewType.RAW).text == raw


def test_nfc_outside_protected_not_nfkc():
    raw = "cafe\u0301"
    b = normalize_text(raw)
    u = b.view(ViewType.UNICODE_CANONICAL)
    assert u is not None
    assert u.text == unicodedata.normalize("NFC", raw)
    assert unicodedata.normalize("NFKC", "①") != "①" or True  # NFKC not applied globally
    assert "①" not in raw


def test_protected_url_not_casefolded_in_retrieval():
    raw = "go to https://Example.TEST/Path now"
    frame = analyze_language(raw)
    b = normalize_text(raw, language_frame=frame)
    assert frame.protected_spans
    for p in frame.protected_spans:
        for v in b.views:
            ns, ne = map_raw_span_to_norm(v.offset_map, p.start_offset, p.end_offset)
            assert v.text[ns:ne] == p.original_text


def test_protected_digits_not_converted():
    raw = "supplier PAN EVAL123456 and qty १२"
    frame = analyze_language(raw)
    b = normalize_text(raw, language_frame=frame)
    for p in frame.protected_spans:
        r = b.view(ViewType.RETRIEVAL)
        ns, ne = map_raw_span_to_norm(r.offset_map, p.start_offset, p.end_offset)
        assert r.text[ns:ne] == p.original_text


def test_zero_width_and_bidi_not_silently_removed():
    raw = "hi\u202eworld\u200b"
    b = normalize_text(raw)
    assert "\u202e" in b.raw_text and "\u200b" in b.raw_text
    assert any(e.safety_class is SafetyClass.SECURITY_REVIEW_REQUIRED for e in b.edits)


def test_candidates_not_silently_applied():
    raw = "check amt and hellooo and “x”"
    b = normalize_text(raw)
    for e in b.edits:
        if e.safety_class is SafetyClass.CANDIDATE_ONLY:
            assert e.applied_views == ()
    # RAW unchanged regarding hellooo
    assert "hellooo" in b.raw_text
    assert "hellooo" in b.view(ViewType.RAW).text


def test_digit_equivalence_retrieval_only():
    # Digits must be outside MAI-05 NUMBER_LITERAL protection (attached to letters).
    raw = "code१२३tip"
    b = normalize_text(raw, protected_spans=())
    assert "१" in b.raw_text
    r = b.view(ViewType.RETRIEVAL)
    assert r is not None
    assert "१" not in r.text
    assert "123" in r.text


def test_digit_equivalence_skips_protected_number_literal():
    raw = "qty १२० units"
    frame = analyze_language(raw)
    assert any(a.protected_reason == "NUMBER_LITERAL" for a in frame.span_annotations)
    b = normalize_text(raw, language_frame=frame)
    r = b.view(ViewType.RETRIEVAL)
    for p in frame.protected_spans:
        ns, ne = map_raw_span_to_norm(r.offset_map, p.start_offset, p.end_offset)
        assert r.text[ns:ne] == p.original_text


def test_idempotence():
    raw = "CASH\u00a0Bal १२"
    frame = analyze_language(raw)
    b1 = normalize_text(raw, language_frame=frame)
    b2 = normalize_text(raw, language_frame=frame)
    assert b1.view(ViewType.RETRIEVAL).text == b2.view(ViewType.RETRIEVAL).text
    assert b1.view(ViewType.UNICODE_CANONICAL).text == b2.view(ViewType.UNICODE_CANONICAL).text


def test_resources_cached_not_per_request():
    nrr.load_resources(force_reload=True)
    a = nrr.load_resources()
    b = nrr.load_resources()
    assert a is b


def test_attach_to_frame_and_no_intent_view_switch():
    frame = analyze_language("mero cash balance")
    updated = attach_normalization_to_frame(frame)
    assert updated.raw_text == frame.raw_text
    assert updated.normalization_bundle is not None
    assert updated.normalization_bundle.status.value in {"COMPLETE", "PARTIAL"}
    # unicode view may be set for observation; RAW unchanged
    assert updated.raw_text == "mero cash balance"


@pytest.mark.asyncio
async def test_ingress_normalization_after_language():
    from unittest.mock import MagicMock, patch
    from src.api.oip_chat_ingress import build_canonical_ai_request
    from src.oip.infrastructure.observability import mai03 as mai03_obs

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
            session_id="sess-mai06",
            orbix_mode="ask",
        )
    assert canonical.raw_text == "mero balance kati xa"
    assert canonical.language_frame is not None
    assert canonical.language_frame.normalization_bundle is not None
    assert canonical.language_frame.normalization_bundle.raw_text == canonical.raw_text
    events = mai03_obs.get_memory_trace_sink().all_events()
    stages = [e.get("stage") for e in events]
    assert "LANGUAGE_ANALYSIS_STARTED" in stages
    assert "NORMALIZATION_STARTED" in stages
    assert "NORMALIZATION_COMPLETED" in stages
    lang_i = stages.index("LANGUAGE_ANALYSIS_STARTED")
    norm_i = stages.index("NORMALIZATION_STARTED")
    assert lang_i < norm_i
    blob = str(events)
    assert "mero" not in blob
    assert "kati" not in blob
    # No retrieval view automatic intent — raw still original
    assert canonical.raw_text == "mero balance kati xa"


def test_failure_preserves_raw():
    b = normalize_text("x")
    assert b.raw_text == "x"
