"""MAI-10 slice 1 — domain lexicon / concept ontology candidates."""

from __future__ import annotations

from src.oip.contracts.common import SourceSpanV1
from src.oip.contracts.language import LanguageFrameV1
from src.oip.modules.language_runtime.domain_lexicon import ONTOLOGY_VERSION, RUNTIME_VERSION
from src.oip.modules.language_runtime.domain_lexicon.application.domain_lexicon_service import (
    attach_domain_lexicon_to_frame,
    build_domain_lexicon_bundle,
    parse_domain_concepts,
)


def _concepts(text: str, *, frame: LanguageFrameV1 | None = None) -> set[str]:
    return {r["concept_id"] for r in parse_domain_concepts(text, language_frame=frame)}


def test_synonym_sales_maps_same_concept() -> None:
    for text in ("aaja ko bikri", "today sales report", "आजको बिक्री"):
        assert "CONCEPT_SALES" in _concepts(text)


def test_synonym_credit_maps_same_concept() -> None:
    for text in ("udhaar diyo", "credit sale", "उधारो दियो"):
        assert "CONCEPT_CREDIT" in _concepts(text)


def test_purchase_and_vat() -> None:
    hits = _concepts("kharid invoice vat 13%")
    assert "CONCEPT_PURCHASE" in hits
    assert "CONCEPT_INVOICE" in hits
    assert "CONCEPT_VAT" in hits


def test_longest_match_trial_balance() -> None:
    rows = parse_domain_concepts("show trial balance")
    ids = [r["concept_id"] for r in rows]
    assert "CONCEPT_REPORT" in ids
    # "trial balance" should claim the span; bare "balance" must not also fire.
    assert sum(1 for r in rows if r["surface"].lower() == "balance") == 0


def test_protected_span_skipped() -> None:
    text = "Ram bikri 500"
    # Protect the whole party-ish prefix including accidental overlap zone.
    # Protect only "Ram" — bikri still binds.
    frame = LanguageFrameV1.not_run(text).model_copy(
        update={
            "protected_spans": (
                SourceSpanV1(start_offset=0, end_offset=3, original_text="Ram"),
            )
        }
    )
    rows = parse_domain_concepts(text, language_frame=frame)
    assert any(r["concept_id"] == "CONCEPT_SALES" for r in rows)
    # If "bikri" were protected, no sales concept.
    frame2 = LanguageFrameV1.not_run(text).model_copy(
        update={
            "protected_spans": (
                SourceSpanV1(start_offset=4, end_offset=9, original_text="bikri"),
            )
        }
    )
    assert "CONCEPT_SALES" not in _concepts(text, frame=frame2)


def test_bundle_never_applies_or_mutates() -> None:
    raw = "bikri kharid udhaar"
    frame = LanguageFrameV1.not_run(raw)
    updated = attach_domain_lexicon_to_frame(frame)
    assert updated.raw_text == raw
    bundle = updated.domain_lexicon_bundle
    assert bundle is not None
    assert bundle.silent_applications == 0
    assert bundle.runtime_version == RUNTIME_VERSION
    assert bundle.ontology_version == ONTOLOGY_VERSION
    assert bundle.candidate_count >= 3
    assert all(not c.applied for c in bundle.candidates)


def test_applied_flag_rejected() -> None:
    from pydantic import ValidationError
    from src.oip.contracts.domain_lexicon import DomainConceptCandidateV1

    try:
        DomainConceptCandidateV1(
            candidate_id="x",
            surface="bikri",
            concept_id="CONCEPT_SALES",
            raw_start=0,
            raw_end=5,
            applied=True,
        )
        raise AssertionError("expected ValidationError")
    except ValidationError:
        pass


def test_build_bundle_empty_text_ok() -> None:
    # LanguageFrame requires min_length=1; service accepts raw directly.
    bundle = build_domain_lexicon_bundle("hello world")
    assert bundle.analysis_status.value == "COMPLETE"
    assert bundle.silent_applications == 0


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai10"
        / "frozen"
        / "domain_concepts_critical_v1.jsonl"
    )
    assert path.is_file(), path
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        hits = _concepts(case["raw_text"])
        for cid in case["expected_concepts"]:
            assert cid in hits, (case["case_id"], cid, hits)
        for surf in case.get("forbidden_surfaces") or []:
            assert not any(
                r["surface"].lower() == surf.lower()
                for r in parse_domain_concepts(case["raw_text"])
            ), case["case_id"]
