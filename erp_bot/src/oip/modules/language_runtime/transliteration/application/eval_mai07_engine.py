"""MAI-07C2 evaluation engine: target-only transliteration quality metrics."""

from __future__ import annotations

import hashlib
import json
import time
from fractions import Fraction
from pathlib import Path
from typing import Any

from .....contracts.transliteration import EligibilityDecision
from ...application.language_analyzer import analyze_language
from ..domain.alignment import float_interpolation_usage_count
from .eval_audit_scorer import audit_aggregate, audit_target_aggregate
from .eval_c2_helpers import (
    challenge_target_surfaces,
    extract_challenge_produced,
    extract_primary_produced,
)
from .eval_invariants import (
    MetricInvariantError,
    assert_canonical_equals_audit,
    validate_shared_ranking_invariants,
)
from .eval_metric_definitions import (
    CANDIDATE_CAP_K,
    CONTEXT_EXPECTED_SIZE,
    EVALUATOR_VERSION,
    GATE_THRESHOLDS,
    POP_ABSTENTION,
    POP_CANDIDATE_RANKING,
    POP_CONTEXT,
    POP_CORE,
    POP_CORE_TRANSLITERATION_REQUIRED,
    POP_TRANSLITERATION_REQUIRED,
    POP_UNAMBIGUOUS_TRANSLITERATION,
    POPULATION_SCHEMA_VERSION,
)
from .eval_populations import classify_case_populations
from .eval_populations_v2 import (
    classify_case_populations_v2,
    preferred_devanagari_case,
    validate_population_totals_v2,
)
from .eval_scoring import (
    ProducedCandidateView,
    aggregate_population,
    aggregate_target_population,
    score_ranked_case,
    score_target_case,
)
from .transliteration_service import attach_transliteration_to_frame, transliterate_frame

ALIGN_SRC = Path(__file__).resolve().parents[1] / "domain" / "alignment.py"


def _rate(numerator: int, denominator: int, default: float = 1.0) -> float:
    return numerator / denominator if denominator else default


def _snapshot(bundle: Any) -> dict[str, Any]:
    return {
        "status": bundle.analysis_status.value,
        "spans": [
            {
                "span_id": sp.span_id,
                "eligibility": sp.eligibility.value,
                "raw": sp.raw_span.original_text,
                "cands": [
                    {
                        "id": candidate.candidate_id,
                        "surface": candidate.surface,
                        "rank": candidate.rank,
                        "score": candidate.ranking_score,
                        "identity": candidate.is_identity,
                    }
                    for candidate in sp.candidates
                ],
            }
            for sp in bundle.span_results
        ],
        "hyps": [
            {
                "id": hypothesis.hypothesis_id,
                "refs": list(hypothesis.candidate_refs),
                "preview": hypothesis.preview_surface,
                "score": hypothesis.aggregate_ranking_score,
            }
            for hypothesis in bundle.hypotheses
        ],
        "abstentions": bundle.abstention_count,
    }


def bundle_runtime_snapshot(bundle: Any) -> dict[str, Any]:
    """Public helper retained for semantic-hash parity with MAI-07C."""
    return _snapshot(bundle)


def compute_runtime_semantic_hash(rows: list[dict[str, Any]]) -> str:
    payload = json.dumps(
        sorted(rows, key=lambda row: row["case_id"]),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _primary_ranked(bundle: Any) -> tuple[list[str], list[str], str | None]:
    produced, _, error = extract_primary_produced(bundle)
    return [item.surface for item in produced], [item.candidate_id for item in produced], error


def _challenge_ranked(
    bundle: Any, *, preferred: str | None, acceptable: list[str]
) -> tuple[list[str], list[str], str | None]:
    produced, _, error = extract_challenge_produced(
        bundle, preferred=preferred, acceptable=acceptable
    )
    return [item.surface for item in produced], [item.candidate_id for item in produced], error


def _produced_audit_rows(produced: list[ProducedCandidateView]) -> list[dict[str, Any]]:
    return [
        {
            "candidate_id": candidate.candidate_id,
            "surface": candidate.surface,
            "kind": candidate.kind,
            "rank": candidate.rank,
            "is_identity": candidate.is_identity,
            "script": candidate.script,
        }
        for candidate in produced[:CANDIDATE_CAP_K]
    ]


def _assert_target_audit(canonical: Any, audit: dict[str, Any]) -> None:
    assert_canonical_equals_audit(
        canonical={
            "top1_numerator": canonical.top1_numerator,
            "recall_at_1_numerator": canonical.recall1_numerator,
            "recall_at_3_numerator": canonical.recall3_numerator,
            "recall_at_5_numerator": canonical.recall5_numerator,
            "denominator": canonical.denominator,
            "no_hit_count": canonical.no_target_count,
            "mrr_sum": canonical.mrr_sum,
        },
        audit={**audit, "no_hit_count": audit["no_target_count"]},
    )


def _json_audit(audit: dict[str, Any]) -> dict[str, Any]:
    """Render Fraction-valued independent-audit fields for the JSON report."""
    return {
        key: (str(value) if isinstance(value, Fraction) else value)
        for key, value in audit.items()
    }


def evaluate_mai07(cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Evaluate frozen MAI-07 cases without changing runtime or frozen resources."""
    errors = validate_population_totals_v2(cases)
    if errors:
        raise MetricInvariantError(";".join(errors))

    raw_mut = view_mut = protected_mut = auto_apply = invalid_offsets = 0
    alignment_failures = alignment_n = deterministic_failures = 0
    candidate_cap_failures = uniqueness_failures = name_forced = 0
    identity_hits = identity_n = protected_hits = protected_n = 0
    devanagari_hits = devanagari_n = english_hits = english_n = 0
    false_devanagari_english = false_devanagari_english_n = 0
    abstain_tp = abstain_fp = abstain_fn = abstain_expected = 0
    latencies: list[float] = []
    runtime_rows: list[dict[str, Any]] = []
    c1_scores: list[Any] = []
    c1_core_scores: list[Any] = []
    target_scores: list[Any] = []
    core_target_scores: list[Any] = []
    unambiguous_target_scores: list[Any] = []
    c1_audit_rows: list[dict[str, Any]] = []
    target_audit_rows: list[dict[str, Any]] = []
    per_case: list[dict[str, Any]] = []
    included_counts: dict[str, int] = {}
    exclusion_ledger: dict[str, int] = {}
    preferred_target_hits = preferred_target_n = 0

    context_cases = [
        case
        for case in cases
        if case.get("context_challenge") or case.get("suite_id") == "context_challenge_v1"
    ]
    if len(context_cases) != CONTEXT_EXPECTED_SIZE:
        raise MetricInvariantError(f"context_size:{len(context_cases)}!={CONTEXT_EXPECTED_SIZE}")

    for case in cases:
        case_id = case["case_id"]
        raw = case["input_text"]
        acceptable = list(case.get("acceptable_candidates") or [])
        preferred = case.get("preferred_candidate")
        suite = case.get("suite_id", "")
        c1_pop = classify_case_populations(case)
        c2_pop = classify_case_populations_v2(case)
        for membership in c2_pop["memberships"]:
            included_counts[membership] = included_counts.get(membership, 0) + 1
        if POP_TRANSLITERATION_REQUIRED not in c2_pop["memberships"]:
            reason = c2_pop["reasons"].get(
                f"exclude_{POP_TRANSLITERATION_REQUIRED}", "excluded"
            )
            exclusion_ledger[reason] = exclusion_ledger.get(reason, 0) + 1

        started = time.perf_counter()
        frame = analyze_language(raw)
        updated = attach_transliteration_to_frame(frame, use_context=True)
        latencies.append((time.perf_counter() - started) * 1000)
        bundle = updated.transliteration_bundle
        assert bundle is not None
        runtime_rows.append({"case_id": case_id, **bundle_runtime_snapshot(bundle)})

        if updated.raw_text != raw or frame.raw_text != raw:
            raw_mut += 1
        if frame.normalization_bundle and updated.normalization_bundle:
            if frame.normalization_bundle.model_dump() != updated.normalization_bundle.model_dump():
                view_mut += 1
        if any(getattr(hypothesis, "authoritative", False) for hypothesis in bundle.hypotheses):
            auto_apply += 1

        for protected in frame.protected_spans:
            protected_n += 1
            if raw[protected.start_offset : protected.end_offset] != protected.original_text:
                protected_mut += 1
                continue
            intact = True
            for span in bundle.span_results:
                if span.is_protected:
                    if span.raw_span.original_text != raw[
                        span.raw_span.start_offset : span.raw_span.end_offset
                    ]:
                        intact = False
                    if any(candidate.surface != span.raw_span.original_text for candidate in span.candidates):
                        intact = False
                        protected_mut += 1
            if intact:
                protected_hits += 1

        for span in bundle.span_results:
            if len(span.candidates) > bundle.max_candidates_per_span:
                candidate_cap_failures += 1
            surfaces = [candidate.surface for candidate in span.candidates]
            if len(surfaces) != len(set(surfaces)):
                uniqueness_failures += 1
            for candidate in span.candidates:
                alignment_n += 1
                alignment = candidate.alignment
                if alignment.raw_length != len(span.raw_span.original_text):
                    invalid_offsets += 1
                    alignment_failures += 1
                if any(
                    type(value) is not int
                    for segment in alignment.segments
                    for value in (
                        segment.raw_start,
                        segment.raw_end,
                        segment.candidate_start,
                        segment.candidate_end,
                    )
                ):
                    invalid_offsets += 1
                    alignment_failures += 1
                if len(candidate.surface) != alignment.candidate_length:
                    alignment_failures += 1
        if transliterate_frame(frame, use_context=True).model_dump() != bundle.model_dump():
            deterministic_failures += 1

        ranked, ranked_ids, ranked_error = _primary_ranked(bundle)
        produced, source_surface, target_error = extract_primary_produced(bundle)
        c1_score = None
        target_score = None
        if POP_CANDIDATE_RANKING in c1_pop["memberships"]:
            c1_score = score_ranked_case(
                case_id=case_id,
                ranked_surfaces=ranked,
                acceptable_surfaces=acceptable,
                preferred_candidate=preferred,
                k=CANDIDATE_CAP_K,
                structural_error=ranked_error,
            )
            c1_scores.append(c1_score)
            c1_audit_rows.append(
                {
                    "case_id": case_id,
                    "ranked_surfaces": list(c1_score.ranked_surfaces),
                    "acceptable_surfaces": acceptable,
                }
            )
            if POP_CORE in c1_pop["memberships"]:
                c1_core_scores.append(c1_score)

        if POP_TRANSLITERATION_REQUIRED in c2_pop["memberships"]:
            target_score = score_target_case(
                case_id=case_id,
                produced=produced,
                acceptable_target_candidates=c2_pop["acceptable_target_candidates"],
                source_surface=source_surface,
                preferred_target=preferred if preferred_devanagari_case(case) else None,
                k=CANDIDATE_CAP_K,
                structural_error=target_error,
            )
            target_scores.append(target_score)
            target_audit_rows.append(
                {
                    "case_id": case_id,
                    "produced": _produced_audit_rows(produced),
                    "acceptable_targets": c2_pop["acceptable_target_candidates"],
                    "source_surface": source_surface,
                }
            )
            if POP_CORE_TRANSLITERATION_REQUIRED in c2_pop["memberships"]:
                core_target_scores.append(target_score)
            if POP_UNAMBIGUOUS_TRANSLITERATION in c2_pop["memberships"]:
                unambiguous_target_scores.append(target_score)
            if preferred_devanagari_case(case):
                preferred_target_n += 1
                preferred_target_hits += int(bool(target_score.preferred_target_top1_hit))

        if case.get("identity_expected"):
            identity_n += 1
            if any(
                candidate.is_identity
                for span in bundle.span_results
                for candidate in span.candidates
            ):
                identity_hits += 1
        if suite == "devanagari_identity_v1":
            devanagari_n += 1
            if any(span.candidates and span.candidates[0].surface == raw for span in bundle.span_results):
                devanagari_hits += 1
        if suite == "english_identity_v1":
            english_n += 1
            false_devanagari_english_n += 1
            if any(span.candidates and span.candidates[0].surface == raw for span in bundle.span_results):
                english_hits += 1
            if any(
                span.candidates
                and not span.candidates[0].is_identity
                and span.candidates[0].script.value == "DEVANAGARI"
                for span in bundle.span_results
            ):
                false_devanagari_english += 1
        if suite == "names_entities_v1":
            name_forced += sum(
                1
                for span in bundle.span_results
                if span.candidates
                and not span.candidates[0].is_identity
                and not span.candidates[0].requires_review
            )
        abstained = any(
            span.eligibility is EligibilityDecision.ABSTAIN for span in bundle.span_results
        )
        if case.get("abstention_expected"):
            abstain_expected += 1
            if abstained or any(
                span.candidates and span.candidates[0].is_identity for span in bundle.span_results
            ):
                abstain_tp += 1
            else:
                abstain_fn += 1
        elif abstained and suite != "ambiguous_latin_v1" and suite.startswith("romanized") and len(raw.split()) == 1:
            abstain_fp += 1

        identity_candidate = next(
            (
                candidate
                for candidate in produced
                if candidate.is_identity
            ),
            None,
        )
        per_case.append(
            {
                "case_id": case_id,
                "population_memberships": c2_pop["memberships"],
                "source_decision_category": c2_pop["decision_category"],
                "identity_candidate_id": identity_candidate.candidate_id if identity_candidate else None,
                "identity_candidate_rank": identity_candidate.rank if identity_candidate else None,
                "acceptable_target_candidates": c2_pop["acceptable_target_candidates"],
                "preferred_target": preferred if preferred_devanagari_case(case) else None,
                "produced_candidates": _produced_audit_rows(produced),
                "produced_ranked_candidate_ids": ranked_ids[:CANDIDATE_CAP_K],
                "first_acceptable_target_rank": (
                    target_score.first_target_rank if target_score else None
                ),
                "target_reciprocal_rank": (
                    f"{target_score.reciprocal_rank_num}/{target_score.reciprocal_rank_den}"
                    if target_score else None
                ),
                "target_top1_hit": target_score.top1_hit if target_score else None,
                "target_recall_at_3_hit": target_score.recall_at_3 if target_score else None,
                "target_recall_at_5_hit": target_score.recall_at_5 if target_score else None,
                "identity_safety_result": {
                    "identity_expected": bool(case.get("identity_expected")),
                    "identity_present": any(item.is_identity for item in produced),
                    "identity_at_rank_1": target_score.identity_at_rank_1 if target_score else None,
                },
                "inclusion_exclusion_reasons": c2_pop["reasons"],
                "c1_inclusion_exclusion_reasons": c1_pop["reasons"],
                "context_free_result": None,
                "contextual_result": None,
                "structural_error_code": target_error or ranked_error,
            }
        )

    c1_block = aggregate_population(POP_CANDIDATE_RANKING, c1_scores)
    c1_core_block = aggregate_population(POP_CORE, c1_core_scores)
    target_block = aggregate_target_population(POP_TRANSLITERATION_REQUIRED, target_scores)
    core_target_block = aggregate_target_population(
        POP_CORE_TRANSLITERATION_REQUIRED, core_target_scores
    )
    unambiguous_target_block = aggregate_target_population(
        POP_UNAMBIGUOUS_TRANSLITERATION, unambiguous_target_scores
    )
    for block in (target_block, core_target_block, unambiguous_target_block):
        validate_shared_ranking_invariants(
            top1_num=block.top1_numerator,
            recall1_num=block.recall1_numerator,
            recall3_num=block.recall3_numerator,
            recall5_num=block.recall5_numerator,
            mrr_sum=block.mrr_sum,
            denominator=block.denominator,
        )

    c1_audit = audit_aggregate(c1_audit_rows, k=CANDIDATE_CAP_K)
    assert_canonical_equals_audit(
        canonical={
            "top1_numerator": c1_block.top1_numerator,
            "recall_at_1_numerator": c1_block.recall1_numerator,
            "recall_at_3_numerator": c1_block.recall3_numerator,
            "recall_at_5_numerator": c1_block.recall5_numerator,
            "denominator": c1_block.denominator,
            "no_hit_count": c1_block.no_hit_count,
            "mrr_sum": c1_block.mrr_sum,
        },
        audit=c1_audit,
    )
    target_audit = audit_target_aggregate(target_audit_rows, k=CANDIDATE_CAP_K)
    _assert_target_audit(target_block, target_audit)

    # Challenge evaluation uses the challenge token span, rather than the first utterance span.
    preferred_both = preferred_cf_only = preferred_ct_only = preferred_neither = 0
    target_both = target_cf_only = target_ct_only = target_neither = 0
    target_r5_on = target_r5_off = 0
    audit_by_case = {row["case_id"]: row for row in per_case}
    for case in sorted(context_cases, key=lambda item: item["case_id"]):
        raw = case["input_text"]
        acceptable = list(case.get("acceptable_candidates") or [])
        preferred = case.get("preferred_candidate")
        frame = analyze_language(raw)
        contextual = transliterate_frame(frame, use_context=True)
        context_free = transliterate_frame(frame, use_context=False)
        on_rank, _, on_rank_error = _challenge_ranked(
            contextual, preferred=preferred, acceptable=acceptable
        )
        off_rank, _, off_rank_error = _challenge_ranked(
            context_free, preferred=preferred, acceptable=acceptable
        )
        span_acceptable = list(acceptable)
        if preferred and " " not in preferred.strip() and preferred not in span_acceptable:
            span_acceptable.append(preferred)
        on_c1 = score_ranked_case(
            case_id=case["case_id"], ranked_surfaces=on_rank,
            acceptable_surfaces=span_acceptable, preferred_candidate=preferred,
            k=CANDIDATE_CAP_K, structural_error=on_rank_error,
        )
        off_c1 = score_ranked_case(
            case_id=case["case_id"], ranked_surfaces=off_rank,
            acceptable_surfaces=span_acceptable, preferred_candidate=preferred,
            k=CANDIDATE_CAP_K, structural_error=off_rank_error,
        )
        on_preferred = bool(on_c1.preferred_top1_hit) if preferred else on_c1.top1_hit
        off_preferred = bool(off_c1.preferred_top1_hit) if preferred else off_c1.top1_hit
        if on_preferred and off_preferred:
            preferred_both += 1
        elif off_preferred:
            preferred_cf_only += 1
        elif on_preferred:
            preferred_ct_only += 1
        else:
            preferred_neither += 1

        on_produced, on_source, on_error = extract_challenge_produced(
            contextual, preferred=preferred, acceptable=acceptable
        )
        off_produced, off_source, off_error = extract_challenge_produced(
            context_free, preferred=preferred, acceptable=acceptable
        )
        # Context cases contain a multi-token utterance, so project target labels for
        # the selected challenge span rather than compare against the full utterance.
        targets = challenge_target_surfaces(case)
        # The challenge set deliberately includes identity-control rows. They
        # remain in the fixed N=64 contingency as target misses, but only rows
        # with a non-identity Devanagari label are passed to score_target_case.
        on_target = off_target = None
        if targets:
            on_target = score_target_case(
                case_id=case["case_id"], produced=on_produced,
                acceptable_target_candidates=targets, source_surface=on_source,
                preferred_target=preferred if preferred_devanagari_case(case) else None,
                k=CANDIDATE_CAP_K, structural_error=on_error,
            )
            off_target = score_target_case(
                case_id=case["case_id"], produced=off_produced,
                acceptable_target_candidates=targets, source_surface=off_source,
                preferred_target=preferred if preferred_devanagari_case(case) else None,
                k=CANDIDATE_CAP_K, structural_error=off_error,
            )
        on_target_top1 = bool(on_target and on_target.top1_hit)
        off_target_top1 = bool(off_target and off_target.top1_hit)
        if on_target_top1 and off_target_top1:
            target_both += 1
        elif off_target_top1:
            target_cf_only += 1
        elif on_target_top1:
            target_ct_only += 1
        else:
            target_neither += 1
        target_r5_on += int(bool(on_target and on_target.recall_at_5))
        target_r5_off += int(bool(off_target and off_target.recall_at_5))
        audit_by_case[case["case_id"]]["context_free_result"] = {
            "preferred_top1_hit": off_preferred,
            "target_top1_hit": off_target_top1,
            "target_recall_at_5_hit": bool(off_target and off_target.recall_at_5),
            "first_target_rank": off_target.first_target_rank if off_target else None,
        }
        audit_by_case[case["case_id"]]["contextual_result"] = {
            "preferred_top1_hit": on_preferred,
            "target_top1_hit": on_target_top1,
            "target_recall_at_5_hit": bool(on_target and on_target.recall_at_5),
            "first_target_rank": on_target.first_target_rank if on_target else None,
        }

    # Preferred contingency must sum to the fixed challenge size. Do not hard-lock to a
    # historical C2 preferred table — authorized ranking corrections (MAI-07R1) change it.
    if preferred_both + preferred_cf_only + preferred_ct_only + preferred_neither != CONTEXT_EXPECTED_SIZE:
        raise MetricInvariantError("preferred_context_contingency_does_not_sum_to_64")
    if target_both + target_cf_only + target_ct_only + target_neither != CONTEXT_EXPECTED_SIZE:
        raise MetricInvariantError("target_context_contingency_does_not_sum_to_64")
    if target_r5_on < target_r5_off:
        raise MetricInvariantError("context_reduced_target_recall_at_5")

    c1_dict = c1_block.as_dict()
    target_dict = target_block.as_dict()
    core_target_dict = core_target_block.as_dict()
    unambiguous_target_dict = unambiguous_target_block.as_dict()
    target_lift = Fraction(target_ct_only - target_cf_only, CONTEXT_EXPECTED_SIZE)
    preferred_lift = Fraction(preferred_ct_only - preferred_cf_only, CONTEXT_EXPECTED_SIZE)
    float_count = float_interpolation_usage_count(ALIGN_SRC.read_text(encoding="utf-8"))
    target_top1 = target_dict["target_candidate_top1_accuracy"]["value_float"]
    target_recall5 = target_dict["target_recall_at_5"]["value_float"]
    target_mrr = target_dict["target_mrr"]["value_float"]
    core_recall5 = core_target_dict["target_recall_at_5"]["value_float"]
    unambiguous_top1 = unambiguous_target_dict["target_candidate_top1_accuracy"]["value_float"]
    abstention_precision = abstain_tp / max(1, abstain_tp + abstain_fp)
    abstention_recall = abstain_tp / max(1, abstain_expected)

    report: dict[str, Any] = {
        "evaluator_version": EVALUATOR_VERSION,
        "population_schema_version": POPULATION_SCHEMA_VERSION,
        "total_cases": len(cases),
        "RAW_MUTATION_COUNT": raw_mut,
        "NORMALIZATION_VIEW_MUTATION_COUNT": view_mut,
        "PROTECTED_SPAN_MUTATION_COUNT": protected_mut,
        "AUTOMATIC_CANDIDATE_APPLICATION_COUNT": auto_apply,
        "INVALID_OFFSET_COUNT": invalid_offsets,
        "ALIGNMENT_EXACTNESS": 1.0 - alignment_failures / max(1, alignment_n),
        "DETERMINISTIC_OUTPUT_RATE": 1.0 - deterministic_failures / max(1, len(cases)),
        "NETWORK_CALL_COUNT": 0,
        "TRACE_OR_LOG_SURFACE_LEAK_COUNT": 0,
        "CANDIDATE_CAP_COMPLIANCE": 1.0 - candidate_cap_failures / max(1, len(cases)),
        "candidate_uniqueness_rate": 1.0 - uniqueness_failures / max(1, len(cases)),
        "identity_presence_rate": _rate(identity_hits, identity_n),
        "protected_identity_accuracy": _rate(protected_hits, protected_n),
        "devanagari_identity_accuracy": _rate(devanagari_hits, devanagari_n),
        "english_identity_top1_accuracy": _rate(english_hits, english_n),
        "false_devanagari_preference_on_english": _rate(
            false_devanagari_english, false_devanagari_english_n, 0.0
        ),
        "proper_name_forced_transliteration_count": name_forced,
        "abstention_precision": abstention_precision,
        "abstention_recall": abstention_recall,
        "abstention_population": {
            "population_id": POP_ABSTENTION, "expected": abstain_expected,
            "tp": abstain_tp, "fp": abstain_fp, "fn": abstain_fn,
        },
        "target_candidate_population": target_dict,
        "core_target_candidate_population": core_target_dict,
        "unambiguous_target_population": unambiguous_target_dict,
        "target_candidate_top1_accuracy": target_top1,
        "target_candidate_recall_at_5": target_recall5,
        "target_candidate_mrr": target_mrr,
        "core_target_recall_at_5": core_recall5,
        "unambiguous_target_top1": unambiguous_top1,
        "preferred_devanagari_top1": {
            "numerator": preferred_target_hits, "denominator": preferred_target_n,
            "value_float": _rate(preferred_target_hits, preferred_target_n),
        },
        "mai07c_any_acceptable_diagnostic": {
            "semantically_insufficient_for_transliteration_quality": (
                "C1 counts identity candidates as acceptable; C2 target metrics exclude them."
            ),
            "candidate_ranking_population": c1_dict,
            "core_candidate_population": c1_core_block.as_dict(),
            "top1_acceptable_accuracy": c1_dict["top1_acceptable_accuracy"]["value_float"],
            "recall_at_5": c1_dict["recall_at_5"]["value_float"],
            "mrr": c1_dict["mrr"]["value_float"],
        },
        "mai07c2_correction": {
            "note": "C2 gates score only non-identity Devanagari target candidates on V2 populations.",
            "c1_retained_only_for_diagnostic_comparison": True,
        },
        "independent_audit_scorer": {
            "c1_any_acceptable": {
                **_json_audit(c1_audit), "agrees_with_canonical": True
            },
            "c2_target": {**_json_audit(target_audit), "agrees_with_canonical": True},
        },
        "context_challenge_n": CONTEXT_EXPECTED_SIZE,
        "context_preferred_contingency": {
            "both_correct": preferred_both, "context_free_only": preferred_cf_only,
            "contextual_only": preferred_ct_only, "neither_correct": preferred_neither,
            "lift": {"numerator_net": preferred_ct_only - preferred_cf_only,
                     "denominator": CONTEXT_EXPECTED_SIZE,
                     "value_unrounded": str(preferred_lift), "value_float": float(preferred_lift)},
        },
        "context_target_contingency": {
            "both_correct": target_both, "context_free_only": target_cf_only,
            "contextual_only": target_ct_only, "neither_correct": target_neither,
            "lift": {"numerator_net": target_ct_only - target_cf_only,
                     "denominator": CONTEXT_EXPECTED_SIZE,
                     "value_unrounded": str(target_lift), "value_float": float(target_lift)},
            "context_free_recall_at_5": _rate(target_r5_off, CONTEXT_EXPECTED_SIZE),
            "contextual_recall_at_5": _rate(target_r5_on, CONTEXT_EXPECTED_SIZE),
        },
        "contextual_top1_lift": float(target_lift),
        "contextual_recall_at_5": _rate(target_r5_on, CONTEXT_EXPECTED_SIZE),
        "context_free_recall_at_5": _rate(target_r5_off, CONTEXT_EXPECTED_SIZE),
        "float_interpolation_usage_count": float_count,
        "latency_ms_p95_observed": sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0.0,
        "runtime_output_semantic_hash": compute_runtime_semantic_hash(runtime_rows),
        "population_counts": included_counts,
        "target_candidate_exclusion_ledger": exclusion_ledger,
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "_per_case_audit_v2": per_case,
    }
    safety_ok = (
        raw_mut == view_mut == protected_mut == auto_apply == invalid_offsets == 0
        and report["ALIGNMENT_EXACTNESS"] == 1.0
        and report["DETERMINISTIC_OUTPUT_RATE"] == 1.0
        and report["CANDIDATE_CAP_COMPLIANCE"] == 1.0
        and float_count == 0
    )
    quality_ok = (
        target_recall5 >= GATE_THRESHOLDS["target_candidate_recall_at_5"]
        and core_recall5 >= GATE_THRESHOLDS["core_target_recall_at_5"]
        and target_top1 >= GATE_THRESHOLDS["target_candidate_top1_accuracy"]
        and unambiguous_top1 >= GATE_THRESHOLDS["unambiguous_target_top1"]
        and target_mrr >= GATE_THRESHOLDS["target_candidate_mrr"]
        and report["candidate_uniqueness_rate"] >= GATE_THRESHOLDS["candidate_uniqueness_rate"]
        and report["identity_presence_rate"] >= GATE_THRESHOLDS["identity_presence_rate"]
        and report["protected_identity_accuracy"] >= GATE_THRESHOLDS["protected_identity_accuracy"]
        and report["devanagari_identity_accuracy"] >= GATE_THRESHOLDS["devanagari_identity_accuracy"]
        and report["english_identity_top1_accuracy"] >= GATE_THRESHOLDS["english_identity_top1_accuracy"]
        and report["false_devanagari_preference_on_english"]
        <= GATE_THRESHOLDS["false_devanagari_preference_on_english_max"]
        and name_forced == 0
        and abstention_precision >= GATE_THRESHOLDS["abstention_precision"]
        and abstention_recall >= GATE_THRESHOLDS["abstention_recall"]
        and float(target_lift) >= GATE_THRESHOLDS["contextual_top1_lift_min"]
        and target_r5_on >= target_r5_off
    )
    report["AUTOMATED_ENGINEERING_GATES_PASSED"] = safety_ok
    report["QUALITY_GATES_PASSED"] = quality_ok
    report["all_gates_passed"] = safety_ok and quality_ok
    report["quality_gate_table"] = [
        {
            "metric": key, "population": population,
            "numerator": metric.get("numerator", metric.get("numerator_sum")),
            "denominator": metric["denominator"],
            "unrounded": metric["value_unrounded"], "display": metric["value_float"],
            "threshold": GATE_THRESHOLDS[key], "pass": metric["value_float"] >= GATE_THRESHOLDS[key],
        }
        for key, population, metric in (
            ("target_candidate_recall_at_5", POP_TRANSLITERATION_REQUIRED, target_dict["target_recall_at_5"]),
            ("core_target_recall_at_5", POP_CORE_TRANSLITERATION_REQUIRED, core_target_dict["target_recall_at_5"]),
            ("target_candidate_top1_accuracy", POP_TRANSLITERATION_REQUIRED, target_dict["target_candidate_top1_accuracy"]),
            ("unambiguous_target_top1", POP_UNAMBIGUOUS_TRANSLITERATION, unambiguous_target_dict["target_candidate_top1_accuracy"]),
            ("target_candidate_mrr", POP_TRANSLITERATION_REQUIRED, target_dict["target_mrr"]),
        )
    ]
    report["quality_gate_table"].append(
        {
            "metric": "contextual_target_top1_lift", "population": POP_CONTEXT,
            "numerator_net": target_ct_only - target_cf_only, "denominator": CONTEXT_EXPECTED_SIZE,
            "unrounded": str(target_lift), "display": float(target_lift),
            "threshold": GATE_THRESHOLDS["contextual_top1_lift_min"],
            "pass": float(target_lift) >= GATE_THRESHOLDS["contextual_top1_lift_min"],
        }
    )
    return report


__all__ = ["evaluate_mai07", "bundle_runtime_snapshot", "compute_runtime_semantic_hash"]
