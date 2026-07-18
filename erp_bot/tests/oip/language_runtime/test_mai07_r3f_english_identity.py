"""MAI-07R3F English Identity Guard tests (non-frozen probes + property cases)."""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path

import pytest

from erp_bot.src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from erp_bot.src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    ENGLISH_IDENTITY_GUARD_VERSION,
    MAX_CANDIDATES_PER_SPAN,
    PARENT_R3D_RC_HASH,
    PARENT_R3D_RESOURCE_HASH,
    PARENT_R3E_ATTEMPT_HASH,
    RUNTIME_VERSION,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.transliteration_service import (
    attach_transliteration_to_frame,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.english_identity_guard import (
    Disposition,
    apply_english_identity_guard,
    classify_disposition,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.r3d_safety_gate import (
    count_protected_mutations,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)

REPO = Path(__file__).resolve().parents[4]
OUT = REPO / "evals/mai07_r3f_english_identity"


@pytest.fixture(scope="module")
def resources():
    return xlrr.load_resources(force_reload=True)


def _bundle(text: str):
    frame = analyze_language(text)
    return attach_transliteration_to_frame(frame, use_context=True)


def _primary_top(text: str, token: str):
    updated = _bundle(text)
    bundle = updated.transliteration_bundle
    assert bundle is not None
    for sp in bundle.span_results:
        if sp.raw_span.original_text.lower() == token.lower() and sp.candidates:
            return sp.candidates[0], sp
    for sp in bundle.span_results:
        if sp.candidates:
            return sp.candidates[0], sp
    raise AssertionError("no candidates")


def test_runtime_versions_and_overlay():
    assert RUNTIME_VERSION == "mai-07.1.13-r3s-active"
    assert ENGLISH_IDENTITY_GUARD_VERSION == "mai-07-r3f.1.0.0"
    assert ENABLE_PROMOTION_OVERLAY is False
    assert PARENT_R3D_RESOURCE_HASH == "083bce288907c0db882bdf7082bf9093e9086035c653dadcd4964625b61e966f"
    assert PARENT_R3D_RC_HASH == "2ebe29fac17b836849e3c3e1054c704a03d762bc5f28879a9a0de2f5a62d2c26"
    assert PARENT_R3E_ATTEMPT_HASH == "833233e4f5ed5250a824e47dcfec000fa4d66ae20dfeec1729822e43bf81fbd2"


def test_holdout_datasets_frozen_before_guard():
    man = json.loads((OUT / "MAI_07R3F_DATASET_MANIFEST.json").read_text(encoding="utf-8"))
    assert man["locked_before_runtime_correction"] is True
    assert man["minimums_met"] is True
    assert man["totals"]["DEVELOPMENT"] >= 900
    assert man["totals"]["HOLDOUT_VALIDATION"] >= 600
    assert man["totals"]["SAFETY_CHALLENGE"] >= 500
    assert man["totals"]["CONTEXT_COUNTERFACTUAL"] >= 300
    assert man["r3e_predictions_not_used"] is True
    assert man["frozen_v2_case_bodies_not_used"] is True


def test_clear_english_identity_top1():
    top, _ = _primary_top("please review the payment status r3ft01", "payment")
    assert top.is_identity
    assert top.surface.lower() == "payment"


def test_technical_english_accounting_context():
    top, _ = _primary_top("post the invoice entry r3ft02", "invoice")
    assert top.is_identity


def test_english_in_nepali_code_mix_keeps_english_identity(resources):
    # Non-shared English identity: code-mix must not invent a Devanagari top-1.
    # Shared collision surfaces follow R3H2 Nepali-context target preference separately.
    term = next(
        t
        for t in sorted(resources.english_identity)
        if t.isalpha()
        and len(t) >= 4
        and t not in resources.lexicon
        and t not in resources.domain_terms
    )
    top, _ = _primary_top(f"mero {term} pathau r3ft03", term)
    assert top.is_identity


def test_shared_borrowing_english_context_identity(resources):
    term = sorted(resources.english_identity & set(resources.domain_terms))[0]
    top, _ = _primary_top(f"please review {term} totals r3ft04", term)
    assert top.is_identity


def test_strong_romanized_not_suppressed(resources):
    rom = next(r for r in sorted(resources.lexicon) if r not in resources.english_identity and resources.lexicon[r])
    top, sp = _primary_top(f"aaja {rom} hernu r3ft05", rom)
    targets = set(resources.lexicon[rom])
    assert (not top.is_identity and top.surface in targets) or any(
        (not c.is_identity and c.surface in targets) for c in sp.candidates[:5]
    )


def test_weak_english_form_strong_romanized_leaves_romanized(resources):
    # Positive romanized evidence must not be suppressed by weak ENGLISH alone.
    rom = "kharcha"
    if rom not in resources.lexicon:
        pytest.skip("kharcha missing")
    top, sp = _primary_top(f"aaja {rom} hernu r3ft06", rom)
    assert any((not c.is_identity) for c in sp.candidates)


def test_proper_name_identity(resources):
    name = sorted(resources.name_like)[0]
    top, _ = _primary_top(f"{name} traders r3ft07", name)
    assert top.is_identity


def test_acronym_identity():
    top, _ = _primary_top("FIFO code r3ft08", "FIFO")
    assert top.is_identity


def test_identifier_protected():
    text = "ref R3F-ID-00042 r3ft09"
    updated = _bundle(text)
    assert updated.raw_text == text
    bundle = updated.transliteration_bundle
    assert bundle is not None
    assert count_protected_mutations(bundle.span_results) == 0


def test_protected_url():
    text = "https://r3f-eval.example.test/invoice/1"
    updated = _bundle(text)
    bundle = updated.transliteration_bundle
    assert bundle is not None
    assert count_protected_mutations(bundle.span_results) == 0


def test_ambiguous_option_a_identity_or_abstain():
    top, sp = _primary_top("qzx001blorp r3ft10", "qzx001blorp")
    assert top.is_identity or sp.eligibility.value in {"ABSTAIN", "IDENTITY_ONLY"}


def test_casefold_and_punct_variants(resources):
    eng = sorted(resources.english_identity)[0]
    for text in (f"{eng.upper()} r3ft11", f"{eng.capitalize()}! r3ft12"):
        updated = _bundle(text)
        bundle = updated.transliteration_bundle
        assert bundle is not None
        assert count_protected_mutations(bundle.span_results) == 0


def test_guard_preserves_candidate_surfaces(resources):
    from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.deterministic_generator import (
        DeterministicCandidateGenerator,
    )
    from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.deterministic_ranker import (
        DeterministicCandidateRanker,
    )

    gen = DeterministicCandidateGenerator(resources)
    ranker = DeterministicCandidateRanker(resources)
    surface = "payment"
    generated = gen.generate(surface, language_form="ENGLISH", neighbors=("please", "review"), use_context=True)
    ranked = ranker.rank(
        generated,
        surface=surface,
        language_form="ENGLISH",
        neighbors=("please", "review"),
        prefer_identity=True,
        max_candidates=MAX_CANDIDATES_PER_SPAN,
    )
    guarded, disp, _ = apply_english_identity_guard(
        ranked,
        surface=surface,
        language_form="ENGLISH",
        neighbors=("please", "review"),
        resources=resources,
    )
    assert sorted(c.surface for c in ranked) == sorted(c.surface for c in guarded)
    assert disp in {
        Disposition.ENGLISH_IDENTITY_REQUIRED,
        Disposition.SHARED_CONTEXT_IDENTITY_PREFERRED,
        Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW,
        Disposition.ACRONYM_IDENTITY_REQUIRED,
        # Historical aliases
        Disposition.HIGH_CONFIDENCE_ENGLISH_IDENTITY,
        Disposition.SHARED_AMBIGUOUS_LATIN,
        Disposition.ACRONYM_IDENTIFIER,
    }
    assert guarded[0].is_identity


def test_guard_does_not_push_romanized_target_out_of_top5(resources):
    rom = next(r for r in sorted(resources.lexicon) if r not in resources.english_identity and resources.lexicon[r])
    updated = _bundle(f"aaja {rom} hernu r3ft13")
    bundle = updated.transliteration_bundle
    assert bundle is not None
    for sp in bundle.span_results:
        if sp.raw_span.original_text.lower() == rom:
            targets = set(resources.lexicon[rom])
            assert any((not c.is_identity and c.surface in targets) for c in sp.candidates[:5])


def test_counterfactual_same_surface_different_context(resources):
    term = "payment" if "payment" in resources.english_identity else sorted(resources.english_identity)[0]
    top_en, _ = _primary_top(f"please confirm the {term} total r3ft14", term)
    assert top_en.is_identity
    # Romanized context for genuine romanized stem
    rom = next(r for r in sorted(resources.lexicon) if r not in resources.english_identity)
    top_rom, sp = _primary_top(f"aaja {rom} hernu r3ft15", rom)
    assert sp.candidates  # identity retained somewhere
    assert any(c.is_identity for c in sp.candidates)


def test_determinism_twice():
    text = "please review the ledger balance r3ft16"
    a = _bundle(text).transliteration_bundle
    b = _bundle(text).transliteration_bundle
    assert a is not None and b is not None
    assert [c.surface for sp in a.span_results for c in sp.candidates] == [
        c.surface for sp in b.span_results for c in sp.candidates
    ]


def test_property_seeded_cases(resources):
    rng = random.Random(20260716)
    eng = sorted(resources.english_identity)
    roms = [r for r in sorted(resources.lexicon) if r not in resources.english_identity][:40]
    failures = 0
    for i in range(1000):
        if i % 2 == 0:
            w = eng[i % len(eng)]
            text = f"please confirm {w} total r3fp{i:04d}"
            top, _ = _primary_top(text, w)
            if not top.is_identity:
                failures += 1
        else:
            w = roms[i % len(roms)]
            text = f"aaja {w} hernu r3fp{i:04d}"
            updated = _bundle(text)
            assert updated.raw_text == text
            bundle = updated.transliteration_bundle
            assert bundle is not None
            assert count_protected_mutations(bundle.span_results) == 0
            assert all(len(sp.candidates) <= MAX_CANDIDATES_PER_SPAN for sp in bundle.span_results)
    assert failures == 0


def test_classify_disposition_hierarchy(resources):
    d, _ = classify_disposition(
        surface="FIFO",
        language_form="ENGLISH",
        neighbors=(),
        resources=resources,
    )
    assert d is Disposition.ACRONYM_IDENTITY_REQUIRED
    # Non-shared English identity surface under decisive English neighbors.
    surface = next(
        t
        for t in sorted(resources.english_identity)
        if t.isalpha()
        and len(t) >= 4
        and t not in resources.lexicon
        and t not in resources.domain_terms
    )
    d2, _ = classify_disposition(
        surface=surface,
        language_form="ENGLISH",
        neighbors=("please", "review"),
        resources=resources,
    )
    assert d2 is Disposition.ENGLISH_IDENTITY_REQUIRED
    # Shared collision under decisive English context prefers identity (not review).
    shared = sorted(resources.english_identity & set(resources.domain_terms))[0]
    d3, _ = classify_disposition(
        surface=shared,
        language_form="ENGLISH",
        neighbors=("please", "review", "the", "total"),
        resources=resources,
    )
    assert d3 is Disposition.SHARED_CONTEXT_IDENTITY_PREFERRED
