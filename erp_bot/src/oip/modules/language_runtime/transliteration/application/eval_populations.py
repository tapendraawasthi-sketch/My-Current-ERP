"""MAI-07C versioned evaluation populations (predeclared membership; not tuned post-hoc)."""

from __future__ import annotations

from typing import Any

from .eval_metric_definitions import (
    CANDIDATE_RANKING_SUITE_IDS,
    CONTEXT_EXPECTED_SIZE,
    CORE_SUITE_IDS,
    IDENTITY_SUITE_IDS,
    POP_ABSTENTION,
    POP_CANDIDATE_RANKING,
    POP_CONTEXT,
    POP_CORE,
    POP_IDENTITY,
    POP_UNAMBIGUOUS,
    POPULATION_SCHEMA_VERSION,
    UNAMBIGUOUS_IDENTITY_PREF_SUITES,
    UNAMBIGUOUS_PREFERRED_SUITES,
)


def is_unambiguous_romanized(case: dict[str, Any]) -> bool:
    """Predeclared unambiguous membership (frozen rule; independent of scores)."""
    suite = case.get("suite_id", "")
    preferred = case.get("preferred_candidate")
    raw = case.get("input_text", "")
    if preferred is None:
        return False
    if preferred != raw and suite in UNAMBIGUOUS_PREFERRED_SUITES:
        return True
    if preferred == raw and suite in UNAMBIGUOUS_IDENTITY_PREF_SUITES:
        return True
    return False


def classify_case_populations(case: dict[str, Any]) -> dict[str, Any]:
    """Return population memberships and explicit inclusion/exclusion reasons."""
    suite = case.get("suite_id", "")
    acceptable = list(case.get("acceptable_candidates") or [])
    abstention_expected = bool(case.get("abstention_expected"))
    context_flag = bool(case.get("context_challenge")) or suite == "context_challenge_v1"

    memberships: list[str] = []
    reasons: dict[str, str] = {}

    # CONTEXT first (never overlaps ranking metrics for shared top1/MRR/recall gates)
    if context_flag:
        memberships.append(POP_CONTEXT)
        reasons[POP_CONTEXT] = "frozen_context_challenge_flag_or_suite"
    else:
        reasons[f"exclude_{POP_CONTEXT}"] = "not_context_challenge"

    if abstention_expected:
        memberships.append(POP_ABSTENTION)
        reasons[POP_ABSTENTION] = "frozen_abstention_expected"
    else:
        reasons[f"exclude_{POP_ABSTENTION}"] = "abstention_expected_false"

    if suite in IDENTITY_SUITE_IDS:
        memberships.append(POP_IDENTITY)
        reasons[POP_IDENTITY] = f"suite_id={suite}"
    else:
        reasons[f"exclude_{POP_IDENTITY}"] = "suite_not_in_identity_set"

    ranking_eligible_suite = suite in CANDIDATE_RANKING_SUITE_IDS
    if ranking_eligible_suite and acceptable and not abstention_expected and not context_flag:
        memberships.append(POP_CANDIDATE_RANKING)
        reasons[POP_CANDIDATE_RANKING] = (
            "nonempty_acceptable + ranking_suite + not_abstention + not_context_challenge"
        )
    else:
        parts: list[str] = []
        if not ranking_eligible_suite:
            parts.append("suite_not_in_candidate_ranking_set")
        if not acceptable:
            parts.append("empty_acceptable_set")
        if abstention_expected:
            parts.append("abstention_expected")
        if context_flag:
            parts.append("context_challenge_separate_population")
        reasons[f"exclude_{POP_CANDIDATE_RANKING}"] = ";".join(parts) or "unknown"

    if suite in CORE_SUITE_IDS and acceptable and not abstention_expected and not context_flag:
        memberships.append(POP_CORE)
        reasons[POP_CORE] = "core_suite + nonempty_acceptable + not_abstention + not_context"
    else:
        reasons[f"exclude_{POP_CORE}"] = "not_core_ranking_member"

    if is_unambiguous_romanized(case) and POP_CANDIDATE_RANKING in memberships:
        memberships.append(POP_UNAMBIGUOUS)
        reasons[POP_UNAMBIGUOUS] = "predeclared_unambiguous_rule"
    else:
        reasons[f"exclude_{POP_UNAMBIGUOUS}"] = "not_unambiguous_or_not_ranking"

    return {
        "population_schema_version": POPULATION_SCHEMA_VERSION,
        "memberships": memberships,
        "reasons": reasons,
        "acceptable_empty": len(acceptable) == 0,
    }


def validate_population_totals(cases: list[dict[str, Any]]) -> list[str]:
    """Fail-fast population integrity checks (before scoring)."""
    errors: list[str] = []
    seen: set[str] = set()
    dupes: list[str] = []
    ctx_ids: list[str] = []
    for c in cases:
        cid = c["case_id"]
        if cid in seen:
            dupes.append(cid)
        seen.add(cid)
        pop = classify_case_populations(c)
        if POP_CONTEXT in pop["memberships"]:
            ctx_ids.append(cid)
        if pop["acceptable_empty"] and c.get("suite_id") in CANDIDATE_RANKING_SUITE_IDS:
            # empty acceptable must never silently enter ranking
            if POP_CANDIDATE_RANKING in pop["memberships"]:
                errors.append(f"empty_acceptable_in_ranking:{cid}")
    if dupes:
        errors.append(f"duplicate_case_ids:{sorted(set(dupes))[:20]}")
    if len(ctx_ids) != CONTEXT_EXPECTED_SIZE:
        errors.append(f"context_population_size:{len(ctx_ids)}!={CONTEXT_EXPECTED_SIZE}")
    if len(ctx_ids) != len(set(ctx_ids)):
        errors.append("context_population_duplicate_ids")
    return errors


__all__ = [
    "classify_case_populations",
    "is_unambiguous_romanized",
    "validate_population_totals",
]
