"""MAI-06 closure — structural reconstruction and exact integer boundaries."""

from __future__ import annotations

import random
from pathlib import Path

import pytest

from src.oip.contracts.normalization import SafetyClass, ViewType
from src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from src.oip.modules.language_runtime.normalization.application.normalization_service import (
    get_preserved_raw,
    normalize_text,
    reconstruct_from_view,
    reconstruct_view_structurally,
)
from src.oip.modules.language_runtime.normalization.domain.offset_ops import (
    float_interpolation_usage_count,
    map_raw_span_to_norm,
)
from src.oip.modules.language_runtime.normalization.domain.reconstruction import (
    ReconstructionError,
    validate_offset_map,
)

OFFSET_OPS_SRC = (
    Path(__file__).resolve().parents[3]
    / "src"
    / "oip"
    / "modules"
    / "language_runtime"
    / "normalization"
    / "domain"
    / "offset_ops.py"
)
SEED = 20260714
GENERATED_COUNT = 1000


def _views():
    return (ViewType.UNICODE_CANONICAL, ViewType.SAFE_SEMANTIC, ViewType.RETRIEVAL)


def _assert_structural(raw: str) -> None:
    frame = analyze_language(raw)
    bundle = normalize_text(raw, language_frame=frame)
    assert get_preserved_raw(bundle) == raw
    corrupted = bundle.model_copy(update={"raw_text": "CORRUPTED_SHOULD_NOT_BE_USED"})
    for vt in _views():
        view = corrupted.view(vt)
        assert view is not None
        applied = [e for e in corrupted.edits if vt in e.applied_views]
        rebuilt = reconstruct_from_view(
            view.text, applied, view.offset_map, integrity=view.integrity, view_type=vt
        )
        assert rebuilt == raw
        assert rebuilt != corrupted.raw_text


def test_no_float_ratio_in_offset_ops():
    src = OFFSET_OPS_SRC.read_text(encoding="utf-8")
    assert float_interpolation_usage_count(src) == 0


def test_preservation_vs_reconstruction_are_distinct():
    raw = "cafe\u0301  and  CASH\u00a0१x"
    frame = analyze_language(raw)
    bundle = normalize_text(raw, language_frame=frame)
    preserved = get_preserved_raw(bundle)
    structural = reconstruct_view_structurally(bundle, ViewType.RETRIEVAL)
    assert preserved == raw == structural
    bad = bundle.model_copy(update={"raw_text": "XXX"})
    assert get_preserved_raw(bad) == "XXX"
    assert reconstruct_view_structurally(bad, ViewType.RETRIEVAL) == raw


def test_anti_shortcut_destroy_raw_field():
    raw = "a\r\nß  hello\u00a0world code१२tip"
    frame = analyze_language(raw)
    bundle = normalize_text(raw, language_frame=frame)
    view = bundle.view(ViewType.RETRIEVAL)
    assert view is not None
    applied = [e for e in bundle.edits if ViewType.RETRIEVAL in e.applied_views]
    rebuilt = reconstruct_from_view(
        view.text,
        applied,
        view.offset_map,
        integrity=view.integrity,
        view_type=ViewType.RETRIEVAL,
    )
    assert rebuilt == raw


@pytest.mark.parametrize(
    "raw",
    [
        "cafe\u0301",
        "a\r\nb",
        "a\rb",
        "CASH\u00a0x",
        "  hello  ",
        "hello   world",
        "code१२३tip",
        "ßCASE",
        "go https://Example.TEST/p NOW",
        "invoice no INV-9001 paid TODAY",
        "supplier PAN EVAL123456 details",
        "नेपाल\u093e",
        "hi\u200d😀",
        "qty १२० units",
    ],
)
def test_transform_cases_structural(raw: str):
    _assert_structural(raw)


def test_corrupt_edit_fails():
    from src.oip.modules.language_runtime.normalization.domain.reconstruction import (
        ReconstructionIntegrityError,
    )

    raw = "CASH\u00a0balance"
    frame = analyze_language(raw)
    bundle = normalize_text(raw, language_frame=frame)
    view = bundle.view(ViewType.SAFE_SEMANTIC)
    applied = [e for e in bundle.edits if ViewType.SAFE_SEMANTIC in e.applied_views]
    assert applied
    e0 = applied[0]
    bad = list(applied)
    alt = ("W" * len(e0.original_surface)) if e0.original_surface else "W"
    bad[0] = e0.model_copy(update={"original_surface": alt})
    with pytest.raises(ReconstructionIntegrityError):
        reconstruct_from_view(
            view.text, bad, view.offset_map, integrity=view.integrity, view_type=ViewType.SAFE_SEMANTIC
        )


def test_missing_edit_fails():
    raw = "  hello  "
    frame = analyze_language(raw)
    bundle = normalize_text(raw, language_frame=frame)
    view = bundle.view(ViewType.RETRIEVAL)
    assert view is not None
    if not any(s.edit_id for s in view.offset_map.segments):
        pytest.skip("no mapped edits")
    with pytest.raises(ReconstructionError) as ei:
        reconstruct_from_view(
            view.text, [], view.offset_map, integrity=view.integrity, view_type=ViewType.RETRIEVAL
        )
    assert ei.value.code in {
        "MISSING_EDIT",
        "INVALID_MAP",
        "EDITS_DIGEST_MISMATCH",
        "ORPHAN_APPLIED_EDIT",
    }


def test_corrupt_view_fails():
    raw = "cafe\u0301"
    frame = analyze_language(raw)
    bundle = normalize_text(raw, language_frame=frame)
    view = bundle.view(ViewType.UNICODE_CANONICAL)
    applied = [e for e in bundle.edits if ViewType.UNICODE_CANONICAL in e.applied_views]
    if not applied:
        pytest.skip("no NFC edit")
    with pytest.raises(ReconstructionError):
        reconstruct_from_view(
            "X" * len(view.text),
            applied,
            view.offset_map,
            integrity=view.integrity,
            view_type=ViewType.UNICODE_CANONICAL,
        )

def test_protected_identity_mapping():
    samples = [
        "see https://example.test/a now",
        "mail eval.user@example.test please",
        "supplier PAN EVAL123456 details",
        "VAT no EVALVAT9988 on bill",
        "invoice no INV-9001 paid",
        "account code ACC-42 balance",
        "FY 2081/82 trial",
        "dated 2024-07-14 payment",
        "paid NPR 1500 cash",
        "discount 10% applied",
        "call phone 9800000000 about",
        "use `SELECT 1` carefully",
        "payload {\"a\":1} ignored",
    ]
    for raw in samples:
        frame = analyze_language(raw)
        bundle = normalize_text(raw, language_frame=frame)
        assert frame.protected_spans
        for vt in _views():
            v = bundle.view(vt)
            for p in frame.protected_spans:
                ns, ne = map_raw_span_to_norm(v.offset_map, p.start_offset, p.end_offset)
                assert v.text[ns:ne] == p.original_text
                assert (ne - ns) == (p.end_offset - p.start_offset)
            assert reconstruct_view_structurally(bundle, vt) == raw


def test_generated_structural_corpus():
    rng = random.Random(SEED)
    alphabet = list("abcDEF xyz") + list("नेपालक") + ["\u0301", "\u00a0", "\r", "\n", "1", "१", "ß", "😀"]
    protected_bits = [
        "https://example.test/z",
        "eval.user@example.test",
        "PAN EVAL999001",
        "invoice no INV-42",
    ]
    ok = 0
    for i in range(GENERATED_COUNT):
        n = rng.randint(1, 24)
        chars = [rng.choice(alphabet) for _ in range(n)]
        raw = "".join(chars)
        if i % 7 == 0:
            bit = rng.choice(protected_bits)
            pos = rng.randint(0, len(raw))
            raw = raw[:pos] + " " + bit + " " + raw[pos:]
        if not raw.strip():
            raw = "x"
        frame = analyze_language(raw)
        bundle = normalize_text(raw, language_frame=frame)
        assert get_preserved_raw(bundle) == raw
        for vt in _views():
            rebuilt = reconstruct_view_structurally(bundle, vt)
            assert rebuilt == raw
            v = bundle.view(vt)
            rep = validate_offset_map(
                v.offset_map,
                view_text=v.text,
                applied_edits=[e for e in bundle.edits if vt in e.applied_views],
            )
            assert rep.ok, rep.errors
            if len(raw) >= 1:
                rs, re = 0, min(1, len(raw))
                ns, ne = map_raw_span_to_norm(v.offset_map, rs, re)
                assert 0 <= ns <= ne <= len(v.text)
        ok += 1
    assert ok == GENERATED_COUNT


def test_candidate_edits_do_not_affect_reconstruction():
    raw = "check amt hellooo"
    bundle = normalize_text(raw, protected_spans=())
    cands = [e for e in bundle.edits if e.safety_class is SafetyClass.CANDIDATE_ONLY]
    assert cands
    assert all(e.applied_views == () for e in cands)
    assert reconstruct_view_structurally(bundle, ViewType.RETRIEVAL) == raw
