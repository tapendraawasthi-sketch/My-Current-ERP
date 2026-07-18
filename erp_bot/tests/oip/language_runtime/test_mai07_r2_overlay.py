"""MAI-07R2 overlay monotonic property tests (non-frozen surfaces only)."""

from __future__ import annotations

import random

import pytest

from src.oip.contracts.transliteration import CandidateKind, CandidateScript, CalibrationStatus, UncertaintyClass
from src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from src.oip.modules.language_runtime.transliteration import GENERATED_INVARIANT_SEED, MAX_CANDIDATES_PER_SPAN
from src.oip.modules.language_runtime.transliteration.application.build_mai07r2_ranker_dev import (
    base_rank_primary_span,
)
from src.oip.modules.language_runtime.transliteration.application.eval_mai07r2_dev import (
    _overlay_rank_primary,
)
from src.oip.modules.language_runtime.transliteration.application.transliteration_service import (
    attach_transliteration_to_frame,
)
from src.oip.modules.language_runtime.transliteration.domain.alignment import identity_alignment
from src.oip.modules.language_runtime.transliteration.infrastructure.resource_repository import (
    load_resources,
)
from src.oip.modules.language_runtime.transliteration.infrastructure.target_promotion_overlay import (
    OverlayDecision,
    TargetPromotionOverlay,
)

RUNTIME_ROOT = (
    __import__("pathlib").Path(__file__).resolve().parents[3]
    / "src"
    / "oip"
    / "modules"
    / "language_runtime"
    / "transliteration"
)


def _xl(text: str, *, use_context: bool = True):
    return attach_transliteration_to_frame(analyze_language(text), use_context=use_context)


def _primary(text: str, *, use_context: bool = True):
    bundle = _xl(text, use_context=use_context).transliteration_bundle
    assert bundle is not None
    return bundle.span_results[0]


def _overlay(text: str):
    ranked, decision, reasons, _err = _overlay_rank_primary(text)
    return ranked, decision, reasons


def _candidate(surface: str, *, is_identity: bool, kind: CandidateKind, provenance: tuple[str, ...]):
    from src.oip.contracts.transliteration import TransliterationCandidateV1

    return TransliterationCandidateV1(
        candidate_id=f"test_{surface}_{kind.value}",
        surface=surface,
        script=CandidateScript.LATIN if is_identity else CandidateScript.DEVANAGARI,
        kind=kind,
        rank=1,
        ranking_score=1.0,
        uncertainty_class=UncertaintyClass.MODERATE,
        calibration_status=CalibrationStatus.UNCALIBRATED,
        alignment=identity_alignment(surface if is_identity else "abc"),
        is_identity=is_identity,
        requires_review=False,
        reason_codes=(),
        provenance=provenance,
    )


def test_base_target_at_one_never_becomes_identity_after_overlay():
    for text in ("mero", "kharcha", "aamdani"):
        base, _, _ = base_rank_primary_span(text)
        assert base and not base[0].is_identity
        overlay, decision, _ = _overlay(text)
        assert overlay
        assert not overlay[0].is_identity
        assert overlay[0].candidate_id == base[0].candidate_id
        assert decision in {OverlayDecision.KEEP_BASE_ORDER, OverlayDecision.ABSTAIN_FROM_PROMOTION}


@pytest.mark.skip(
    reason=(
        "HISTORICAL_R2_OVERLAY_EXPECTATION: expects PROMOTE_EXISTING_TARGET for "
        "'paisako' under failed R2 promotion overlay. Active authority has "
        "ENABLE_PROMOTION_OVERLAY=false and overlay abstains. Assertion retained "
        "as historical evidence; not an active pre-R1 gate. See MAI-07R3C."
    )
)
def test_identity_first_base_may_be_promoted_without_demoting_existing_target():
    base, _, _ = base_rank_primary_span("paisako")
    assert base and base[0].is_identity
    overlay, decision, _ = _overlay("paisako")
    assert decision is OverlayDecision.PROMOTE_EXISTING_TARGET
    assert overlay and not overlay[0].is_identity


def test_english_identity_never_promoted():
    for text in ("invoice", "hello", "tax"):
        sp = _primary(text)
        assert sp.candidates[0].is_identity
        _ranked, decision, reasons = _overlay(text)
        assert decision is not OverlayDecision.PROMOTE_EXISTING_TARGET
        assert any("KEEP_IDENTITY" in r or "BLOCK" in r for r in reasons)


def test_name_like_never_promoted():
    sp = _primary("ram")
    assert sp.candidates[0].is_identity
    _ranked, decision, _ = _overlay("ram")
    assert decision is not OverlayDecision.PROMOTE_EXISTING_TARGET


def test_acronym_never_promoted_when_identity_first():
    res = load_resources()
    overlay = TargetPromotionOverlay(res)
    ranked = [
        _candidate("VAT", is_identity=True, kind=CandidateKind.IDENTITY, provenance=("identity",)),
        _candidate("भ्याट", is_identity=False, kind=CandidateKind.LEXICAL, provenance=("lexicon",)),
    ]
    decision, reasons = overlay.decide(
        ranked,
        surface="VAT",
        language_form="TECHNICAL_ACCOUNTING_ENGLISH",
    )
    assert decision is not OverlayDecision.PROMOTE_EXISTING_TARGET
    assert any("ACRONYM" in r or "KEEP_IDENTITY" in r for r in reasons)


def test_protected_span_never_promoted():
    frame = analyze_language("see https://example.test/path now")
    bundle = attach_transliteration_to_frame(frame).transliteration_bundle
    assert bundle is not None
    prot = [sp for sp in bundle.span_results if sp.is_protected]
    assert prot
    for sp in prot:
        assert all(c.is_identity for c in sp.candidates)
        _ranked, decision, _ = _overlay(sp.raw_span.original_text)
        assert decision is not OverlayDecision.PROMOTE_EXISTING_TARGET


@pytest.mark.skip(
    reason=(
        "HISTORICAL_R2_OVERLAY_EXPECTATION: expects lexicon promotion via failed "
        "R2 overlay when identity is first at base. Active pre-R1 runtime does "
        "not enable the overlay. Assertion retained historically. See MAI-07R3C."
    )
)
def test_romanized_lexicon_promotes_when_identity_first_at_base():
    ranked, decision, _ = _overlay("paisako")
    assert decision is OverlayDecision.PROMOTE_EXISTING_TARGET
    assert ranked and not ranked[0].is_identity


def test_overlay_never_increases_candidate_cap():
    for text in ("mero", "kharcha", "aaja kati bikri", "tax holtag"):
        sp = _primary(text)
        assert len(sp.candidates) <= MAX_CANDIDATES_PER_SPAN


@pytest.mark.parametrize("seed_offset", range(10))
def test_generated_monotonic_properties(seed_offset: int):
    rng = random.Random(GENERATED_INVARIANT_SEED + seed_offset)
    res = load_resources()
    lex_pool = [
        rom
        for rom in sorted(res.lexicon.keys())
        if rom.isalpha() and rom not in res.english_identity and rom not in res.name_like
    ][:40]
    eng_pool = sorted(res.english_identity)[:20]
    for i in range(100):
        kind = i % 5
        if kind == 0 and lex_pool:
            rom = lex_pool[i % len(lex_pool)]
            text = f"{rom} r2gen{i:04d} kharcha"
        elif kind == 1 and eng_pool:
            text = eng_pool[i % len(eng_pool)]
        elif kind == 2:
            text = "XYZQ" if i % 2 else "QWRT"
        elif kind == 3:
            text = f"zy{''.join(rng.choice('aeioubcdfghjklmnpqrstvwxyz') for _ in range(7))}{i:02d}"
        else:
            text = f"https://example.test/r2/{i:04d}"
        base, _, _ = base_rank_primary_span(text)
        overlay, decision, _ = _overlay(text)
        if not base or not overlay:
            continue
        if not base[0].is_identity:
            assert not overlay[0].is_identity
            assert overlay[0].candidate_id == base[0].candidate_id
        if kind in {1, 2, 3, 4}:
            assert decision is not OverlayDecision.PROMOTE_EXISTING_TARGET
        if decision is OverlayDecision.PROMOTE_EXISTING_TARGET:
            assert base[0].is_identity
            assert not overlay[0].is_identity
            base_ids = [c.candidate_id for c in base]
            overlay_ids = [c.candidate_id for c in overlay]
            assert set(base_ids) == set(overlay_ids)


def test_generated_property_batch_1000_cases():
    rng = random.Random(GENERATED_INVARIANT_SEED + 99)
    res = load_resources()
    lex_pool = [
        rom
        for rom in sorted(res.lexicon.keys())
        if rom.isalpha() and rom not in res.name_like
    ]
    violations: list[str] = []
    for i in range(1000):
        roll = i % 7
        if roll == 0:
            rom = lex_pool[i % len(lex_pool)]
            text = f"{rom} r2k{i:04d}"
        elif roll == 1:
            text = sorted(res.english_identity)[i % max(1, len(res.english_identity))]
        elif roll == 2:
            text = sorted(res.name_like)[i % max(1, len(res.name_like))]
        elif roll == 3:
            text = ("XYZQ", "QWRT", "ABCP", "LMNO")[i % 4]
        elif roll == 4:
            text = f"email user{i}@example.test"
        elif roll == 5:
            text = "zx" + "".join(rng.choice("aeioubcdfghjklmnpqrstvwxyz") for _ in range(8))
        else:
            rom = lex_pool[(i * 3) % len(lex_pool)]
            text = f"{rom} invoice r2k{i:04d}"
        base, _, _ = base_rank_primary_span(text)
        overlay, decision, _ = _overlay(text)
        if not base or not overlay:
            continue
        if not base[0].is_identity and overlay[0].is_identity:
            violations.append(f"demoted_target:{text}")
        if not base[0].is_identity and overlay[0].candidate_id != base[0].candidate_id:
            violations.append(f"reordered_base_target:{text}")
        if roll in {1, 2, 3, 4} and decision is OverlayDecision.PROMOTE_EXISTING_TARGET:
            violations.append(f"unsafe_promote:{text}")
        if decision is OverlayDecision.PROMOTE_EXISTING_TARGET:
            weak_only = all(
                c.kind is CandidateKind.GRAPHEME
                for c in base
                if not c.is_identity and any("\u0900" <= ch <= "\u097F" for ch in c.surface)
            )
            if weak_only:
                violations.append(f"grapheme_promote:{text}")
    assert not violations, violations[:10]


def test_no_network_provider_in_overlay_module():
    src = (RUNTIME_ROOT / "infrastructure" / "target_promotion_overlay.py").read_text(encoding="utf-8")
    for banned in ("httpx", "openai", "requests", "urllib", "aiohttp"):
        assert banned not in src
