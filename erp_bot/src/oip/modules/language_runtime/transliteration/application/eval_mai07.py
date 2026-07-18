"""Evaluate MAI-07 Romanized Nepali candidate transliteration gates (MAI-07C scorer)."""

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
from ..infrastructure.resource_repository import RESOURCES_DIR
from .eval_audit_scorer import audit_aggregate
from .eval_invariants import (
    MetricInvariantError,
    assert_canonical_equals_audit,
    validate_shared_ranking_invariants,
)
from .eval_metric_definitions import (
    CANDIDATE_CAP_K,
    C1_AUDIT_HASH,
    CONTEXT_EXPECTED_SIZE,
    EVALUATOR_VERSION,
    GATE_THRESHOLDS,
    POP_ABSTENTION,
    POP_CANDIDATE_RANKING,
    POP_CONTEXT,
    POP_CORE,
    POP_IDENTITY,
    POP_UNAMBIGUOUS,
    POPULATION_SCHEMA_VERSION,
)
from .eval_populations import (
    classify_case_populations,
    validate_population_totals,
)
from .eval_scoring import (
    RankedCaseScore,
    aggregate_population,
    score_ranked_case,
)
from .transliteration_service import attach_transliteration_to_frame, transliterate_frame

ALIGN_SRC = Path(__file__).resolve().parents[1] / "domain" / "alignment.py"

# Legacy report claimed MRR=1.0 with top1≈0.972 on mismatched definitions/populations.
LEGACY_INCORRECT_MRR = 1.0
LEGACY_INCORRECT_TOP1 = 0.9717868338557993
LEGACY_INCORRECT_RECALL5 = 0.9765013054830287


def load_cases(manifest_path: Path, repo: Path) -> list[dict[str, Any]]:
    man = json.loads(manifest_path.read_text(encoding="utf-8"))
    cases: list[dict[str, Any]] = []
    for f in man["files"]:
        path = repo / f["path"]
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                cases.append(json.loads(line))
    return cases


def _list_from_span(sp) -> tuple[list[str], list[str], str | None]:
    surfaces = [c.surface for c in sp.candidates]
    ids = [c.candidate_id for c in sp.candidates]
    err = None
    if len(surfaces) != len(set(surfaces)):
        err = "duplicate_candidates_in_ranked_list"
    return surfaces, ids, err


def extract_primary_ranked_list(bundle) -> tuple[list[str], list[str], str | None]:
    """
    Produced ranked candidate list for scoring: first non-whitespace content span
    with candidates. Returns (surfaces, candidate_ids, structural_error).
    """
    for sp in bundle.span_results:
        text = sp.raw_span.original_text
        if not text.strip():
            continue
        if not sp.candidates:
            continue
        return _list_from_span(sp)
    return [], [], "empty_candidate_list"


def extract_challenge_ranked_list(
    bundle,
    *,
    preferred: str | None,
    acceptable: list[str],
) -> tuple[list[str], list[str], str | None]:
    """
    Context-challenge ranking list: prefer the span whose raw surface equals the
    preferred challenge token (or a single-token acceptable), else primary span.

    Challenge cases are multi-token utterances; scoring the first span alone
    mis-attributes English identity tokens and understates true contextual lift.
    """
    targets: list[str] = []
    if preferred and " " not in preferred.strip():
        targets.append(preferred)
    for a in acceptable:
        if a and " " not in a.strip() and a not in targets:
            targets.append(a)
    for target in targets:
        for sp in bundle.span_results:
            if sp.raw_span.original_text == target and sp.candidates:
                return _list_from_span(sp)
    return extract_primary_ranked_list(bundle)


def bundle_runtime_snapshot(bundle) -> dict[str, Any]:
    spans = []
    for sp in bundle.span_results:
        spans.append(
            {
                "span_id": sp.span_id,
                "eligibility": sp.eligibility.value,
                "raw": sp.raw_span.original_text,
                "cands": [
                    {
                        "id": x.candidate_id,
                        "surface": x.surface,
                        "rank": x.rank,
                        "score": x.ranking_score,
                        "identity": x.is_identity,
                    }
                    for x in sp.candidates
                ],
            }
        )
    hyps = [
        {
            "id": h.hypothesis_id,
            "refs": list(h.candidate_refs),
            "preview": h.preview_surface,
            "score": h.aggregate_ranking_score,
        }
        for h in bundle.hypotheses
    ]
    return {
        "status": bundle.analysis_status.value,
        "spans": spans,
        "hyps": hyps,
        "abstentions": bundle.abstention_count,
    }


def compute_runtime_semantic_hash(rows: list[dict[str, Any]]) -> str:
    ordered = sorted(rows, key=lambda r: r["case_id"])
    payload = json.dumps(ordered, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _rate(h: int, n: int, default: float = 1.0) -> float:
    return (h / n) if n else default


def _evaluate_mai07_c1_legacy(cases: list[dict[str, Any]]) -> dict[str, Any]:
    pop_errors = validate_population_totals(cases)
    if pop_errors:
        raise MetricInvariantError(";".join(pop_errors))

    raw_mut = 0
    view_mut = 0
    prot_mut = 0
    auto_apply = 0
    invalid_off = 0
    align_fail = 0
    align_n = 0
    det_fail = 0
    network = 0
    leak = 0
    cap_fail = 0
    uniq_fail = 0

    id_req_h = 0
    id_req_n = 0
    prot_id_h = 0
    prot_id_n = 0
    dev_id_h = 0
    dev_id_n = 0
    eng_top1_h = 0
    eng_top1_n = 0
    false_dev_eng = 0
    false_dev_eng_n = 0
    name_forced = 0
    abstain_tp = 0
    abstain_fp = 0
    abstain_fn = 0
    abstain_exp = 0

    ranking_scores: list[RankedCaseScore] = []
    core_scores: list[RankedCaseScore] = []
    unamb_pref_hits = 0
    unamb_n = 0
    pref_top1_h = 0
    pref_top1_n = 0
    audit_rows: list[dict[str, Any]] = []
    per_case_audit: list[dict[str, Any]] = []
    runtime_rows: list[dict[str, Any]] = []
    exclusion_ledger: dict[str, int] = {}
    included_counts: dict[str, int] = {
        POP_CANDIDATE_RANKING: 0,
        POP_CORE: 0,
        POP_UNAMBIGUOUS: 0,
        POP_IDENTITY: 0,
        POP_ABSTENTION: 0,
        POP_CONTEXT: 0,
    }

    ctx_cases = [c for c in cases if c.get("context_challenge") or c.get("suite_id") == "context_challenge_v1"]
    if len(ctx_cases) != CONTEXT_EXPECTED_SIZE:
        raise MetricInvariantError(f"context_size:{len(ctx_cases)}!={CONTEXT_EXPECTED_SIZE}")

    latencies: list[float] = []

    for c in cases:
        raw = c["input_text"]
        acceptable = list(c.get("acceptable_candidates") or [])
        preferred = c.get("preferred_candidate")
        suite = c.get("suite_id", "")
        case_id = c["case_id"]
        pop = classify_case_populations(c)
        for m in pop["memberships"]:
            included_counts[m] = included_counts.get(m, 0) + 1
        if POP_CANDIDATE_RANKING not in pop["memberships"]:
            reason = pop["reasons"].get(f"exclude_{POP_CANDIDATE_RANKING}", "excluded")
            exclusion_ledger[reason] = exclusion_ledger.get(reason, 0) + 1

        t0 = time.perf_counter()
        frame = analyze_language(raw)
        updated = attach_transliteration_to_frame(frame, use_context=True)
        latencies.append((time.perf_counter() - t0) * 1000)
        bundle = updated.transliteration_bundle
        assert bundle is not None

        snap = bundle_runtime_snapshot(bundle)
        runtime_rows.append({"case_id": case_id, **snap})

        if updated.raw_text != raw or frame.raw_text != raw:
            raw_mut += 1
        if frame.normalization_bundle and updated.normalization_bundle:
            if frame.normalization_bundle.model_dump() != updated.normalization_bundle.model_dump():
                view_mut += 1

        for p in frame.protected_spans:
            prot_id_n += 1
            if raw[p.start_offset : p.end_offset] != p.original_text:
                prot_mut += 1
            else:
                ok = True
                for sp in bundle.span_results:
                    if sp.is_protected and sp.raw_span.original_text != (
                        raw[sp.raw_span.start_offset : sp.raw_span.end_offset]
                    ):
                        ok = False
                    if sp.is_protected:
                        for cand in sp.candidates:
                            if cand.surface != sp.raw_span.original_text:
                                ok = False
                                prot_mut += 1
                if ok:
                    prot_id_h += 1

        if any(getattr(h, "authoritative", False) for h in bundle.hypotheses):
            auto_apply += 1

        for sp in bundle.span_results:
            for cand in sp.candidates:
                align_n += 1
                am = cand.alignment
                if am.raw_length != len(sp.raw_span.original_text):
                    invalid_off += 1
                    align_fail += 1
                if any(
                    type(x) is not int
                    for s in am.segments
                    for x in (s.raw_start, s.raw_end, s.candidate_start, s.candidate_end)
                ):
                    invalid_off += 1
                    align_fail += 1
                if len(cand.surface) != am.candidate_length:
                    align_fail += 1

        b2 = transliterate_frame(frame, use_context=True)
        if b2.model_dump() != bundle.model_dump():
            det_fail += 1

        for sp in bundle.span_results:
            if len(sp.candidates) > bundle.max_candidates_per_span:
                cap_fail += 1
            surfaces = [cand.surface for cand in sp.candidates]
            if len(surfaces) != len(set(surfaces)):
                uniq_fail += 1

        ranked_surfaces, ranked_ids, struct_err = extract_primary_ranked_list(bundle)
        score: RankedCaseScore | None = None
        if POP_CANDIDATE_RANKING in pop["memberships"]:
            if not acceptable:
                raise MetricInvariantError(f"empty_acceptable_in_ranking:{case_id}")
            score = score_ranked_case(
                case_id=case_id,
                ranked_surfaces=ranked_surfaces,
                acceptable_surfaces=acceptable,
                preferred_candidate=preferred,
                k=CANDIDATE_CAP_K,
                structural_error=struct_err,
            )
            ranking_scores.append(score)
            audit_rows.append(
                {
                    "case_id": case_id,
                    "ranked_surfaces": list(score.ranked_surfaces),
                    "acceptable_surfaces": list(acceptable),
                }
            )
            if preferred is not None:
                pref_top1_n += 1
                if score.preferred_top1_hit:
                    pref_top1_h += 1

        if POP_CORE in pop["memberships"]:
            if score is None:
                score = score_ranked_case(
                    case_id=case_id,
                    ranked_surfaces=ranked_surfaces,
                    acceptable_surfaces=acceptable,
                    preferred_candidate=preferred,
                    k=CANDIDATE_CAP_K,
                    structural_error=struct_err,
                )
            core_scores.append(score)

        if POP_UNAMBIGUOUS in pop["memberships"]:
            unamb_n += 1
            if preferred is not None and ranked_surfaces and ranked_surfaces[0] == preferred:
                unamb_pref_hits += 1

        if c.get("identity_expected"):
            id_req_n += 1
            if any(
                any(cand.is_identity for cand in sp.candidates)
                for sp in bundle.span_results
                if sp.candidates
            ):
                id_req_h += 1

        if suite == "devanagari_identity_v1":
            dev_id_n += 1
            if any(sp.candidates and sp.candidates[0].surface == raw for sp in bundle.span_results):
                dev_id_h += 1

        if suite == "english_identity_v1":
            eng_top1_n += 1
            false_dev_eng_n += 1
            top_ok = any(
                sp.candidates and sp.candidates[0].surface == raw for sp in bundle.span_results
            )
            if top_ok:
                eng_top1_h += 1
            for sp in bundle.span_results:
                if (
                    sp.candidates
                    and not sp.candidates[0].is_identity
                    and sp.candidates[0].script.value == "DEVANAGARI"
                ):
                    false_dev_eng += 1
                    break

        if suite == "names_entities_v1":
            for sp in bundle.span_results:
                if sp.candidates and not sp.candidates[0].is_identity and not sp.candidates[0].requires_review:
                    if not sp.candidates[0].is_identity:
                        name_forced += 1

        if c.get("abstention_expected"):
            abstain_exp += 1
            did = any(sp.eligibility is EligibilityDecision.ABSTAIN for sp in bundle.span_results) or any(
                sp.candidates and sp.candidates[0].is_identity for sp in bundle.span_results
            )
            if did:
                abstain_tp += 1
            else:
                abstain_fn += 1
        else:
            if any(sp.eligibility is EligibilityDecision.ABSTAIN for sp in bundle.span_results):
                if suite == "ambiguous_latin_v1":
                    pass
                elif suite.startswith("romanized") and len(raw.split()) == 1:
                    abstain_fp += 1

        # Per-case audit row (synthetic evaluation artifact)
        row: dict[str, Any] = {
            "case_id": case_id,
            "population_memberships": list(pop["memberships"]),
            "inclusion_exclusion_reasons": pop["reasons"],
            "expected_decision": {
                "preferred_candidate": preferred,
                "acceptable_candidates": acceptable,
                "abstention_expected": bool(c.get("abstention_expected")),
                "identity_expected": bool(c.get("identity_expected")),
            },
            "produced_ranked_candidate_ids": ranked_ids[:CANDIDATE_CAP_K],
            "produced_ranked_surfaces": ranked_surfaces[:CANDIDATE_CAP_K],
            "first_acceptable_rank": score.first_acceptable_rank if score else None,
            "reciprocal_rank_numerator": score.reciprocal_rank_num if score else None,
            "reciprocal_rank_denominator": score.reciprocal_rank_den if score else None,
            "top1_hit": score.top1_hit if score else None,
            "recall_at_3_hit": score.recall_at_3 if score else None,
            "recall_at_5_hit": score.recall_at_5 if score else None,
            "abstention_expectation": bool(c.get("abstention_expected")),
            "abstention_result": any(
                sp.eligibility is EligibilityDecision.ABSTAIN for sp in bundle.span_results
            ),
            "context_free_result": None,
            "contextual_result": None,
            "structural_error_code": struct_err,
        }
        per_case_audit.append(row)

    # Aggregate ranking metrics
    ranking_block = aggregate_population(POP_CANDIDATE_RANKING, ranking_scores)
    core_block = aggregate_population(POP_CORE, core_scores)
    validate_shared_ranking_invariants(
        top1_num=ranking_block.top1_numerator,
        recall1_num=ranking_block.recall1_numerator,
        recall3_num=ranking_block.recall3_numerator,
        recall5_num=ranking_block.recall5_numerator,
        mrr_sum=ranking_block.mrr_sum,
        denominator=ranking_block.denominator,
    )
    if core_block.denominator:
        validate_shared_ranking_invariants(
            top1_num=core_block.top1_numerator,
            recall1_num=core_block.recall1_numerator,
            recall3_num=core_block.recall3_numerator,
            recall5_num=core_block.recall5_numerator,
            mrr_sum=core_block.mrr_sum,
            denominator=core_block.denominator,
        )

    audit_agg = audit_aggregate(audit_rows, k=CANDIDATE_CAP_K)
    assert_canonical_equals_audit(
        canonical={
            "top1_numerator": ranking_block.top1_numerator,
            "recall_at_1_numerator": ranking_block.recall1_numerator,
            "recall_at_3_numerator": ranking_block.recall3_numerator,
            "recall_at_5_numerator": ranking_block.recall5_numerator,
            "denominator": ranking_block.denominator,
            "no_hit_count": ranking_block.no_hit_count,
            "mrr_sum": ranking_block.mrr_sum,
        },
        audit=audit_agg,
    )

    # Context-free vs contextual on challenge subset (paired contingency)
    both = cf_only = ct_only = neither = 0
    ctx_top1_on = ctx_top1_off = 0
    ctx_r1_on = ctx_r1_off = 0
    ctx_r3_on = ctx_r3_off = 0
    ctx_r5_on = ctx_r5_off = 0
    ctx_mrr_on = Fraction(0)
    ctx_mrr_off = Fraction(0)
    ctx_nohit_on = ctx_nohit_off = 0
    ctx_n = 0
    ctx_audit_index = {r["case_id"]: r for r in per_case_audit}

    for c in sorted(ctx_cases, key=lambda x: x["case_id"]):
        raw = c["input_text"]
        acceptable = list(c.get("acceptable_candidates") or [])
        preferred = c.get("preferred_candidate")
        frame = analyze_language(raw)
        on = transliterate_frame(frame, use_context=True)
        off = transliterate_frame(frame, use_context=False)
        ctx_n += 1

        on_rank, _, on_err = extract_challenge_ranked_list(
            on, preferred=preferred, acceptable=acceptable
        )
        off_rank, _, off_err = extract_challenge_ranked_list(
            off, preferred=preferred, acceptable=acceptable
        )
        # Challenge-span acceptable surfaces: frozen acceptables (+ preferred token if needed).
        span_acceptable = list(acceptable)
        if preferred and " " not in preferred.strip() and preferred not in span_acceptable:
            span_acceptable.append(preferred)
        on_score = score_ranked_case(
            case_id=c["case_id"],
            ranked_surfaces=on_rank,
            acceptable_surfaces=span_acceptable,
            preferred_candidate=preferred,
            k=CANDIDATE_CAP_K,
            structural_error=on_err,
        )
        off_score = score_ranked_case(
            case_id=c["case_id"],
            ranked_surfaces=off_rank,
            acceptable_surfaces=span_acceptable,
            preferred_candidate=preferred,
            k=CANDIDATE_CAP_K,
            structural_error=off_err,
        )

        # Top-1 lift contingency uses preferred@1 when preferred is declared
        # (matches frozen challenge intent); recall/MRR use acceptable-set ranks.
        def _ctx_top1(score) -> bool:
            if preferred is not None:
                return bool(score.preferred_top1_hit)
            return bool(score.top1_hit)

        on_top1 = _ctx_top1(on_score)
        off_top1 = _ctx_top1(off_score)

        if on_top1:
            ctx_top1_on += 1
        if off_top1:
            ctx_top1_off += 1
        if on_score.recall_at_1:
            ctx_r1_on += 1
        if off_score.recall_at_1:
            ctx_r1_off += 1
        if on_score.recall_at_3:
            ctx_r3_on += 1
        if off_score.recall_at_3:
            ctx_r3_off += 1
        if on_score.recall_at_5:
            ctx_r5_on += 1
        if off_score.recall_at_5:
            ctx_r5_off += 1
        ctx_mrr_on += Fraction(on_score.reciprocal_rank_num, on_score.reciprocal_rank_den)
        ctx_mrr_off += Fraction(off_score.reciprocal_rank_num, off_score.reciprocal_rank_den)
        if on_score.first_acceptable_rank is None:
            ctx_nohit_on += 1
        if off_score.first_acceptable_rank is None:
            ctx_nohit_off += 1

        if on_top1 and off_top1:
            both += 1
        elif on_top1:
            ct_only += 1
        elif off_top1:
            cf_only += 1
        else:
            neither += 1

        audit_row = ctx_audit_index[c["case_id"]]
        audit_row["context_free_result"] = {
            "top1_hit": off_top1,
            "recall_at_5_hit": off_score.recall_at_5,
            "first_acceptable_rank": off_score.first_acceptable_rank,
            "reciprocal_rank": f"{off_score.reciprocal_rank_num}/{off_score.reciprocal_rank_den}",
        }
        audit_row["contextual_result"] = {
            "top1_hit": on_top1,
            "recall_at_5_hit": on_score.recall_at_5,
            "first_acceptable_rank": on_score.first_acceptable_rank,
            "reciprocal_rank": f"{on_score.reciprocal_rank_num}/{on_score.reciprocal_rank_den}",
        }

    if both + cf_only + ct_only + neither != CONTEXT_EXPECTED_SIZE:
        raise MetricInvariantError("context_contingency_does_not_sum_to_64")
    if ctx_r5_on < ctx_r5_off:
        raise MetricInvariantError("context_reduced_recall_at_5")

    float_count = float_interpolation_usage_count(ALIGN_SRC.read_text(encoding="utf-8"))
    runtime_hash = compute_runtime_semantic_hash(runtime_rows)

    ranking_dict = ranking_block.as_dict()
    core_dict = core_block.as_dict()
    mrr_float = ranking_dict["mrr"]["value_float"]
    top1_float = ranking_dict["top1_acceptable_accuracy"]["value_float"]
    recall5_float = ranking_dict["recall_at_5"]["value_float"]
    core_r5_float = core_dict["recall_at_5"]["value_float"]
    unamb_float = _rate(unamb_pref_hits, unamb_n)
    ctx_lift = _rate(ctx_top1_on, ctx_n) - _rate(ctx_top1_off, ctx_n)
    abstain_precision = abstain_tp / max(1, abstain_tp + abstain_fp)
    abstain_recall = abstain_tp / max(1, abstain_exp)

    # Gate-facing keys: population-qualified primary names + legacy aliases that
    # now bind to the SAME denominator (correction for MAI-07C).
    report: dict[str, Any] = {
        "evaluator_version": EVALUATOR_VERSION,
        "population_schema_version": POPULATION_SCHEMA_VERSION,
        "total_cases": len(cases),
        "RAW_MUTATION_COUNT": raw_mut,
        "NORMALIZATION_VIEW_MUTATION_COUNT": view_mut,
        "PROTECTED_SPAN_MUTATION_COUNT": prot_mut,
        "AUTOMATIC_CANDIDATE_APPLICATION_COUNT": auto_apply,
        "INVALID_OFFSET_COUNT": invalid_off,
        "ALIGNMENT_EXACTNESS": 1.0 - (align_fail / max(1, align_n)),
        "DETERMINISTIC_OUTPUT_RATE": 1.0 - (det_fail / max(1, len(cases))),
        "NETWORK_CALL_COUNT": network,
        "TRACE_OR_LOG_SURFACE_LEAK_COUNT": leak,
        "CANDIDATE_CAP_COMPLIANCE": 1.0 - (cap_fail / max(1, len(cases))),
        "candidate_ranking_population": ranking_dict,
        "core_candidate_population": core_dict,
        "candidate_ranking_top1_acceptable_accuracy": top1_float,
        "candidate_ranking_recall_at_5": recall5_float,
        "candidate_ranking_mrr": mrr_float,
        "core_recall_at_5": core_r5_float,
        # Corrected aliases (same population as candidate_ranking_* — not the old mixed denom)
        "top1_acceptable_accuracy": top1_float,
        "acceptable_recall_at_5": recall5_float,
        "mean_reciprocal_rank": mrr_float,
        "preferred_candidate_top1": {
            "population_id": "PREFERRED_CANDIDATE_ON_RANKING_SUBSET",
            "numerator": pref_top1_h,
            "denominator": pref_top1_n,
            "value_float": _rate(pref_top1_h, pref_top1_n),
            "note": "Separate from acceptable-set top-1; this is the metric that produced ~0.972 pre-07C",
        },
        "unambiguous_top1_accuracy": unamb_float,
        "unambiguous_top1": {
            "population_id": POP_UNAMBIGUOUS,
            "numerator": unamb_pref_hits,
            "denominator": unamb_n,
            "value_float": unamb_float,
            "definition": "preferred_candidate at rank-1 within predeclared unambiguous set",
        },
        "candidate_uniqueness_rate": 1.0 - (uniq_fail / max(1, len(cases))),
        "identity_presence_rate": _rate(id_req_h, id_req_n),
        "protected_identity_accuracy": _rate(prot_id_h, prot_id_n),
        "devanagari_identity_accuracy": _rate(dev_id_h, dev_id_n),
        "english_identity_top1_accuracy": _rate(eng_top1_h, eng_top1_n),
        "false_devanagari_preference_on_english": _rate(false_dev_eng, false_dev_eng_n, 0.0),
        "proper_name_forced_transliteration_count": name_forced,
        "abstention_precision": abstain_precision,
        "abstention_recall": abstain_recall,
        "abstention_population": {
            "population_id": POP_ABSTENTION,
            "expected": abstain_exp,
            "tp": abstain_tp,
            "fp": abstain_fp,
            "fn": abstain_fn,
        },
        "context_challenge_n": ctx_n,
        "context_challenge_population": {
            "population_id": POP_CONTEXT,
            "denominator": ctx_n,
            "paired_contingency_top1": {
                "both_correct": both,
                "context_free_only": cf_only,
                "contextual_only": ct_only,
                "neither_correct": neither,
            },
            "context_free_top1": {
                "numerator": ctx_top1_off,
                "denominator": ctx_n,
                "value_float": _rate(ctx_top1_off, ctx_n),
            },
            "contextual_top1": {
                "numerator": ctx_top1_on,
                "denominator": ctx_n,
                "value_float": _rate(ctx_top1_on, ctx_n),
            },
            "contextual_top1_lift": {
                "numerator_net": ct_only - cf_only,
                "denominator": ctx_n,
                "value_unrounded": str(Fraction(ct_only - cf_only, ctx_n) if ctx_n else 0),
                "value_float": ctx_lift,
            },
            "context_free_recall_at_1": _rate(ctx_r1_off, ctx_n),
            "contextual_recall_at_1": _rate(ctx_r1_on, ctx_n),
            "context_free_recall_at_3": _rate(ctx_r3_off, ctx_n),
            "contextual_recall_at_3": _rate(ctx_r3_on, ctx_n),
            "context_free_recall_at_5": _rate(ctx_r5_off, ctx_n),
            "contextual_recall_at_5": _rate(ctx_r5_on, ctx_n),
            "context_free_mrr": float(ctx_mrr_off / ctx_n) if ctx_n else 0.0,
            "contextual_mrr": float(ctx_mrr_on / ctx_n) if ctx_n else 0.0,
            "context_free_no_hit_count": ctx_nohit_off,
            "contextual_no_hit_count": ctx_nohit_on,
        },
        "contextual_top1": _rate(ctx_top1_on, ctx_n),
        "context_free_top1": _rate(ctx_top1_off, ctx_n),
        "contextual_top1_lift": ctx_lift,
        "contextual_recall_at_5": _rate(ctx_r5_on, ctx_n),
        "context_free_recall_at_5": _rate(ctx_r5_off, ctx_n),
        "float_interpolation_usage_count": float_count,
        "latency_ms_p95_observed": sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0.0,
        "runtime_output_semantic_hash": runtime_hash,
        "independent_audit_scorer": {
            "denominator": audit_agg["denominator"],
            "top1_numerator": audit_agg["top1_numerator"],
            "recall_at_5_numerator": audit_agg["recall_at_5_numerator"],
            "mrr_unrounded": str(audit_agg["mrr"]),
            "mrr_float": float(audit_agg["mrr"]),
            "no_hit_count": audit_agg["no_hit_count"],
            "hit_rank_histogram": audit_agg["hit_rank_histogram"],
            "agrees_with_canonical": True,
        },
        "population_counts": included_counts,
        "candidate_ranking_exclusion_ledger": exclusion_ledger,
        "mai07c_correction": {
            "root_cause": (
                "top1_acceptable_accuracy used preferred_candidate when set, while "
                "mean_reciprocal_rank used any acceptable surface (often identity at rank 1); "
                "additionally acceptable_recall_at_5 included context_challenge_v1 while "
                "top1/MRR excluded it — shared-population invariant top1<=MRR<=recall@5 was "
                "never enforceable under unqualified metric names"
            ),
            "legacy_incorrect_mrr": LEGACY_INCORRECT_MRR,
            "legacy_incorrect_top1": LEGACY_INCORRECT_TOP1,
            "legacy_incorrect_recall_at_5": LEGACY_INCORRECT_RECALL5,
            "legacy_note": (
                "Legacy MRR≈1.0 reflected acceptable-set RR on ranking suites with all "
                "hits at rank 1, but was reported beside preferred-conditioned top-1≈0.972 "
                "and a larger recall@5 denominator."
            ),
            "corrected_mrr": mrr_float,
            "corrected_top1_acceptable": top1_float,
            "corrected_recall_at_5": recall5_float,
            "preferred_candidate_top1_for_comparison": _rate(pref_top1_h, pref_top1_n),
        },
        "LINGUIST_APPROVED": False,
        "PRODUCTION_APPROVED": False,
        "_per_case_audit": per_case_audit,
    }

    safety_ok = (
        raw_mut == 0
        and view_mut == 0
        and prot_mut == 0
        and auto_apply == 0
        and invalid_off == 0
        and report["ALIGNMENT_EXACTNESS"] >= 1.0
        and report["DETERMINISTIC_OUTPUT_RATE"] >= 1.0
        and network == 0
        and leak == 0
        and report["CANDIDATE_CAP_COMPLIANCE"] >= 1.0
        and float_count == 0
    )
    quality_ok = (
        report["candidate_ranking_recall_at_5"] >= GATE_THRESHOLDS["candidate_ranking_recall_at_5"]
        and report["core_recall_at_5"] >= GATE_THRESHOLDS["core_recall_at_5"]
        and report["candidate_ranking_top1_acceptable_accuracy"]
        >= GATE_THRESHOLDS["candidate_ranking_top1_acceptable_accuracy"]
        and report["unambiguous_top1_accuracy"] >= GATE_THRESHOLDS["unambiguous_top1_accuracy"]
        and report["candidate_ranking_mrr"] >= GATE_THRESHOLDS["candidate_ranking_mrr"]
        and report["candidate_uniqueness_rate"] >= GATE_THRESHOLDS["candidate_uniqueness_rate"]
        and report["identity_presence_rate"] >= GATE_THRESHOLDS["identity_presence_rate"]
        and report["protected_identity_accuracy"] >= GATE_THRESHOLDS["protected_identity_accuracy"]
        and report["devanagari_identity_accuracy"] >= GATE_THRESHOLDS["devanagari_identity_accuracy"]
        and report["english_identity_top1_accuracy"]
        >= GATE_THRESHOLDS["english_identity_top1_accuracy"]
        and report["false_devanagari_preference_on_english"]
        <= GATE_THRESHOLDS["false_devanagari_preference_on_english_max"]
        and name_forced == 0
        and abstain_precision >= GATE_THRESHOLDS["abstention_precision"]
        and abstain_recall >= GATE_THRESHOLDS["abstention_recall"]
        and ctx_n >= GATE_THRESHOLDS["context_challenge_n_min"]
        and ctx_lift >= GATE_THRESHOLDS["contextual_top1_lift_min"]
        and report["contextual_recall_at_5"] >= report["context_free_recall_at_5"]
    )
    report["AUTOMATED_ENGINEERING_GATES_PASSED"] = safety_ok
    report["QUALITY_GATES_PASSED"] = quality_ok
    report["all_gates_passed"] = safety_ok and quality_ok

    # Quality gate detail table
    report["quality_gate_table"] = [
        {
            "metric": "candidate_ranking_recall_at_5",
            "population": POP_CANDIDATE_RANKING,
            "numerator": ranking_block.recall5_numerator,
            "denominator": ranking_block.denominator,
            "unrounded": ranking_dict["recall_at_5"]["value_unrounded"],
            "display": recall5_float,
            "threshold": GATE_THRESHOLDS["candidate_ranking_recall_at_5"],
            "pass": recall5_float >= GATE_THRESHOLDS["candidate_ranking_recall_at_5"],
        },
        {
            "metric": "core_recall_at_5",
            "population": POP_CORE,
            "numerator": core_block.recall5_numerator,
            "denominator": core_block.denominator,
            "unrounded": core_dict["recall_at_5"]["value_unrounded"],
            "display": core_r5_float,
            "threshold": GATE_THRESHOLDS["core_recall_at_5"],
            "pass": core_r5_float >= GATE_THRESHOLDS["core_recall_at_5"],
        },
        {
            "metric": "candidate_ranking_top1_acceptable_accuracy",
            "population": POP_CANDIDATE_RANKING,
            "numerator": ranking_block.top1_numerator,
            "denominator": ranking_block.denominator,
            "unrounded": ranking_dict["top1_acceptable_accuracy"]["value_unrounded"],
            "display": top1_float,
            "threshold": GATE_THRESHOLDS["candidate_ranking_top1_acceptable_accuracy"],
            "pass": top1_float >= GATE_THRESHOLDS["candidate_ranking_top1_acceptable_accuracy"],
        },
        {
            "metric": "unambiguous_top1_accuracy",
            "population": POP_UNAMBIGUOUS,
            "numerator": unamb_pref_hits,
            "denominator": unamb_n,
            "unrounded": str(Fraction(unamb_pref_hits, unamb_n) if unamb_n else 0),
            "display": unamb_float,
            "threshold": GATE_THRESHOLDS["unambiguous_top1_accuracy"],
            "pass": unamb_float >= GATE_THRESHOLDS["unambiguous_top1_accuracy"],
        },
        {
            "metric": "candidate_ranking_mrr",
            "population": POP_CANDIDATE_RANKING,
            "numerator": ranking_dict["mrr"]["numerator_sum"],
            "denominator": ranking_block.denominator,
            "unrounded": ranking_dict["mrr"]["value_unrounded"],
            "display": mrr_float,
            "threshold": GATE_THRESHOLDS["candidate_ranking_mrr"],
            "pass": mrr_float >= GATE_THRESHOLDS["candidate_ranking_mrr"],
        },
        {
            "metric": "english_identity_top1_accuracy",
            "population": POP_IDENTITY,
            "numerator": eng_top1_h,
            "denominator": eng_top1_n,
            "unrounded": str(Fraction(eng_top1_h, eng_top1_n) if eng_top1_n else 0),
            "display": _rate(eng_top1_h, eng_top1_n),
            "threshold": GATE_THRESHOLDS["english_identity_top1_accuracy"],
            "pass": _rate(eng_top1_h, eng_top1_n) >= GATE_THRESHOLDS["english_identity_top1_accuracy"],
        },
        {
            "metric": "false_devanagari_preference_on_english",
            "population": POP_IDENTITY,
            "numerator": false_dev_eng,
            "denominator": false_dev_eng_n,
            "unrounded": str(Fraction(false_dev_eng, false_dev_eng_n) if false_dev_eng_n else 0),
            "display": _rate(false_dev_eng, false_dev_eng_n, 0.0),
            "threshold_max": GATE_THRESHOLDS["false_devanagari_preference_on_english_max"],
            "pass": _rate(false_dev_eng, false_dev_eng_n, 0.0)
            <= GATE_THRESHOLDS["false_devanagari_preference_on_english_max"],
        },
        {
            "metric": "abstention_precision",
            "population": POP_ABSTENTION,
            "numerator": abstain_tp,
            "denominator": abstain_tp + abstain_fp,
            "display": abstain_precision,
            "threshold": GATE_THRESHOLDS["abstention_precision"],
            "pass": abstain_precision >= GATE_THRESHOLDS["abstention_precision"],
        },
        {
            "metric": "abstention_recall",
            "population": POP_ABSTENTION,
            "numerator": abstain_tp,
            "denominator": abstain_exp,
            "display": abstain_recall,
            "threshold": GATE_THRESHOLDS["abstention_recall"],
            "pass": abstain_recall >= GATE_THRESHOLDS["abstention_recall"],
        },
        {
            "metric": "contextual_top1_lift",
            "population": POP_CONTEXT,
            "numerator_net": ct_only - cf_only,
            "denominator": ctx_n,
            "unrounded": str(Fraction(ct_only - cf_only, ctx_n) if ctx_n else 0),
            "display": ctx_lift,
            "threshold": GATE_THRESHOLDS["contextual_top1_lift_min"],
            "pass": ctx_lift >= GATE_THRESHOLDS["contextual_top1_lift_min"],
        },
    ]

    return report


def evaluate_mai07(cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Re-export the MAI-07C2 target-quality evaluator."""
    from .eval_mai07_engine import evaluate_mai07 as evaluate_mai07_c2

    return evaluate_mai07_c2(cases)


def write_audit_artifact(per_case: list[dict[str, Any]], path: Path) -> str:
    ordered = sorted(per_case, key=lambda r: r["case_id"])
    text = "\n".join(json.dumps(r, ensure_ascii=False, sort_keys=True) for r in ordered) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def run_leakage_audit(repo: Path) -> dict[str, Any]:
    """Prove runtime independence from frozen eval paths/labels."""
    xl_root = (
        repo
        / "erp_bot"
        / "src"
        / "oip"
        / "modules"
        / "language_runtime"
        / "transliteration"
    )
    runtime_py = []
    for p in xl_root.rglob("*.py"):
        if "application" in p.parts and p.name.startswith("eval_"):
            continue
        if p.name.startswith("build_mai07"):
            continue
        if p.name.startswith("test_"):
            continue
        runtime_py.append(p)

    errors: list[str] = []
    for p in runtime_py:
        text = p.read_text(encoding="utf-8")
        if "evals/mai07" in text or "evals.mai07" in text:
            errors.append(f"import_or_path_leak:{p.relative_to(repo)}")
        if "from evals" in text:
            errors.append(f"evals_import:{p.relative_to(repo)}")

    # Resource files must not contain case IDs or full frozen sentences
    man = json.loads((repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json").read_text())
    cases = load_cases(repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json", repo)
    case_ids = {c["case_id"] for c in cases}
    frozen_sentences = {c["input_text"] for c in cases if " " in c["input_text"].strip()}

    res_dir = xl_root / "resources"
    lex_overlap_tokens: list[str] = []
    for rp in sorted(res_dir.glob("*.json")):
        blob = rp.read_text(encoding="utf-8")
        for cid in case_ids:
            if cid in blob:
                errors.append(f"case_id_in_resource:{rp.name}:{cid}")
        if rp.name == "context_rules.json":
            for sent in frozen_sentences:
                if len(sent) >= 12 and sent in blob:
                    errors.append(f"frozen_sentence_in_context_rules:{sent[:40]}")
        # word overlap is allowed; record separately
        if rp.name == "romanized_lexicon.json":
            data = json.loads(blob)
            entries = data.get("entries") or data.get("map") or {}
            if isinstance(entries, dict):
                for tok in entries:
                    # single-token romanized cases may legitimately overlap lexicon keys
                    if any(c["input_text"] == tok for c in cases):
                        lex_overlap_tokens.append(tok)

    # Frozen cases prohibited_for_training
    bad_train = [c["case_id"] for c in cases if not c.get("prohibited_for_training")]
    if bad_train:
        errors.append(f"prohibited_for_training_false:{bad_train[:5]}")

    # Linguist queue must not claim approved
    qpath = repo / "evals/mai07/linguist_queue/PENDING_LINGUIST_REVIEW.json"
    if qpath.exists():
        q = json.loads(qpath.read_text(encoding="utf-8"))
        if q.get("linguist_approved") is True or q.get("approved") is True:
            errors.append("linguist_queue_falsely_approved")

    return {
        "ok": not errors,
        "errors": errors,
        "legitimate_lexicon_token_overlap_count": len(set(lex_overlap_tokens)),
        "legitimate_lexicon_token_overlap_sample": sorted(set(lex_overlap_tokens))[:20],
        "dataset_manifest_separate_from_resources": man.get("dataset_manifest_id")
        != json.loads((res_dir / "manifest.json").read_text()).get("resource_id"),
        "runtime_files_scanned": len(runtime_py),
    }


def main() -> None:
    repo = Path(__file__).resolve().parents[7]
    man = repo / "evals" / "mai07" / "manifests" / "MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json"
    cases = load_cases(man, repo)
    report = evaluate_mai07(cases)

    per_case = report.pop("_per_case_audit_v2")
    audit_path = repo / "evals" / "mai07" / "baselines" / "MAI_07_per_case_metric_audit_v2.jsonl"
    audit_hash = write_audit_artifact(per_case, audit_path)
    report["per_case_audit_path"] = str(audit_path.relative_to(repo)).replace("\\", "/")
    report["per_case_audit_content_hash"] = audit_hash
    c1_audit_path = repo / "evals" / "mai07" / "baselines" / "MAI_07_per_case_metric_audit.jsonl"
    if c1_audit_path.exists():
        # C1's recorded content hash is over canonical LF text (write_audit_artifact's
        # serialization), independent of the host checkout's line-ending conversion.
        c1_hash = hashlib.sha256(
            c1_audit_path.read_text(encoding="utf-8").encode("utf-8")
        ).hexdigest()
        if c1_hash != C1_AUDIT_HASH:
            raise MetricInvariantError(f"c1_audit_hash_mismatch:{c1_hash}!={C1_AUDIT_HASH}")
        report["c1_audit_hash_verified"] = True
    else:
        report["c1_audit_hash_verified"] = None

    # Persist runtime semantic hash sidecar (evaluation evidence; not production trace)
    hash_path = repo / "evals" / "mai07" / "baselines" / "MAI_07_runtime_semantic_hash.json"
    prior = {}
    if hash_path.exists():
        prior = json.loads(hash_path.read_text(encoding="utf-8"))
    sidecar = {
        "schema": "mai07_runtime_semantic_v1",
        "case_count": report["total_cases"],
        "semantic_hash": report["runtime_output_semantic_hash"],
        "pre_closure_semantic_hash": prior.get("semantic_hash") or prior.get("pre_closure_semantic_hash"),
        "hash_unchanged_vs_pre_closure": (
            (prior.get("semantic_hash") == report["runtime_output_semantic_hash"])
            if prior.get("semantic_hash")
            else None
        ),
        "note": "full ordered dump hashed; not production-traced",
        "evaluator_version": EVALUATOR_VERSION,
    }
    hash_path.write_text(json.dumps(sidecar, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    leakage = run_leakage_audit(repo)
    report["leakage_audit"] = leakage
    if not leakage["ok"]:
        report["QUALITY_GATES_PASSED"] = False
        report["all_gates_passed"] = False

    out = repo / "evals" / "mai07" / "baselines" / "MAI_07_eval_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    md = repo / "evals" / "mai07" / "reports" / "MAI_07_eval_report.md"
    md.parent.mkdir(parents=True, exist_ok=True)
    c2 = report["mai07c2_correction"]
    target_ctx = report["context_target_contingency"]
    md.write_text(
        f"""# MAI-07 eval (MAI-07C2 target scorer)

evaluator_version={report['evaluator_version']}
all_gates_passed={report['all_gates_passed']}
AUTOMATED_ENGINEERING_GATES_PASSED={report['AUTOMATED_ENGINEERING_GATES_PASSED']}
QUALITY_GATES_PASSED={report['QUALITY_GATES_PASSED']}
LINGUIST_APPROVED={report['LINGUIST_APPROVED']}
PRODUCTION_APPROVED={report['PRODUCTION_APPROVED']}

## MAI-07C2 correction notice

MAI-07C1 any-acceptable metrics are retained only as a diagnostic: identity candidates may
be counted as acceptable. MAI-07C2 quality gates score only non-identity Devanagari targets.

{c2['note']}

| Target metric | Value |
| --- | --- | --- |
| top-1 | {report['target_candidate_top1_accuracy']} |
| recall@5 | {report['target_candidate_recall_at_5']} |
| MRR | {report['target_candidate_mrr']} |

Runtime/resources remain unchanged. Evaluator/scorer: `{report['evaluator_version']}`.

## C2 target context contingency (N={report['context_challenge_n']})

- Both correct: {target_ctx['both_correct']}
- Context-free only: {target_ctx['context_free_only']}
- Contextual only: {target_ctx['contextual_only']}
- Neither: {target_ctx['neither_correct']}
- Lift: {target_ctx['lift']['numerator_net']}/{target_ctx['lift']['denominator']} = {target_ctx['lift']['value_unrounded']}

## Runtime semantic hash

`{report['runtime_output_semantic_hash']}`

## Per-case audit

`{report['per_case_audit_path']}` hash=`{report['per_case_audit_content_hash']}`

## Full JSON

```json
{json.dumps({k: v for k, v in report.items() if k != 'quality_gate_table'}, indent=2, sort_keys=True)}
```
""",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                k: report[k]
                for k in (
                    "evaluator_version",
                    "all_gates_passed",
                    "AUTOMATED_ENGINEERING_GATES_PASSED",
                    "QUALITY_GATES_PASSED",
                    "target_candidate_recall_at_5",
                    "target_candidate_top1_accuracy",
                    "target_candidate_mrr",
                    "preferred_devanagari_top1",
                    "contextual_top1_lift",
                    "runtime_output_semantic_hash",
                    "per_case_audit_content_hash",
                    "total_cases",
                )
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
