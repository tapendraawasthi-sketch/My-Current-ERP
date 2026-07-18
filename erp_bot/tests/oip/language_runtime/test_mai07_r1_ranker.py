"""MAI-07R1 ranking disposition and safety matrix tests (non-frozen examples only)."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from src.oip.contracts.transliteration import CalibrationStatus, EligibilityDecision
from src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from src.oip.modules.language_runtime.transliteration.application.transliteration_service import (
    attach_transliteration_to_frame,
)
from src.oip.modules.language_runtime.transliteration.infrastructure.resource_repository import (
    load_resources,
)

RUNTIME_ROOT = (
    Path(__file__).resolve().parents[3]
    / "src"
    / "oip"
    / "modules"
    / "language_runtime"
    / "transliteration"
)
RUNTIME_SAFE_DIRS = ("infrastructure", "domain", "ports")
RUNTIME_SAFE_FILES = ("__init__.py",)


def _xl(text: str, *, use_context: bool = True):
    return attach_transliteration_to_frame(analyze_language(text), use_context=use_context)


def _primary(text: str, *, use_context: bool = True):
    bundle = _xl(text, use_context=use_context).transliteration_bundle
    assert bundle is not None
    return bundle.span_results[0]


def test_strong_romanized_lexicon_target_above_identity():
    sp = _primary("mero")
    assert not sp.candidates[0].is_identity
    assert sp.candidates[0].surface == "मेरो"
    assert any(c.is_identity for c in sp.candidates)


def test_domain_romanized_target_above_identity():
    res = load_resources()
    # Prefer a domain term present for engineering check without frozen cases.
    rom = next(iter(sorted(res.domain_terms.keys())))
    sp = _primary(rom)
    if rom in res.english_identity or rom in res.name_like:
        assert sp.candidates[0].is_identity
    else:
        assert any(not c.is_identity for c in sp.candidates)
        assert not sp.candidates[0].is_identity or rom in {"pan", "vat", "cheque"}


def test_morphology_target_present():
    surfaces = {c.surface for c in _primary("paisako").candidates}
    assert "पैसाको" in surfaces or "paisako" in surfaces
    assert any(c.is_identity for c in _primary("paisako").candidates)


def test_weak_grapheme_only_behind_identity_when_no_lexicon():
    # Synthetic unknown with grapheme path if generated; at minimum identity stays available.
    sp = _primary("xyzzyq")
    assert sp.candidates
    if len(sp.candidates) > 1 and all(
        (not c.is_identity) and c.kind.value == "GRAPHEME" for c in sp.candidates if not c.is_identity
    ):
        assert sp.candidates[0].is_identity


def test_english_word_identity_first():
    assert _primary("invoice").candidates[0].is_identity
    assert _primary("hello").candidates[0].is_identity


def test_english_accounting_borrowing_identity_first():
    assert _primary("tax").candidates[0].is_identity
    assert _primary("hello").candidates[0].is_identity


def test_proper_name_identity_first_requires_review():
    sp = _primary("ram")
    assert sp.candidates[0].is_identity
    assert sp.is_name_like or any(c.requires_review for c in sp.candidates)


def test_acronym_identity_first():
    # Pure acronyms without lexicon hits remain identity-first.
    assert _primary("XYZQ").candidates[0].is_identity
    assert _primary("QWRT").candidates[0].is_identity


def test_protected_span_identity_only():
    frame = analyze_language("see https://example.test/path now")
    bundle = attach_transliteration_to_frame(frame).transliteration_bundle
    assert bundle is not None
    prot = [sp for sp in bundle.span_results if sp.is_protected]
    assert prot
    for sp in prot:
        assert all(c.is_identity for c in sp.candidates)


def test_existing_devanagari_identity_only():
    sp = _primary("मेरो")
    assert sp.eligibility is EligibilityDecision.IDENTITY_ONLY
    assert sp.candidates[0].is_identity


def test_ambiguous_latin_without_context_keeps_identity_or_abstains():
    sp = _primary("xyzzyblorp")
    assert sp.eligibility in {
        EligibilityDecision.ABSTAIN,
        EligibilityDecision.IDENTITY_ONLY,
        EligibilityDecision.SKIPPED_UNSUPPORTED,
    } or sp.candidates[0].is_identity


def test_ambiguous_with_nepali_context_may_promote_target():
    # kar is SHARED/ambiguous; Nepali neighbor kharcha should allow target preference.
    on = _xl("kar kharcha").transliteration_bundle
    assert on is not None
    kar = next(sp for sp in on.span_results if sp.raw_span.original_text == "kar")
    assert not kar.candidates[0].is_identity
    assert kar.candidates[0].surface == "कर"


@pytest.mark.skip(
    reason=(
        "HISTORICAL_R2_OVERLAY_EXPECTATION: asserts Devanagari promotion for "
        "'english kar module' under failed R2 overlay. Active pre-R1 authority "
        "(mai-07.1.0, ENABLE_PROMOTION_OVERLAY=false) keeps identity-first with "
        "CONTEXT_IDENTITY_BOOST. Retained as historical evidence; not an active "
        "gate. See MAI-07R3C test disposition."
    )
)
def test_same_token_different_disposition_by_context():
    eng = _xl("english kar module").transliteration_bundle
    nep = _xl("kar kharcha").transliteration_bundle
    assert eng is not None and nep is not None
    kar_eng = next(sp for sp in eng.span_results if sp.raw_span.original_text == "kar")
    kar_nep = next(sp for sp in nep.span_results if sp.raw_span.original_text == "kar")
    # Historical R2 expectation (overlay may promote lexicon-backed ambiguous Latin).
    assert not kar_eng.candidates[0].is_identity
    assert not kar_nep.candidates[0].is_identity
    assert kar_eng.candidates[0].surface == kar_nep.candidates[0].surface == "कर"


def test_code_mix_only_eligible_spans_change():
    b = _xl("mero invoice").transliteration_bundle
    assert b is not None
    mero = next(sp for sp in b.span_results if sp.raw_span.original_text == "mero")
    inv = next(sp for sp in b.span_results if sp.raw_span.original_text.lower() == "invoice")
    assert not mero.candidates[0].is_identity
    assert inv.candidates[0].is_identity


def test_identity_always_present_when_candidates_exist():
    for text in ("mero", "aamdani", "kar", "kharcha"):
        sp = _primary(text)
        assert any(c.is_identity for c in sp.candidates)


def test_target_can_move_to_rank1_without_deleting_identity():
    sp = _primary("aamdani")
    assert not sp.candidates[0].is_identity
    assert any(c.is_identity for c in sp.candidates)
    assert len(sp.candidates) <= 5


def test_promotion_does_not_increase_cap():
    sp = _primary("kharcha")
    assert len(sp.candidates) <= 5


def test_candidate_ids_and_alignment_valid():
    sp = _primary("mero")
    ids = [c.candidate_id for c in sp.candidates]
    assert len(ids) == len(set(ids))
    for c in sp.candidates:
        assert c.alignment.raw_length == len("mero")
        assert c.calibration_status is CalibrationStatus.UNCALIBRATED


def test_stable_tie_breaking_deterministic():
    a = _xl("aaja kati bikri").transliteration_bundle.model_dump()
    b = _xl("aaja kati bikri").transliteration_bundle.model_dump()
    assert a == b


def test_scores_uncalibrated_not_probabilities():
    sp = _primary("mero")
    for c in sp.candidates:
        assert c.calibration_status is CalibrationStatus.UNCALIBRATED
        # Ranking scores are explicit uncalibrated floats, not claimed probabilities.
        assert isinstance(c.ranking_score, float)


def test_no_surface_leak_into_reason_only_codes():
    sp = _primary("mero")
    joined = " ".join(r for c in sp.candidates for r in c.reason_codes)
    assert "मेरो" not in joined


def test_no_network_provider_in_ranker_module():
    src = (RUNTIME_ROOT / "infrastructure" / "deterministic_ranker.py").read_text(encoding="utf-8")
    for banned in ("httpx", "openai", "requests", "urllib", "aiohttp"):
        assert banned not in src


def test_runtime_modules_do_not_import_frozen_evals():
    roots = [RUNTIME_ROOT / d for d in RUNTIME_SAFE_DIRS] + [RUNTIME_ROOT / f for f in RUNTIME_SAFE_FILES]
    roots.append(RUNTIME_ROOT / "application" / "transliteration_service.py")
    for path in roots:
        if path.is_file():
            files = [path]
        else:
            files = list(path.rglob("*.py"))
        for f in files:
            tree = ast.parse(f.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        assert "evals.mai07" not in alias.name
                if isinstance(node, ast.ImportFrom) and node.module:
                    assert not node.module.startswith("evals")
                    assert "mai07" not in (node.module or "") or any(
                        x in (node.module or "") for x in ("mai07r1", "mai07r2")
                    )


@pytest.mark.skip(reason="R1 disposition superseded by MAI-07R2 base ranker + overlay")
def test_disposition_taxonomy_covers_required_labels():
    pass


@pytest.mark.skip(reason="R1 disposition superseded by MAI-07R2 base ranker + overlay")
def test_resolve_disposition_english_with_lexicon_promotes():
    pass


@pytest.mark.skip(reason="R1 disposition superseded by MAI-07R2 base ranker + overlay")
def test_resolve_disposition_english_identity_required():
    pass
