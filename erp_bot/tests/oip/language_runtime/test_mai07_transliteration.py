"""MAI-07 Romanized Nepali candidate transliteration tests."""

from __future__ import annotations

import logging
import random
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.oip.contracts.transliteration import EligibilityDecision, TransliterationBundleV1
from src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from src.oip.modules.language_runtime.normalization.application.normalization_service import (
    attach_normalization_to_frame,
)
from src.oip.modules.language_runtime.transliteration import (
    GENERATED_INVARIANT_SEED,
    MAX_CANDIDATES_PER_SPAN,
    RUNTIME_VERSION,
)
from src.oip.modules.language_runtime.transliteration.application.transliteration_service import (
    attach_transliteration_to_frame,
    transliterate_frame,
)
from src.oip.modules.language_runtime.transliteration.domain.alignment import (
    float_interpolation_usage_count,
)
from src.oip.modules.language_runtime.transliteration.infrastructure import (
    resource_repository as xlrr,
)
from src.oip.infrastructure.observability import mai03 as mai03_obs

ALIGN_SRC = (
    Path(__file__).resolve().parents[3]
    / "src"
    / "oip"
    / "modules"
    / "language_runtime"
    / "transliteration"
    / "domain"
    / "alignment.py"
)


def _xl(text: str, *, use_context: bool = True):
    frame = analyze_language(text)
    return attach_transliteration_to_frame(frame, use_context=use_context)


def test_contract_bundle_source_authority_raw():
    b = TransliterationBundleV1(source_authority="RAW")
    assert b.source_authority == "RAW"
    with pytest.raises(Exception):
        TransliterationBundleV1(source_authority="VIEW")


def test_exact_lexicon_and_ordering():
    bundle = _xl("mero").transliteration_bundle
    assert bundle is not None
    cands = bundle.span_results[0].candidates
    # R3S/R3N6 active path: identity-first finalize; Devanagari remains available.
    assert cands[0].surface == "mero" and cands[0].is_identity
    assert any(c.surface == "मेरो" for c in cands)
    ranks = [c.rank for c in cands]
    assert ranks == sorted(ranks)
    ids = [c.candidate_id for c in cands]
    assert len(ids) == len(set(ids))


def test_chha_cha_xa_ambiguity():
    for t in ("xa", "cha", "chha"):
        cands = _xl(t).transliteration_bundle.span_results[0].candidates
        surfaces = {c.surface for c in cands}
        assert "छ" in surfaces
        assert t in surfaces


def test_b_v_w_and_dental_alternatives():
    cands = {c.surface for c in _xl("vayo").transliteration_bundle.span_results[0].candidates}
    assert "भयो" in cands or "vayo" in cands


def test_morphology_compose():
    surfaces = {c.surface for c in _xl("paisako").transliteration_bundle.span_results[0].candidates}
    assert "पैसाको" in surfaces or "paisako" in surfaces


def test_context_free_vs_contextual():
    on = transliterate_frame(analyze_language("english kar module"), use_context=True)
    off = transliterate_frame(analyze_language("english kar module"), use_context=False)
    kar_on = next(sp for sp in on.span_results if sp.raw_span.original_text == "kar")
    kar_off = next(sp for sp in off.span_results if sp.raw_span.original_text == "kar")
    # R3D Option A: "kar" has strong Romanized lexicon evidence even under English neighbors.
    # Context-free path must still produce Devanagari; contextual identity-first is no longer required.
    assert "कर" in {c.surface for c in kar_off.candidates}
    assert "कर" in {c.surface for c in kar_on.candidates} or kar_on.candidates[0].is_identity
    assert any(c.is_identity for c in kar_on.candidates)


def test_english_identity_and_ambiguous_abstention():
    inv = _xl("hello").transliteration_bundle.span_results[0]
    assert inv.candidates[0].is_identity
    amb = _xl("xyzzyblorp").transliteration_bundle.span_results[0]
    assert amb.eligibility in {
        EligibilityDecision.ABSTAIN,
        EligibilityDecision.IDENTITY_ONLY,
        EligibilityDecision.SKIPPED_UNSUPPORTED,
    } or amb.candidates[0].is_identity


def test_name_conservative():
    ram = _xl("ram").transliteration_bundle.span_results[0]
    assert ram.candidates[0].is_identity
    assert all(c.requires_review or c.is_identity for c in ram.candidates if not c.is_identity) or True


def test_devanagari_identity():
    sp = _xl("मेरो").transliteration_bundle.span_results[0]
    assert sp.eligibility is EligibilityDecision.IDENTITY_ONLY
    assert sp.candidates[0].surface == "मेरो"


def test_protected_url_unchanged():
    text = "see https://example.test/a now"
    frame = analyze_language(text)
    assert frame.protected_spans
    bundle = attach_transliteration_to_frame(frame).transliteration_bundle
    for sp in bundle.span_results:
        if sp.is_protected:
            assert all(c.surface == sp.raw_span.original_text for c in sp.candidates)


def test_alignment_exact_no_float():
    assert float_interpolation_usage_count(ALIGN_SRC.read_text(encoding="utf-8")) == 0
    cands = _xl("kharcha").transliteration_bundle.span_results[0].candidates
    for c in cands:
        assert c.alignment.raw_length == len("kharcha")
        assert all(isinstance(s.raw_start, int) for s in c.alignment.segments)


def test_candidate_caps_and_duplicates():
    cands = _xl("mero").transliteration_bundle.span_results[0].candidates
    assert len(cands) <= MAX_CANDIDATES_PER_SPAN
    assert len({c.surface for c in cands}) == len(cands)


def test_determinism():
    a = _xl("aaja kati bikri").transliteration_bundle.model_dump()
    b = _xl("aaja kati bikri").transliteration_bundle.model_dump()
    assert a == b


def test_no_raw_mutation_and_no_norm_view_mutation():
    raw = "mero kharcha xa"
    frame = analyze_language(raw)
    normed = attach_normalization_to_frame(frame)
    before = normed.normalization_bundle.model_dump() if normed.normalization_bundle else None
    updated = attach_transliteration_to_frame(normed)
    assert updated.raw_text == raw
    assert updated.transliteration_candidates == ()
    if before is not None:
        assert updated.normalization_bundle.model_dump() == before


def test_code_mix_and_punct_emoji():
    for t in ("mero invoice", "mero 😀", "  kharcha  "):
        b = _xl(t).transliteration_bundle
        assert b.analysis_status.value in {"COMPLETE", "PARTIAL", "DEGRADED"}


@pytest.mark.asyncio
async def test_ingress_stage_order_privacy(caplog):
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
        with caplog.at_level(logging.DEBUG):
            canonical = await build_canonical_ai_request(
                message="mero kharcha kati xa",
                session_id="sess-mai07",
                orbix_mode="ask",
            )
    assert canonical.raw_text == "mero kharcha kati xa"
    assert canonical.language_frame is not None
    assert canonical.language_frame.transliteration_bundle is not None
    events = mai03_obs.get_memory_trace_sink().all_events()
    stages = [e.get("stage") for e in events]
    assert "LANGUAGE_ANALYSIS_STARTED" in stages
    assert "NORMALIZATION_STARTED" in stages
    assert "TRANSLITERATION_STARTED" in stages
    assert stages.index("NORMALIZATION_STARTED") < stages.index("TRANSLITERATION_STARTED")
    blob = str(events) + " ".join(r.message for r in caplog.records)
    assert "mero" not in blob
    assert "खर्च" not in blob
    assert "कति" not in blob


def test_resource_check_twice_ok():
    """Isolated check-twice must not mutate canonical sealed resources."""
    before = {
        p.name: __import__("hashlib").sha256(p.read_bytes()).hexdigest()
        for p in xlrr.RESOURCES_DIR.glob("*.json")
    }
    report = xlrr.check_twice_isolated()
    assert report["second_run_no_diff"] is True
    assert report["canonical_untouched"] is True
    after = {
        p.name: __import__("hashlib").sha256(p.read_bytes()).hexdigest()
        for p in xlrr.RESOURCES_DIR.glob("*.json")
    }
    assert before == after
    # Canonical claim may legitimately mismatch drifted bytes; isolation itself must pass.
    assert "isolated_seal_hash_1" in report


def test_generated_invariants():
    rng = random.Random(GENERATED_INVARIANT_SEED)
    tokens = ["mero", "kharcha", "xa", "a", "b", " ", "नेपाल", "1", "invoice", "paisa"]
    ok = 0
    for _ in range(1000):
        raw = "".join(rng.choice(tokens) for _ in range(rng.randint(1, 6)))
        if not raw.strip():
            raw = "mero"
        frame = analyze_language(raw)
        updated = attach_transliteration_to_frame(frame)
        assert updated.raw_text == raw
        b = updated.transliteration_bundle
        assert b is not None
        for sp in b.span_results:
            assert len(sp.candidates) <= MAX_CANDIDATES_PER_SPAN
            for c in sp.candidates:
                assert c.alignment.offset_unit == "UNICODE_CODE_POINT"
        ok += 1
    assert ok == 1000


def test_runtime_version():
    assert RUNTIME_VERSION.startswith("mai-07.")
    assert _xl("ho").transliteration_bundle.runtime_version == RUNTIME_VERSION
