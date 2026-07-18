"""MAI-07R3D property, safety, and differential tests (non-frozen)."""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path

import pytest

from erp_bot.src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from erp_bot.src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    MAX_CANDIDATES_PER_SPAN,
    RUNTIME_VERSION,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.transliteration_service import (
    attach_transliteration_to_frame,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.r3d_safety_gate import (
    count_protected_mutations,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure import resource_repository as xlrr

REPO = Path(__file__).resolve().parents[4]
OUT = REPO / "evals/mai07_r3d_corrective"


@pytest.fixture(scope="module")
def resources():
    return xlrr.load_resources(force_reload=True)


def _bundle(text: str):
    frame = analyze_language(text)
    return attach_transliteration_to_frame(frame, use_context=True)


def test_runtime_version_and_overlay():
    from erp_bot.src.oip.modules.language_runtime.transliteration import (
        PARENT_R3D_RUNTIME_VERSION,
    )

    assert RUNTIME_VERSION == "mai-07.1.3-r3f-sealnew"
    assert PARENT_R3D_RUNTIME_VERSION == "mai-07.1.1-r3d"
    assert ENABLE_PROMOTION_OVERLAY is False


def test_dataset_minimums_and_holdout_frozen():
    man = json.loads((OUT / "MAI_07R3D_DATASET_MANIFEST.json").read_text(encoding="utf-8"))
    assert man["locked_before_runtime_correction"] is True
    assert man["totals"]["DEVELOPMENT"] >= 700
    assert man["totals"]["HOLDOUT_VALIDATION"] >= 300
    assert man["totals"]["SAFETY_CHALLENGE"] >= 250
    assert man["total_unique_cases"] >= 1250
    assert man["frozen_v2_case_bodies_not_used"] is True


@pytest.mark.parametrize(
    "text",
    [
        "https://r3d-eval.example.test/invoice/1",
        "user1@r3d-eval.example.test",
        "PANR3D000001X",
        "VAT-R3D-000001",
        "INV-R3D-00001",
        "FY-R3D-1/83",
        "Rs 12,250.50",
        "12.5%",
        "+977-9800000001",
        '{"r3d":1,"amount":100}',
        r"C:\r3d\data\ledger_1.xlsx",
    ],
)
def test_protected_surfaces_preserve_identity(text):
    updated = _bundle(text)
    assert updated.raw_text == text
    bundle = updated.transliteration_bundle
    assert bundle is not None
    assert count_protected_mutations(bundle.span_results) == 0
    # Any protected-flagged span must be identity-only
    for sp in bundle.span_results:
        if sp.is_protected:
            assert len(sp.candidates) == 1
            assert sp.candidates[0].is_identity
            assert sp.candidates[0].surface == sp.raw_span.original_text


def test_overlapping_url_and_romanized_fails_closed_on_url():
    text = "https://r3d-overlap.example.test/9 and kharcha"
    updated = _bundle(text)
    bundle = updated.transliteration_bundle
    assert bundle is not None
    assert count_protected_mutations(bundle.span_results) == 0
    assert "https://r3d-overlay.example.test/9" not in (
        "".join(c.surface for sp in bundle.span_results for c in sp.candidates if not c.is_identity)
    )


def test_english_identity_resource_top1(resources):
    eng = sorted(resources.english_identity)[0]
    updated = _bundle(f"{eng} r3dtst0001")
    bundle = updated.transliteration_bundle
    assert bundle is not None
    for sp in bundle.span_results:
        if sp.raw_span.original_text.lower() == eng:
            assert sp.candidates[0].is_identity
            assert sp.candidates[0].surface == eng


def test_proper_name_identity_first(resources):
    name = sorted(resources.name_like)[0]
    updated = _bundle(f"{name} r3dtst0002")
    bundle = updated.transliteration_bundle
    assert bundle is not None
    for sp in bundle.span_results:
        if sp.raw_span.original_text.lower() == name:
            assert sp.candidates[0].is_identity


def test_identity_always_retained_and_cap(resources):
    rom = next(k for k, v in resources.lexicon.items() if v and k.isalpha() and k not in resources.english_identity)
    updated = _bundle(f"{rom} r3dtst0003")
    bundle = updated.transliteration_bundle
    assert bundle is not None
    for sp in bundle.span_results:
        if not sp.candidates:
            continue
        assert any(c.is_identity for c in sp.candidates)
        assert len(sp.candidates) <= MAX_CANDIDATES_PER_SPAN


def test_deterministic_tie_break():
    a = _bundle("kharcha r3dtst0004").transliteration_bundle
    b = _bundle("kharcha r3dtst0004").transliteration_bundle
    assert a is not None and b is not None
    assert [c.surface for sp in a.span_results for c in sp.candidates] == [
        c.surface for sp in b.span_results for c in sp.candidates
    ]


def test_seeded_generated_invariants():
    rng = random.Random(20260715)
    res = xlrr.load_resources(force_reload=True)
    lex = [k for k in res.lexicon if k.isalpha()]
    eng = list(res.english_identity)
    failures = 0
    for i in range(1000):
        mode = i % 5
        if mode == 0:
            text = f"https://inv{i}.r3d.example.test/x"
        elif mode == 1:
            text = f"{rng.choice(eng)} r3dinv{i:04d}"
        elif mode == 2:
            text = f"{rng.choice(lex)} r3dinv{i:04d}"
        elif mode == 3:
            text = f"user{i}@r3d.example.test"
        else:
            text = f"INV-R3D-{i:05d}"
        updated = _bundle(text)
        if updated.raw_text != text:
            failures += 1
            continue
        bundle = updated.transliteration_bundle
        assert bundle is not None
        if count_protected_mutations(bundle.span_results) != 0:
            failures += 1
            continue
        for sp in bundle.span_results:
            if sp.candidates:
                assert len(sp.candidates) <= MAX_CANDIDATES_PER_SPAN
                assert any(c.is_identity for c in sp.candidates) or sp.eligibility.value.startswith("SKIPPED")
    assert failures == 0


def test_holdout_thresholds_locked():
    thr = json.loads((OUT / "MAI_07R3D_HOLDOUT_THRESHOLDS.json").read_text(encoding="utf-8"))
    assert thr["locked_before_holdout_observation"] is True
    assert thr["gates"]["core_recall_at_5"]["value"] == 0.99
    assert thr["gates"]["english_identity_top1"]["value"] == 0.99
