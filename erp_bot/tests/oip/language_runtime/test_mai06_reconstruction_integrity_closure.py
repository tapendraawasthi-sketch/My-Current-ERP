"""MAI-06C2 — self-validating structural reconstruction integrity closure."""

from __future__ import annotations

import logging
import random

import pytest

from src.oip.contracts.normalization import MappingKind, NormalizationOperation, ViewType
from src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from src.oip.modules.language_runtime.normalization import NORMALIZER_VERSION
from src.oip.modules.language_runtime.normalization.application.normalization_service import (
    get_preserved_raw,
    normalize_text,
    reconstruct_from_view,
    reconstruct_view_structurally,
)
from src.oip.modules.language_runtime.normalization.domain.integrity import (
    build_reconstruction_integrity,
    digest_edits,
    digest_offset_map,
    digest_text,
)
from src.oip.modules.language_runtime.normalization.domain.reconstruction import (
    ReconstructionIntegrityError,
    UnsupportedReconstructionVersionError,
)
from src.oip.infrastructure.observability import mai03 as mai03_obs

SEED = 20260714
GENERATED_COUNT = 1000


def _views():
    return (ViewType.UNICODE_CANONICAL, ViewType.SAFE_SEMANTIC, ViewType.RETRIEVAL)


def _bundle(raw: str):
    return normalize_text(raw, language_frame=analyze_language(raw))


def _artifacts(bundle, vt: ViewType):
    view = bundle.view(vt)
    assert view is not None
    assert view.integrity is not None
    applied = [e for e in bundle.edits if vt in e.applied_views]
    return view, applied


def test_valid_reconstruction_matrix():
    samples = [
        "cafe\u0301",
        "a\r\nb",
        "CASH\u00a0x",
        "  hello  ",
        "hello   world",
        "ßCASE",
        "code१२३tip",
        "नेपाल\u093e",
        "hi\u200d😀",
        "go https://Example.TEST/p NOW",
        "invoice no INV-9001 paid TODAY",
        "qty १२० units mixed नेपाल",
    ]
    for raw in samples:
        bundle = _bundle(raw)
        assert get_preserved_raw(bundle) == raw
        for vt in _views():
            assert reconstruct_view_structurally(bundle, vt) == raw


def test_same_length_original_surface_raises_integrity_error():
    raw = "CASH\u00a0balance and  spaces"
    bundle = _bundle(raw)
    view, applied = _artifacts(bundle, ViewType.SAFE_SEMANTIC)
    assert applied
    e0 = applied[0]
    alt = ("Z" * len(e0.original_surface)) if e0.original_surface else "Z"
    assert len(alt) == len(e0.original_surface)
    bad = list(applied)
    bad[0] = e0.model_copy(update={"original_surface": alt})
    with pytest.raises(ReconstructionIntegrityError) as ei:
        reconstruct_from_view(
            view.text, bad, view.offset_map, integrity=view.integrity, view_type=view.view_type
        )
    assert ei.value.code == "EDITS_DIGEST_MISMATCH"
    assert alt not in str(ei.value)
    assert e0.original_surface not in str(ei.value)


def _first_editable(bundle, preferred=None):
    order = preferred or (ViewType.SAFE_SEMANTIC, ViewType.RETRIEVAL, ViewType.UNICODE_CANONICAL)
    for vt in order:
        view, applied = _artifacts(bundle, vt)
        if applied:
            return view, applied, vt
    pytest.skip("no applied edits")


@pytest.mark.parametrize(
    "kind",
    [
        "original_same_len",
        "original_diff_len",
        "replacement_surface",
        "edit_removed",
        "edit_duplicated",
        "edits_reordered",
        "edit_id",
        "edit_operation",
        "source_boundary",
        "view_boundary",
        "mapping_kind",
        "map_removed",
        "map_duplicated",
        "map_reordered",
        "view_text",
        "view_name",
        "offset_unit",
        "normalizer_version",
        "integrity_digest",
    ],
)
def test_structural_corruption_matrix(kind: str):
    raw = "  cafe\u0301\r\nCASH\u00a0x  code१२ "
    bundle = _bundle(raw)
    view, applied, vt = _first_editable(bundle)
    integ = view.integrity
    om = view.offset_map
    text = view.text
    bad_applied = list(applied)
    bad_om = om
    bad_integ = integ
    bad_text = text
    expect = ReconstructionIntegrityError

    if kind == "original_same_len":
        e0 = applied[0]
        alt = ("Q" * len(e0.original_surface)) if e0.original_surface else "Q"
        bad_applied[0] = e0.model_copy(update={"original_surface": alt})
    elif kind == "original_diff_len":
        e0 = applied[0]
        bad_applied[0] = e0.model_copy(update={"original_surface": e0.original_surface + "X"})
    elif kind == "replacement_surface":
        e0 = applied[0]
        bad_applied[0] = e0.model_copy(update={"candidate_surface": e0.candidate_surface + "Y"})
    elif kind == "edit_removed":
        if len(applied) < 1:
            pytest.skip("need edit")
        bad_applied = applied[1:]
    elif kind == "edit_duplicated":
        bad_applied = list(applied) + [applied[0]]
    elif kind == "edits_reordered":
        if len(applied) < 2:
            # force reorder impossibility -> inject second by duplicating then swap ids via two views
            pytest.skip("need >=2 edits")
        bad_applied = list(reversed(applied))
    elif kind == "edit_id":
        e0 = applied[0]
        bad_applied[0] = e0.model_copy(update={"edit_id": e0.edit_id + "_mut"})
    elif kind == "edit_operation":
        e0 = applied[0]
        other = (
            NormalizationOperation.LATIN_CASEFOLD
            if e0.operation is not NormalizationOperation.LATIN_CASEFOLD
            else NormalizationOperation.WHITESPACE_COLLAPSE
        )
        bad_applied[0] = e0.model_copy(update={"operation": other})
    elif kind == "source_boundary":
        e0 = applied[0]
        rs = e0.raw_span
        bad_applied[0] = e0.model_copy(
            update={"raw_span": rs.model_copy(update={"end_offset": rs.end_offset + 1})}
        )
    elif kind == "view_boundary":
        e0 = applied[0]
        if e0.normalized_span is None:
            pytest.skip("no norm span")
        ns = e0.normalized_span
        bad_applied[0] = e0.model_copy(
            update={"normalized_span": ns.model_copy(update={"end_offset": ns.end_offset + 1})}
        )
    elif kind == "mapping_kind":
        if not om.segments:
            pytest.skip("no segments")
        segs = list(om.segments)
        s0 = segs[0]
        other = MappingKind.ONE_TO_ONE if s0.mapping_kind is MappingKind.IDENTITY else MappingKind.IDENTITY
        segs[0] = s0.model_copy(update={"mapping_kind": other})
        bad_om = om.model_copy(update={"segments": tuple(segs)})
    elif kind == "map_removed":
        if len(om.segments) < 2:
            pytest.skip("need segments")
        bad_om = om.model_copy(update={"segments": om.segments[1:]})
    elif kind == "map_duplicated":
        if not om.segments:
            pytest.skip("no segments")
        bad_om = om.model_copy(update={"segments": om.segments + (om.segments[0],)})
    elif kind == "map_reordered":
        if len(om.segments) < 2:
            pytest.skip("need segments")
        segs = list(om.segments)
        segs[0], segs[1] = segs[1], segs[0]
        bad_om = om.model_copy(update={"segments": tuple(segs)})
    elif kind == "view_text":
        bad_text = ("X" * len(text)) if text else "X"
    elif kind == "view_name":
        bad_integ = integ.model_copy(update={"view_name": ViewType.RAW.value})
    elif kind == "offset_unit":
        bad_integ = integ.model_copy(update={"offset_unit": "UTF16_CODE_UNIT"})
    elif kind == "normalizer_version":
        bad_integ = integ.model_copy(update={"normalizer_version": "mai-06.0.0"})
        expect = UnsupportedReconstructionVersionError
    elif kind == "integrity_digest":
        bad_integ = integ.model_copy(update={"artifact_digest": "0" * 64})
    else:
        raise AssertionError(kind)

    with pytest.raises(expect):
        reconstruct_from_view(
            bad_text,
            bad_applied,
            bad_om,
            integrity=bad_integ,
            view_type=vt,
        )


def test_cross_artifact_substitution():
    a = _bundle("  hello  CASH\u00a0one cafe\u0301")
    b = _bundle("\r\nWORLD  code१२ tip ß")
    for vt in _views():
        va, ea = _artifacts(a, vt)
        vb, eb = _artifacts(b, vt)
        mixes = [
            (va.text, eb, va.offset_map, va.integrity),
            (va.text, ea, vb.offset_map, va.integrity),
            (va.text, ea, va.offset_map, vb.integrity),
            (vb.text, ea, va.offset_map, va.integrity),
        ]
        if ea and eb:
            mixes.append((va.text, [eb[0]] + ea[1:], va.offset_map, va.integrity))
        for text, edits, om, integ in mixes:
            with pytest.raises(ReconstructionIntegrityError):
                reconstruct_from_view(text, edits, om, integrity=integ, view_type=vt)


def test_determinism_digests():
    raw = "cafe\u0301\r\n  CASH\u00a0x  code१ "
    b1 = _bundle(raw)
    b2 = _bundle(raw)
    for vt in _views():
        v1, e1 = _artifacts(b1, vt)
        v2, e2 = _artifacts(b2, vt)
        assert v1.integrity.model_dump() == v2.integrity.model_dump()
        assert digest_text(v1.text, role="VIEW") == digest_text(v2.text, role="VIEW")
        assert digest_edits(e1, vt) == digest_edits(e2, vt)
        assert digest_offset_map(v1.offset_map) == digest_offset_map(v2.offset_map)
        assert v1.integrity.artifact_digest == v2.integrity.artifact_digest
        assert reconstruct_view_structurally(b1, vt) == reconstruct_view_structurally(b2, vt) == raw


def test_privacy_exceptions_logs_and_traces(caplog):
    mai03_obs.reset_trace_recorder_for_tests()
    mai03_obs.clear_trace_context()
    raw = "SECRET_SURFACE cafe\u0301 CASH\u00a0pay"
    bundle = _bundle(raw)
    view, applied = _artifacts(bundle, ViewType.SAFE_SEMANTIC)
    assert applied
    bad = list(applied)
    bad[0] = applied[0].model_copy(update={"original_surface": "LEAK_ORIGINAL_SURFACE"})
    ctx = mai03_obs.create_trace_context()
    with mai03_obs.trace_context_scope(ctx):
        with caplog.at_level(logging.DEBUG):
            with pytest.raises(ReconstructionIntegrityError) as ei:
                reconstruct_from_view(
                    view.text, bad, view.offset_map, integrity=view.integrity, view_type=view.view_type
                )
    msg = f"{ei.value.code}:{ei.value.detail}:{ei.value}"
    events = str(mai03_obs.get_memory_trace_sink().all_events())
    joined = " ".join(r.message for r in caplog.records) + msg + events
    forbidden = [
        raw,
        view.text,
        "LEAK_ORIGINAL_SURFACE",
        applied[0].original_surface,
        applied[0].candidate_surface,
        view.integrity.source_digest,
        view.integrity.view_digest,
        view.integrity.edits_digest,
        view.integrity.offset_map_digest,
        view.integrity.artifact_digest,
    ]
    for item in forbidden:
        if item:
            assert item not in joined


def test_anti_shortcut_raw_inaccessible():
    raw = "a\r\nß  hello\u00a0world code१२tip नेपाल"
    bundle = _bundle(raw)
    poisoned = bundle.model_copy(update={"raw_text": "MUST_NOT_BE_USED_AS_SHORTCUT"})
    for vt in _views():
        view, applied = _artifacts(poisoned, vt)
        rebuilt = reconstruct_from_view(
            view.text, applied, view.offset_map, integrity=view.integrity, view_type=vt
        )
        assert rebuilt == raw
        assert rebuilt != poisoned.raw_text


def test_missing_integrity_unsupported():
    raw = "hello"
    bundle = _bundle(raw)
    view, applied = _artifacts(bundle, ViewType.SAFE_SEMANTIC)
    with pytest.raises(UnsupportedReconstructionVersionError):
        reconstruct_from_view(view.text, applied, view.offset_map, integrity=None, view_type=view.view_type)


def test_generated_valid_and_corruption_suite():
    rng = random.Random(SEED)
    alphabet = list("abcDEF xyz") + list("नेपालक") + ["\u0301", "\u00a0", "\r", "\n", "1", "१", "ß", "😀"]
    protected_bits = [
        "https://example.test/z",
        "eval.user@example.test",
        "PAN EVAL999001",
        "invoice no INV-42",
    ]
    ok_valid = 0
    ok_corrupt = 0
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
        bundle = _bundle(raw)
        assert get_preserved_raw(bundle) == raw
        vt = rng.choice(list(_views()))
        view, applied = _artifacts(bundle, vt)
        rebuilt = reconstruct_from_view(
            view.text, applied, view.offset_map, integrity=view.integrity, view_type=vt
        )
        assert rebuilt == raw
        ok_valid += 1

        # Mutate one structural component without refreshing trusted integrity
        mode = rng.choice(
            [
                "original",
                "view_text",
                "edit_id",
                "map_kind",
                "remove_edit",
                "artifact",
            ]
        )
        bad_applied = list(applied)
        bad_text = view.text
        bad_om = view.offset_map
        bad_integ = view.integrity
        if mode == "original" and applied:
            e0 = applied[0]
            alt = ("K" * len(e0.original_surface)) if e0.original_surface else "K"
            bad_applied[0] = e0.model_copy(update={"original_surface": alt})
        elif mode == "view_text":
            bad_text = ("V" * len(view.text)) if view.text else "V"
        elif mode == "edit_id" and applied:
            e0 = applied[0]
            bad_applied[0] = e0.model_copy(update={"edit_id": e0.edit_id + "_x"})
        elif mode == "map_kind" and view.offset_map.segments:
            segs = list(view.offset_map.segments)
            s0 = segs[0]
            other = MappingKind.ONE_TO_ONE if s0.mapping_kind is MappingKind.IDENTITY else MappingKind.IDENTITY
            segs[0] = s0.model_copy(update={"mapping_kind": other})
            bad_om = view.offset_map.model_copy(update={"segments": tuple(segs)})
        elif mode == "remove_edit" and applied:
            bad_applied = applied[1:]
        else:
            bad_integ = view.integrity.model_copy(update={"artifact_digest": "a" * 64})

        with pytest.raises(ReconstructionIntegrityError):
            reconstruct_from_view(
                bad_text,
                bad_applied,
                bad_om,
                integrity=bad_integ,
                view_type=vt,
            )
        ok_corrupt += 1

    assert ok_valid == GENERATED_COUNT
    assert ok_corrupt == GENERATED_COUNT


def test_rebuild_integrity_helper_matches_attached():
    raw = "a\r\nb CASH\u00a0z"
    bundle = _bundle(raw)
    for vt in _views():
        view, applied = _artifacts(bundle, vt)
        rebuilt = build_reconstruction_integrity(
            source_text=raw,
            view_text=view.text,
            view_type=vt,
            offset_map=view.offset_map,
            applied_edits=applied,
            normalizer_version=NORMALIZER_VERSION,
        )
        assert rebuilt.artifact_digest == view.integrity.artifact_digest
