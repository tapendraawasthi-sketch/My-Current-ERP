"""MAI-07C2 versioned evaluation populations (V2 — algorithmically derived)."""

from __future__ import annotations

from typing import Any

from .eval_candidate_types import (
    case_decision_category,
    contains_devanagari,
    project_acceptable_target_surfaces,
)
from .eval_metric_definitions import (
    CANDIDATE_RANKING_SUITE_IDS,
    CONTEXT_EXPECTED_SIZE,
    CORE_SUITE_IDS,
    IDENTITY_SUITE_IDS,
    POP_ABSTENTION,
    POP_CONTEXT,
    POP_CORE_TRANSLITERATION_REQUIRED,
    POP_IDENTITY_REQUIRED,
    POP_TRANSLITERATION_OPTIONAL,
    POP_TRANSLITERATION_REQUIRED,
    POP_UNAMBIGUOUS_TRANSLITERATION,
    POPULATION_SCHEMA_VERSION,
    UNAMBIGUOUS_PREFERRED_SUITES,
)
from .eval_populations import (
    classify_case_populations as classify_case_populations_v1,
)
from .eval_populations import is_unambiguous_romanized, validate_population_totals


def has_transliteration_target(case: dict[str, Any]) -> bool:
    targets = project_acceptable_target_surfaces(
        input_text=case.get("input_text", ""),
        acceptable_candidates=list(case.get("acceptable_candidates") or []),
        preferred_candidate=case.get("preferred_candidate"),
    )
    return len(targets) > 0


def is_unambiguous_transliteration(case: dict[str, Any]) -> bool:
    """Unambiguous cases with preferred/acceptable non-identity Devanagari target."""
    if not has_transliteration_target(case):
        return False
    suite = case.get("suite_id", "")
    preferred = case.get("preferred_candidate")
    raw = case.get("input_text", "")
    if preferred and preferred != raw and contains_devanagari(preferred):
        if suite in UNAMBIGUOUS_PREFERRED_SUITES:
            return True
    # Acceptable-only unambiguous: preferred unset but suite/preferred rule still has targets
    # and old unambiguous preferred!=raw path would have applied if preferred set.
    # Keep deterministic: require preferred Devanagari non-identity in unambiguous suites.
    return False


def preferred_devanagari_case(case: dict[str, Any]) -> bool:
    preferred = case.get("preferred_candidate")
    raw = case.get("input_text", "")
    return bool(preferred and preferred != raw and contains_devanagari(preferred))


def classify_case_populations_v2(case: dict[str, Any]) -> dict[str, Any]:
    """V2 memberships + exclusion reasons. Every case gets at least one membership or reason."""
    suite = case.get("suite_id", "")
    abstention_expected = bool(case.get("abstention_expected"))
    context_flag = bool(case.get("context_challenge")) or suite == "context_challenge_v1"
    targets = project_acceptable_target_surfaces(
        input_text=case.get("input_text", ""),
        acceptable_candidates=list(case.get("acceptable_candidates") or []),
        preferred_candidate=case.get("preferred_candidate"),
    )

    memberships: list[str] = []
    reasons: dict[str, str] = {}
    category = case_decision_category(case)

    if context_flag:
        memberships.append(POP_CONTEXT)
        reasons[POP_CONTEXT] = "frozen_context_challenge"
    else:
        reasons[f"exclude_{POP_CONTEXT}"] = "not_context_challenge"

    if abstention_expected:
        memberships.append(POP_ABSTENTION)
        reasons[POP_ABSTENTION] = "frozen_abstention_expected"
    else:
        reasons[f"exclude_{POP_ABSTENTION}"] = "abstention_expected_false"

    if suite in IDENTITY_SUITE_IDS:
        memberships.append(POP_IDENTITY_REQUIRED)
        reasons[POP_IDENTITY_REQUIRED] = f"suite_id={suite}"
    else:
        reasons[f"exclude_{POP_IDENTITY_REQUIRED}"] = "suite_not_in_identity_required"

    translit_eligible = (
        suite in CANDIDATE_RANKING_SUITE_IDS
        and not abstention_expected
        and not context_flag
        and bool(targets)
    )
    if translit_eligible:
        memberships.append(POP_TRANSLITERATION_REQUIRED)
        reasons[POP_TRANSLITERATION_REQUIRED] = (
            "ranking_suite + nonempty_nonidentity_devanagari_targets "
            "+ not_abstention + not_context"
        )
    else:
        parts: list[str] = []
        if suite not in CANDIDATE_RANKING_SUITE_IDS:
            parts.append("suite_not_ranking_eligible")
        if abstention_expected:
            parts.append("abstention_expected")
        if context_flag:
            parts.append("context_challenge_separate")
        if not targets:
            parts.append("no_acceptable_nonidentity_devanagari_target")
        reasons[f"exclude_{POP_TRANSLITERATION_REQUIRED}"] = ";".join(parts) or "unknown"

    if translit_eligible and suite in CORE_SUITE_IDS:
        memberships.append(POP_CORE_TRANSLITERATION_REQUIRED)
        reasons[POP_CORE_TRANSLITERATION_REQUIRED] = "core_suite ∩ TRANSLITERATION_REQUIRED"
    else:
        reasons[f"exclude_{POP_CORE_TRANSLITERATION_REQUIRED}"] = "not_core_transliteration_required"

    if (
        translit_eligible
        and is_unambiguous_transliteration(case)
        and not abstention_expected
        and not context_flag
    ):
        memberships.append(POP_UNAMBIGUOUS_TRANSLITERATION)
        reasons[POP_UNAMBIGUOUS_TRANSLITERATION] = "unambiguous + nonidentity_devanagari_target"
    else:
        reasons[f"exclude_{POP_UNAMBIGUOUS_TRANSLITERATION}"] = "not_unambiguous_transliteration"

    # Optional/ambiguous: romanized ranking without required targets, names, ambiguous, etc.
    optional = False
    optional_reason = ""
    if not context_flag and not abstention_expected and suite not in IDENTITY_SUITE_IDS:
        if suite in CANDIDATE_RANKING_SUITE_IDS and not targets:
            optional = True
            optional_reason = "ranking_suite_identity_only_or_no_dev_target"
        elif suite in {
            "ambiguous_latin_v1",
            "code_mix_v1",
            "punct_ws_emoji_v1",
            "security_adversarial_v1",
        }:
            optional = True
            optional_reason = f"suite={suite}_optional_or_ambiguous"
        elif suite in CANDIDATE_RANKING_SUITE_IDS and (
            case.get("preferred_candidate") == case.get("input_text")
            or case.get("preferred_candidate") is None
        ):
            # Still may be TRANSLITERATION_REQUIRED if targets exist; optional is additive
            # for cases that are legitimately identity-preferring alongside targets.
            if case.get("preferred_candidate") == case.get("input_text") or (
                case.get("preferred_candidate") is None and suite == "names_entities_v1"
            ):
                optional = True
                optional_reason = "identity_may_legitimately_rank_first_or_name_review"

    if optional:
        memberships.append(POP_TRANSLITERATION_OPTIONAL)
        reasons[POP_TRANSLITERATION_OPTIONAL] = optional_reason
    else:
        reasons[f"exclude_{POP_TRANSLITERATION_OPTIONAL}"] = "not_optional_or_ambiguous_bucket"

    # Ensure every frozen case has at least one V2 membership
    if not memberships:
        memberships.append(POP_TRANSLITERATION_OPTIONAL)
        reasons[POP_TRANSLITERATION_OPTIONAL] = f"fallback_reconcile suite={suite}"

    return {
        "population_schema_version": POPULATION_SCHEMA_VERSION,
        "memberships": memberships,
        "reasons": reasons,
        "decision_category": category,
        "acceptable_target_candidates": targets,
        "acceptable_empty": len(list(case.get("acceptable_candidates") or [])) == 0,
        "has_transliteration_target": bool(targets),
    }


def validate_population_totals_v2(cases: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    ctx_ids: list[str] = []
    uncovered: list[str] = []
    for c in cases:
        cid = c["case_id"]
        if cid in seen:
            errors.append(f"duplicate_case_id:{cid}")
        seen.add(cid)
        pop = classify_case_populations_v2(c)
        if not pop["memberships"]:
            uncovered.append(cid)
        if POP_CONTEXT in pop["memberships"]:
            ctx_ids.append(cid)
        if (
            POP_TRANSLITERATION_REQUIRED in pop["memberships"]
            and not pop["acceptable_target_candidates"]
        ):
            errors.append(f"translit_required_without_targets:{cid}")
    if uncovered:
        errors.append(f"uncovered_cases:{uncovered[:20]}")
    if len(ctx_ids) != CONTEXT_EXPECTED_SIZE:
        errors.append(f"context_population_size:{len(ctx_ids)}!={CONTEXT_EXPECTED_SIZE}")
    if len(seen) != len(cases):
        errors.append("case_count_mismatch_vs_unique_ids")
    # V1 still must reconcile
    errors.extend(validate_population_totals(cases))
    return errors


__all__ = [
    "has_transliteration_target",
    "is_unambiguous_transliteration",
    "preferred_devanagari_case",
    "classify_case_populations_v2",
    "validate_population_totals_v2",
    "classify_case_populations_v1",
    "is_unambiguous_romanized",
]
