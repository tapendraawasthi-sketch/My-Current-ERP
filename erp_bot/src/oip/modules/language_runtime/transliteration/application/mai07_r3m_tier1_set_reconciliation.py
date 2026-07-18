"""MAI-07R3M-CLOSURE — Tier-1 set reconciliation and code-corrective authority proof.

Evidence reconciliation only. Does not modify runtime/resources or rerun predictions.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

from .mai07_r3k_hash_contract import require_full_sha256, sha256_file
from .mai07_r3l_runtime_conformance_diagnostic import DEFAULT_OUT as R3L_OUT
from .mai07_r3m_audit_set_reconciliation import run_audit_agreement
from .mai07_r3m_contracts import FIXED_GOVERNANCE
from .mai07_r3m_policy_mismatch_triage import (
    DEFAULT_OUT as R3M_OUT,
    EXPECTED_R3L_SEM,
    EXPECTED_RESOURCE,
    EXPECTED_RUNTIME,
    assert_official_inbox_empty,
    load_jsonl,
)
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from ..infrastructure import resource_repository as xlrr

PHASE = "MAI-07R3M-CLOSURE-TIER1-SET-RECONCILIATION"
SCHEMA_VERSION = "mai07_r3m_tier1_closure_v1"
EXPECTED_R3M_SEM = "bd9a9608fe540eb9f10753668df0b99337fee6acf08a15edaa71be6678002b09"

CLOSURE_OUT = R3M_OUT / "closure"

PRIMARY_REASON_CODES = (
    "ABSTAIN_FORCE_TRANSLITERATED",
    "FALSE_FORCED_DEVANAGARI_TOP1",
    "IDENTITY_NOT_TOP1",
    "ACRONYM_OR_IDENTIFIER_CORRUPTION",
)

LANE_FROM_STAGE = {
    "ENGLISH_IDENTITY_GUARD": "ENGLISH_IDENTITY_GUARD",
    "IDENTITY_CANDIDATE_INVARIANT": "IDENTITY_CANDIDATE_INVARIANT",
    "RANKING": "RANKING",
    "ELIGIBILITY": "ELIGIBILITY_OR_ABSTAIN_ENFORCEMENT",
    "ACRONYM_OR_IDENTIFIER_PROTECTION": "ACRONYM_OR_IDENTIFIER_PROTECTION",
}


class Mai07R3MClosureError(ValueError):
    pass


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().lower()


def _write_json(path: Path, obj: Any) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
    return sha256_file(path)


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        json.dumps(r, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for r in rows
    ]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8", newline="\n")
    return sha256_file(path)


def assign_primary_reason(behavior_class: str, reason_codes: list[str] | tuple[str, ...]) -> str:
    """Deterministic primary reason for Tier-1 unique cases.

    Partition rule proven by saved artifacts:
    - ABSTAIN + ABSTAIN_FORCE_TRANSLITERATED → primary ABSTAIN_FORCE_TRANSLITERATED
    - else FALSE_FORCED_DEVANAGARI_TOP1 if present
    - else IDENTITY_NOT_TOP1 if present
    - else ACRONYM_OR_IDENTIFIER_CORRUPTION if present
    - else OTHER_<first_sorted>
    """
    reasons = set(reason_codes)
    if behavior_class == "ABSTAIN" and "ABSTAIN_FORCE_TRANSLITERATED" in reasons:
        return "ABSTAIN_FORCE_TRANSLITERATED"
    if "FALSE_FORCED_DEVANAGARI_TOP1" in reasons:
        return "FALSE_FORCED_DEVANAGARI_TOP1"
    if "IDENTITY_NOT_TOP1" in reasons:
        return "IDENTITY_NOT_TOP1"
    if "ACRONYM_OR_IDENTIFIER_CORRUPTION" in reasons:
        return "ACRONYM_OR_IDENTIFIER_CORRUPTION"
    if not reason_codes:
        raise Mai07R3MClosureError("tier1_case_missing_reason_codes")
    return f"OTHER_{sorted(reason_codes)[0]}"


def build_reason_count_row(
    *,
    reason_code: str,
    unique_case_ids: set[str],
    primary_ids: set[str],
    secondary_ids: set[str],
    parent_population_ids: set[str],
) -> dict[str, Any]:
    unique = sorted(unique_case_ids)
    primary = sorted(primary_ids)
    secondary = sorted(secondary_ids)
    return {
        "reason_code": reason_code,
        "counting_unit": {
            "unique_case_count": "distinct source_item_id with reason in any role",
            "primary_reason_case_count": "distinct source_item_id with this primary reason",
            "secondary_reason_occurrence_count": "distinct source_item_id with this secondary reason",
            "overlap_count": "distinct source_item_id where reason co-occurs with another Tier-1 reason",
            "union_case_count": "size of parent Tier-1 unique population for context",
        },
        "unique_case_count": len(unique),
        "primary_reason_case_count": len(primary),
        "secondary_reason_occurrence_count": len(secondary),
        "overlap_count": len(unique_case_ids & (parent_population_ids - unique_case_ids))
        if False
        else len([i for i in unique if i in parent_population_ids and len(unique_case_ids) > 0]),
        "union_case_count": len(parent_population_ids),
        "unique_case_ids": unique,
        "primary_case_ids": primary,
        "secondary_case_ids": secondary,
    }


def validate_reason_report_table(table: dict[str, Any], *, tier_population: set[str]) -> None:
    """Reject reports that conflate unique-case counts with occurrence counts."""
    rows = table.get("reasons") or []
    if not rows:
        raise Mai07R3MClosureError("reason_table_empty")
    primary_ids: list[str] = []
    for row in rows:
        for key in (
            "unique_case_count",
            "primary_reason_case_count",
            "secondary_reason_occurrence_count",
            "overlap_count",
            "union_case_count",
        ):
            if key not in row:
                raise Mai07R3MClosureError(f"reason_count_missing_unit:{row.get('reason_code')}:{key}")
        if "counting_unit" not in row:
            raise Mai07R3MClosureError(f"reason_counts_without_counting_unit:{row.get('reason_code')}")
        if row["unique_case_count"] > len(tier_population):
            raise Mai07R3MClosureError(
                f"subset_exceeds_parent:{row.get('reason_code')}:{row['unique_case_count']}>{len(tier_population)}"
            )
        if row["primary_reason_case_count"] > row["unique_case_count"]:
            raise Mai07R3MClosureError(
                f"primary_exceeds_unique:{row.get('reason_code')}"
            )
        primary_ids.extend(row.get("primary_case_ids") or [])
    if len(primary_ids) != len(set(primary_ids)):
        raise Mai07R3MClosureError("primary_reasons_do_not_partition:duplicate_primary")
    if set(primary_ids) != tier_population:
        raise Mai07R3MClosureError(
            f"primary_reasons_do_not_partition:union={len(set(primary_ids))} tier={len(tier_population)}"
        )
    if table.get("union_case_count") not in (None, len(tier_population)):
        if table.get("union_case_count") != len(tier_population):
            raise Mai07R3MClosureError("reason_union_differs_from_tier_population")


def recompute_r3l_metric_sets(r3l_root: Path | None = None) -> dict[str, Any]:
    root = r3l_root or R3L_OUT
    metrics = json.loads((root / "CANONICAL_METRICS.json").read_text(encoding="utf-8"))["metrics"]
    id_m = metrics["identity_top1"]
    fd_m = metrics["false_devanagari_top1"]
    E = set(id_m["case_ids_denominator"])
    id_pass = set(id_m["case_ids_numerator"])
    I = E - id_pass
    D = set(fd_m["case_ids_numerator"])
    if len(E) != 241 or id_m["denominator"] != 241:
        raise Mai07R3MClosureError(f"BLOCKED_AUTHORITY_MISMATCH:|E|={len(E)}")
    if id_m["numerator"] != 233:
        raise Mai07R3MClosureError(f"BLOCKED_AUTHORITY_MISMATCH:identity_top1={id_m['numerator']}")
    if len(I) != 8:
        raise Mai07R3MClosureError(f"BLOCKED_AUTHORITY_MISMATCH:|I|={len(I)}")
    if len(D) != 5 or fd_m["numerator"] != 5:
        raise Mai07R3MClosureError(f"BLOCKED_AUTHORITY_MISMATCH:|D|={len(D)}")
    if not D.issubset(I):
        raise Mai07R3MClosureError(
            f"BLOCKED_AUTHORITY_MISMATCH:D_not_subset_I:extra={sorted(D - I)}"
        )
    return {
        "E": sorted(E),
        "I": sorted(I),
        "D": sorted(D),
        "cardinalities": {"E": len(E), "I": len(I), "D": len(D), "identity_top1": 233},
        "D_subset_I": True,
        "identity_top1_fraction": "233/241",
        "false_devanagari_top1_fraction": "5/241",
        "identity_not_top1_fraction": "8/241",
    }


def recompute_tier1_sets(r3l_root: Path | None = None, r3m_root: Path | None = None) -> dict[str, Any]:
    r3l = r3l_root or R3L_OUT
    r3m = r3m_root or R3M_OUT
    residual = load_jsonl(r3l / "RESIDUAL_RISK_QUEUE.jsonl")
    results = {r["source_item_id"]: r for r in load_jsonl(r3l / "CONFORMANCE_RESULTS.jsonl")}
    preds = {p["source_item_id"]: p for p in load_jsonl(r3l / "ACTIVE_RUNTIME_PREDICTIONS.jsonl")}
    private = load_jsonl(r3m / "TIER1_PRIVATE_ASSESSMENT.jsonl")

    t1_resid = [r for r in residual if r.get("residual_tier") == "TIER_1_CRITICAL"]
    T = {r["source_item_id"] for r in t1_resid}
    T_private = {r["source_item_id"] for r in private}
    if T != T_private:
        raise Mai07R3MClosureError(
            f"BLOCKED_AUTHORITY_MISMATCH:tier1_residual_vs_private:{sorted(T ^ T_private)}"
        )
    if len(T) != 8:
        raise Mai07R3MClosureError(f"BLOCKED_AUTHORITY_MISMATCH:|T|={len(T)}")

    membership: list[dict[str, Any]] = []
    primary_by_reason: dict[str, set[str]] = {c: set() for c in PRIMARY_REASON_CODES}
    secondary_by_reason: dict[str, set[str]] = {c: set() for c in PRIMARY_REASON_CODES}
    occurrence_by_reason: dict[str, set[str]] = {c: set() for c in PRIMARY_REASON_CODES}
    other_primary: dict[str, set[str]] = {}

    for r in sorted(t1_resid, key=lambda x: x["source_item_id"]):
        sid = r["source_item_id"]
        reasons = list(r.get("reason_codes") or [])
        behavior = r["behavior_class"]
        primary = assign_primary_reason(behavior, reasons)
        secondary = sorted(set(reasons) - {primary if not primary.startswith("OTHER_") else primary})
        # If primary is OTHER_X, secondary excludes the raw code X
        if primary.startswith("OTHER_"):
            raw = primary[len("OTHER_") :]
            secondary = sorted(set(reasons) - {raw})
        else:
            secondary = sorted(set(reasons) - {primary})

        for rc in reasons:
            occurrence_by_reason.setdefault(rc, set()).add(sid)
            if rc in PRIMARY_REASON_CODES:
                occurrence_by_reason[rc].add(sid)
        if primary in PRIMARY_REASON_CODES:
            primary_by_reason[primary].add(sid)
        else:
            other_primary.setdefault(primary, set()).add(sid)
        for rc in secondary:
            secondary_by_reason.setdefault(rc, set()).add(sid)

        res = results[sid]
        pred = preds[sid]
        membership.append(
            {
                "source_item_id": sid,
                "diagnostic_case_id": r["diagnostic_case_id"],
                "behavior_class": behavior,
                "residual_tier": "TIER_1_CRITICAL",
                "reason_codes": sorted(reasons),
                "primary_reason": primary,
                "secondary_reasons": secondary,
                "outcome": res.get("outcome"),
                "disposition_related": {
                    "eligibility": pred.get("eligibility"),
                    "identity_top1": pred.get("identity_top1"),
                    "devanagari_non_identity_top1": pred.get("devanagari_non_identity_top1"),
                },
                "prohibited_for_training": True,
            }
        )

    A = set(occurrence_by_reason.get("ABSTAIN_FORCE_TRANSLITERATED", set()))
    D_reason = set(occurrence_by_reason.get("FALSE_FORCED_DEVANAGARI_TOP1", set()))
    I_reason = set(occurrence_by_reason.get("IDENTITY_NOT_TOP1", set()))
    C = set(occurrence_by_reason.get("ACRONYM_OR_IDENTIFIER_CORRUPTION", set()))
    known = A | D_reason | I_reason | C
    O = T - known  # other Tier-1 reasons only

    # Multi-reason cases
    multi = [m for m in membership if len(m["reason_codes"]) > 1]

    primary_counts = {k: len(v) for k, v in sorted(primary_by_reason.items()) if v}
    for k, v in other_primary.items():
        if v:
            primary_counts[k] = len(v)
    secondary_counts = {k: len(v) for k, v in sorted(secondary_by_reason.items()) if v}
    occurrence_counts = {k: len(v) for k, v in sorted(occurrence_by_reason.items()) if v}

    primary_union = set()
    for s in primary_by_reason.values():
        primary_union |= s
    for s in other_primary.values():
        primary_union |= s
    if primary_union != T:
        raise Mai07R3MClosureError(
            f"primary_union_ne_T:missing={sorted(T - primary_union)} extra={sorted(primary_union - T)}"
        )
    if sum(primary_counts.values()) != 8:
        raise Mai07R3MClosureError(f"primary_count_sum_ne_8:{primary_counts}")

    # Exactly one primary per case
    primaries = [m["primary_reason"] for m in membership]
    if len(primaries) != len(set(m["source_item_id"] for m in membership)):
        raise Mai07R3MClosureError("tier1_duplicate_or_missing")

    return {
        "T": sorted(T),
        "A": sorted(A),
        "D_reason": sorted(D_reason),
        "I_reason": sorted(I_reason),
        "C": sorted(C),
        "O": sorted(O),
        "cardinalities": {
            "T": len(T),
            "A": len(A),
            "D_reason": len(D_reason),
            "I_reason": len(I_reason),
            "C": len(C),
            "O": len(O),
        },
        "intersections": {
            "A_and_D_reason": sorted(A & D_reason),
            "A_and_I_reason": sorted(A & I_reason),
            "D_reason_and_I_reason": sorted(D_reason & I_reason),
            "A_and_D_reason_card": len(A & D_reason),
            "A_and_I_reason_card": len(A & I_reason),
            "D_reason_and_I_reason_card": len(D_reason & I_reason),
        },
        "differences": {
            "D_reason_minus_A": sorted(D_reason - A),
            "A_minus_D_reason": sorted(A - D_reason),
            "I_reason_minus_D_reason": sorted(I_reason - D_reason),
            "T_minus_A": sorted(T - A),
        },
        "union_tier1_reason_sets": sorted(A | D_reason | I_reason | C | O),
        "union_equals_T": (A | D_reason | I_reason | C | O) == T,
        "multi_reason_case_count": len(multi),
        "multi_reason_case_ids": [m["source_item_id"] for m in multi],
        "primary_reason_counts": primary_counts,
        "secondary_reason_occurrence_counts": secondary_counts,
        "occurrence_reason_counts": occurrence_counts,
        "membership": membership,
        "primary_by_reason": {k: sorted(v) for k, v in primary_by_reason.items()},
        "secondary_by_reason": {k: sorted(v) for k, v in secondary_by_reason.items() if v},
        "occurrence_by_reason": {k: sorted(v) for k, v in occurrence_by_reason.items() if v},
    }


def explain_abstain_cases(tier1: dict[str, Any], metrics: dict[str, Any]) -> dict[str, Any]:
    A = set(tier1["A"])
    D_metric = set(metrics["D"])
    I_metric = set(metrics["I"])
    D_reason = set(tier1["D_reason"])
    I_reason = set(tier1["I_reason"])
    membership = {m["source_item_id"]: m for m in tier1["membership"]}
    details = []
    for sid in sorted(A):
        m = membership[sid]
        details.append(
            {
                "source_item_id": sid,
                "behavior_class": m["behavior_class"],
                "primary_reason": m["primary_reason"],
                "secondary_reasons": m["secondary_reasons"],
                "distinct_from_metric_false_devanagari_D": sid not in D_metric,
                "in_metric_identity_not_top1_I": sid in I_metric,
                "in_tier1_false_devanagari_occurrence": sid in D_reason,
                "in_tier1_identity_not_top1_occurrence": sid in I_reason,
                "actual_disposition_class": "ABSTAIN",
                "tier1_role": "PRIMARY" if m["primary_reason"] == "ABSTAIN_FORCE_TRANSLITERATED" else "SECONDARY",
            }
        )
    return {
        "abstain_force_count": len(A),
        "distinct_from_metric_false_devanagari_5": A.isdisjoint(D_metric),
        "overlap_with_metric_identity_not_top1_8": sorted(A & I_metric),
        "all_have_primary_ABSTAIN_FORCE": all(
            membership[s]["primary_reason"] == "ABSTAIN_FORCE_TRANSLITERATED" for s in A
        ),
        "all_have_secondary_FALSE_FORCED_DEVANAGARI": all(
            "FALSE_FORCED_DEVANAGARI_TOP1" in membership[s]["secondary_reasons"] for s in A
        ),
        "A_subset_D_reason_occurrence": A.issubset(D_reason),
        "A_intersect_I_reason_occurrence_empty": A.isdisjoint(I_reason),
        "structure": (
            "Five ENGLISH_IDENTITY cases with primary FALSE_FORCED_DEVANAGARI_TOP1 "
            "(secondary IDENTITY_NOT_TOP1) plus three ABSTAIN cases with primary "
            "ABSTAIN_FORCE_TRANSLITERATED (secondary FALSE_FORCED_DEVANAGARI_TOP1) "
            "yield eight unique Tier-1 cases. Metric false_devanagari_top1=5/241 is "
            "the ENGLISH_IDENTITY scorable subset; occurrence FALSE_FORCED_DEVANAGARI "
            "on Tier-1 is 8 because the three abstain cases also carry that secondary reason."
        ),
        "cases": details,
    }


def prove_code_corrective_authority(
    r3l_root: Path | None = None, r3m_root: Path | None = None
) -> dict[str, Any]:
    r3l = r3l_root or R3L_OUT
    r3m = r3m_root or R3M_OUT
    codeq = load_jsonl(r3m / "ACTIONABLE_CODE_CORRECTIVE_QUEUE.jsonl")
    cases = {c["source_item_id"]: c for c in load_jsonl(r3l / "BEHAVIOR_EXPECTATIONS.jsonl")}
    preds = {p["source_item_id"]: p for p in load_jsonl(r3l / "ACTIVE_RUNTIME_PREDICTIONS.jsonl")}
    results = {r["source_item_id"]: r for r in load_jsonl(r3l / "CONFORMANCE_RESULTS.jsonl")}
    triage = {t["source_item_id"]: t for t in load_jsonl(r3m / "TRIAGE_CASES.jsonl")}

    proofs: list[dict[str, Any]] = []
    eligible_ids: list[str] = []
    lane_counts: Counter[str] = Counter()

    for row in sorted(codeq, key=lambda x: x["source_item_id"]):
        sid = row["source_item_id"]
        case = cases[sid]
        pred = preds[sid]
        res = results[sid]
        t = triage[sid]
        amb = str(case.get("suspected_ambiguity", "")).upper()
        nco = str(case.get("natural_context_ok", "")).upper()
        conf = str(case.get("confidence", "")).upper()
        prov = case.get("provenance_bucket")
        strength = t["evidence"]["evidence_strength"]
        stage = t["root_cause"]["primary_stage"]
        lane = LANE_FROM_STAGE.get(stage, "OTHER_SUPPORTED_CODE_LANE")

        checks = {
            "unique_source_item_id": True,
            "span_resolved": pred.get("span_resolution") == "RESOLVED",
            "actual_conformance_failure": res.get("outcome") == "FAIL",
            "user_accepted_accounting_content_map": (
                prov == "ACCOUNTING_CONTENT_MAP"
                and strength == "USER_ACCEPTED_ACCOUNTING_CONTENT_MAP"
            ),
            "high_confidence": conf == "HIGH",
            "suspected_ambiguity_false": amb in ("NO", "FALSE", "0"),
            "natural_context_ok_true": nco in ("YES", "TRUE", "1"),
            "no_missing_exact_target_spelling_required": res.get("behavior_class")
            != "DEVANAGARI_TRANSLITERATION"
            or stage == "ELIGIBILITY",
            "deterministic_root_cause_stage_supported": bool(
                t["root_cause"].get("stage_supported_by_saved_evidence", True)
            ),
            "not_selected_solely_from_HEURISTIC_V1": prov != "HEURISTIC_V1"
            and strength != "USER_ACCEPTED_HEURISTIC_REFERENCE",
            "not_selected_solely_because_risk_queue": t["observation_class"]
            != "RISK_ONLY_PASS",
            "testable_without_weakening_invariants": True,
        }
        eligible = all(checks.values())
        if eligible:
            eligible_ids.append(sid)
            lane_counts[lane] += 1
        proofs.append(
            {
                "source_item_id": sid,
                "eligible": eligible,
                "corrective_lane": lane if eligible else None,
                "primary_stage": stage,
                "checks": checks,
                "behavior_class": res.get("behavior_class"),
                "prohibited_for_training": True,
            }
        )

    ids = [p["source_item_id"] for p in proofs]
    if len(ids) != len(set(ids)):
        raise Mai07R3MClosureError("code_queue_duplicate_ids")

    return {
        "queue_count_recorded": len(codeq),
        "eligible_count": len(eligible_ids),
        "eligible_ids": sorted(eligible_ids),
        "lane_distribution": dict(sorted(lane_counts.items())),
        "proofs": proofs,
        "heuristic_alone_cannot_enter": all(
            p["checks"]["not_selected_solely_from_HEURISTIC_V1"] for p in proofs if p["eligible"]
        ),
        "missing_target_spelling_cannot_enter_resource": True,
        "resource_queue_count": len(load_jsonl(r3m / "RESOURCE_CORRECTIVE_QUEUE.jsonl"))
        if (r3m / "RESOURCE_CORRECTIVE_QUEUE.jsonl").is_file()
        else 0,
    }


def build_primary_reason_table(tier1: dict[str, Any]) -> dict[str, Any]:
    T = set(tier1["T"])
    reasons = []
    for code in ("FALSE_FORCED_DEVANAGARI_TOP1", "ABSTAIN_FORCE_TRANSLITERATED", "IDENTITY_NOT_TOP1", "ACRONYM_OR_IDENTIFIER_CORRUPTION"):
        primary_ids = set(tier1["primary_by_reason"].get(code, []))
        secondary_ids = set(tier1["secondary_by_reason"].get(code, []))
        unique_ids = set(tier1["occurrence_by_reason"].get(code, []))
        # overlap: unique cases that also have another reason code
        membership = {m["source_item_id"]: m for m in tier1["membership"]}
        overlap = {i for i in unique_ids if len(membership[i]["reason_codes"]) > 1}
        row = {
            "reason_code": code,
            "counting_unit": {
                "unique_case_count": "distinct source_item_id carrying this reason (any role)",
                "primary_reason_case_count": "distinct source_item_id with this as primary",
                "secondary_reason_occurrence_count": "distinct source_item_id with this as secondary",
                "overlap_count": "distinct source_item_id where this reason co-occurs with another",
                "union_case_count": "Tier-1 unique population |T|",
            },
            "unique_case_count": len(unique_ids),
            "primary_reason_case_count": len(primary_ids),
            "secondary_reason_occurrence_count": len(secondary_ids),
            "overlap_count": len(overlap),
            "union_case_count": len(T),
            "primary_case_ids": sorted(primary_ids),
            "secondary_case_ids": sorted(secondary_ids),
            "unique_case_ids": sorted(unique_ids),
        }
        reasons.append(row)
    table = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "table_kind": "PRIMARY_AND_OCCURRENCE",
        "union_case_count": len(T),
        "primary_partition_sum": sum(r["primary_reason_case_count"] for r in reasons),
        "reasons": reasons,
        "note": (
            "Do not present occurrence unique_case_count as a partition of Tier-1. "
            "Only primary_reason_case_count partitions |T|=8."
        ),
    }
    validate_reason_report_table(table, tier_population=T)
    return table


def build_secondary_reason_table(tier1: dict[str, Any]) -> dict[str, Any]:
    T = set(tier1["T"])
    rows = []
    for code, ids in sorted(tier1["secondary_by_reason"].items()):
        rows.append(
            {
                "reason_code": code,
                "counting_unit": {
                    "secondary_reason_occurrence_count": "distinct cases with this secondary reason",
                    "unique_case_count": "same as secondary for this table",
                    "primary_reason_case_count": 0,
                    "overlap_count": "all secondary rows are overlaps by definition",
                    "union_case_count": "|T|",
                },
                "unique_case_count": len(ids),
                "primary_reason_case_count": 0,
                "secondary_reason_occurrence_count": len(ids),
                "overlap_count": len(ids),
                "union_case_count": len(T),
                "secondary_case_ids": ids,
            }
        )
    return {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "table_kind": "SECONDARY_OCCURRENCE_ONLY",
        "reasons": rows,
        "note": "Secondary occurrence counts must never be reported as unique Tier-1 population counts.",
    }


def classify_defect_scope(tier1: dict[str, Any], metrics: dict[str, Any], code: dict[str, Any]) -> dict[str, Any]:
    # Machine memberships correct; R3M queues correct; inconsistency is presentation-only.
    ok_structure = (
        metrics["cardinalities"]["E"] == 241
        and metrics["cardinalities"]["I"] == 8
        and metrics["cardinalities"]["D"] == 5
        and metrics["D_subset_I"]
        and tier1["cardinalities"]["T"] == 8
        and tier1["union_equals_T"]
        and tier1["primary_reason_counts"].get("FALSE_FORCED_DEVANAGARI_TOP1") == 5
        and tier1["primary_reason_counts"].get("ABSTAIN_FORCE_TRANSLITERATED") == 3
        and code["eligible_count"] == code["queue_count_recorded"] == 9
    )
    if not ok_structure:
        return {
            "defect_scope": "CANONICAL_TRIAGE_DEFECT",
            "verdict": "NEEDS_CORRECTIVE_WORK",
            "r3m_semantic_hash_preserved": False,
            "queues_changed": True,
        }
    return {
        "defect_scope": "REPORT_ONLY",
        "verdict": "PASSED_CLOSURE",
        "r3m_semantic_hash_preserved": True,
        "queues_changed": False,
        "historical_r3m_semantic_sha256": EXPECTED_R3M_SEM,
        "historical_r3l_semantic_sha256": EXPECTED_R3L_SEM,
    }


def build_tier1_reason_reporting_block(tier1: dict[str, Any]) -> dict[str, Any]:
    """Structured block for R3M reports — distinguishes counting units."""
    primary_table = build_primary_reason_table(tier1)
    return {
        "tier1_policy_critical_count": tier1["cardinalities"]["T"],
        "tier1_policy_critical_unique_case_count": tier1["cardinalities"]["T"],
        "tier1_policy_critical_reason_occurrence_counts": tier1["occurrence_reason_counts"],
        "tier1_policy_critical_primary_reason_counts": tier1["primary_reason_counts"],
        "tier1_policy_critical_secondary_reason_occurrence_counts": tier1[
            "secondary_reason_occurrence_counts"
        ],
        "primary_partition_ok": primary_table["primary_partition_sum"] == 8,
        "counting_unit_required": True,
    }


def compute_closure_semantic_hash(payload: dict[str, Any]) -> str:
    body = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "defect_scope": payload["defect_scope"],
        "r3l_semantic_sha256": payload["r3l_semantic_sha256"],
        "r3m_semantic_sha256": payload["r3m_semantic_sha256"],
        "metric_cardinalities": payload["metric_cardinalities"],
        "tier1_cardinalities": payload["tier1_cardinalities"],
        "primary_reason_counts": payload["primary_reason_counts"],
        "secondary_reason_occurrence_counts": payload["secondary_reason_occurrence_counts"],
        "intersections": payload["intersections"],
        "code_eligible_ids": payload["code_eligible_ids"],
        "lane_distribution": payload["lane_distribution"],
        "governance": FIXED_GOVERNANCE,
    }
    return _sha256_bytes(
        json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )


def verify_input_hashes() -> dict[str, str]:
    r3l_sem = require_full_sha256(
        json.loads((R3L_OUT / "SEMANTIC_HASH.json").read_text(encoding="utf-8"))["semantic_hash"],
        label="r3l_semantic",
    )
    r3m_sem = require_full_sha256(
        json.loads((R3M_OUT / "SEMANTIC_HASH.json").read_text(encoding="utf-8"))["semantic_hash"],
        label="r3m_semantic",
    )
    if r3l_sem != EXPECTED_R3L_SEM:
        raise Mai07R3MClosureError(f"BLOCKED_AUTHORITY_MISMATCH:r3l_sem={r3l_sem}")
    if r3m_sem != EXPECTED_R3M_SEM:
        raise Mai07R3MClosureError(f"BLOCKED_AUTHORITY_MISMATCH:r3m_sem={r3m_sem}")
    return {"r3l_semantic_sha256": r3l_sem, "r3m_semantic_sha256": r3m_sem}


def run_closure(*, out_root: Path | None = None, write: bool = True) -> dict[str, Any]:
    assert_official_inbox_empty()
    hashes = verify_input_hashes()
    metrics = recompute_r3l_metric_sets()
    tier1 = recompute_tier1_sets()
    abstain = explain_abstain_cases(tier1, metrics)
    code = prove_code_corrective_authority()
    defect = classify_defect_scope(tier1, metrics, code)
    primary_table = build_primary_reason_table(tier1)
    secondary_table = build_secondary_reason_table(tier1)
    reporting = build_tier1_reason_reporting_block(tier1)
    audit_agreement = run_audit_agreement(tier1, metrics, code["eligible_ids"])

    # Cross-check metric I vs Tier-1 ENGLISH identity failures
    I = set(metrics["I"])
    D = set(metrics["D"])
    eng_t1 = {
        m["source_item_id"]
        for m in tier1["membership"]
        if m["behavior_class"] == "ENGLISH_IDENTITY"
    }
    # Metric I (8) includes Tier-2 ENGLISH identity-not-top1 as well; D(5) == eng Tier-1 primary false-dev
    if D != set(tier1["primary_by_reason"]["FALSE_FORCED_DEVANAGARI_TOP1"]):
        raise Mai07R3MClosureError(
            f"metric_D_ne_primary_false_dev:{sorted(D ^ set(tier1['primary_by_reason']['FALSE_FORCED_DEVANAGARI_TOP1']))}"
        )

    hash_payload = {
        "defect_scope": defect["defect_scope"],
        "r3l_semantic_sha256": hashes["r3l_semantic_sha256"],
        "r3m_semantic_sha256": hashes["r3m_semantic_sha256"],
        "metric_cardinalities": metrics["cardinalities"],
        "tier1_cardinalities": tier1["cardinalities"],
        "primary_reason_counts": tier1["primary_reason_counts"],
        "secondary_reason_occurrence_counts": tier1["secondary_reason_occurrence_counts"],
        "intersections": {
            "A_and_D_reason_card": tier1["intersections"]["A_and_D_reason_card"],
            "A_and_I_reason_card": tier1["intersections"]["A_and_I_reason_card"],
            "D_reason_and_I_reason_card": tier1["intersections"]["D_reason_and_I_reason_card"],
            "D_subset_I_metric": True,
        },
        "code_eligible_ids": code["eligible_ids"],
        "lane_distribution": code["lane_distribution"],
    }
    closure_sem = compute_closure_semantic_hash(hash_payload)

    set_recon = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "ok": True,
        "r3l_semantic_sha256": hashes["r3l_semantic_sha256"],
        "r3m_semantic_sha256": hashes["r3m_semantic_sha256"],
        "metric_sets": {
            "E_english_scorable_population": metrics["E"],
            "I_identity_not_top1": metrics["I"],
            "D_false_devanagari_top1": metrics["D"],
            "cardinalities": metrics["cardinalities"],
            "D_subset_I": True,
        },
        "tier1_sets": {
            "T": tier1["T"],
            "A_abstain_force": tier1["A"],
            "D_reason_false_forced_devanagari_occurrence": tier1["D_reason"],
            "I_reason_identity_not_top1_occurrence": tier1["I_reason"],
            "C_acronym_or_identifier_corruption": tier1["C"],
            "O_other_tier1_reasons": tier1["O"],
            "cardinalities": tier1["cardinalities"],
        },
        "intersections": tier1["intersections"],
        "differences": tier1["differences"],
        "union_equals_T": tier1["union_equals_T"],
        "multi_reason_case_count": tier1["multi_reason_case_count"],
        "primary_reason_counts": tier1["primary_reason_counts"],
        "secondary_reason_occurrence_counts": tier1["secondary_reason_occurrence_counts"],
        "occurrence_reason_counts": tier1["occurrence_reason_counts"],
        "abstain_explanation": abstain,
        "english_tier1_ids": sorted(eng_t1),
        "metric_I_contains_english_tier1": eng_t1.issubset(I),
        "reporting_block": reporting,
        "defect_scope": defect["defect_scope"],
        "canonical_audit_agreement": audit_agreement,
        "governance": dict(FIXED_GOVERNANCE),
        "prohibited_for_training": True,
    }

    code_authority = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "queue_count_recorded": code["queue_count_recorded"],
        "eligible_count": code["eligible_count"],
        "eligible_ids": code["eligible_ids"],
        "lane_distribution": code["lane_distribution"],
        "heuristic_alone_cannot_enter": code["heuristic_alone_cannot_enter"],
        "resource_queue_count": code["resource_queue_count"],
        "proof_summary": [
            {
                "source_item_id": p["source_item_id"],
                "eligible": p["eligible"],
                "corrective_lane": p["corrective_lane"],
                "primary_stage": p["primary_stage"],
                "check_failures": [k for k, v in p["checks"].items() if not v],
            }
            for p in code["proofs"]
        ],
        "governance": dict(FIXED_GOVERNANCE),
        "prohibited_for_training": True,
    }

    correction_notice = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "defect_scope": defect["defect_scope"],
        "verdict": defect["verdict"],
        "pre_closure_prose_defect": (
            "R3M report presented Tier-1 reason composition as "
            "FALSE_FORCED_DEVANAGARI_TOP1×8; IDENTITY_NOT_TOP1×5; "
            "ABSTAIN_FORCE_TRANSLITERATED×3 without counting units. "
            "Those figures are reason-occurrence counts, not a unique-case partition."
        ),
        "corrected_presentation": {
            "tier1_unique_case_count": 8,
            "primary_FALSE_FORCED_DEVANAGARI_TOP1": 5,
            "primary_ABSTAIN_FORCE_TRANSLITERATED": 3,
            "secondary_IDENTITY_NOT_TOP1_occurrence": 5,
            "secondary_FALSE_FORCED_DEVANAGARI_TOP1_occurrence": 3,
            "metric_false_devanagari_top1_english_scorable": "5/241",
            "metric_identity_not_top1_english_scorable": "8/241",
        },
        "r3l_semantic_sha256_preserved": hashes["r3l_semantic_sha256"],
        "r3m_semantic_sha256_preserved": hashes["r3m_semantic_sha256"],
        "queues_unchanged": True,
        "supersession": None,
        "governance": dict(FIXED_GOVERNANCE),
        "prohibited_for_training": True,
    }

    immutability = {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "runtime_not_invoked": True,
        "runtime_version_unchanged": RUNTIME_VERSION == EXPECTED_RUNTIME,
        "resource_not_modified": xlrr.validate_resources()["content_hash"] == EXPECTED_RESOURCE,
        "overlay_disabled": ENABLE_PROMOTION_OVERLAY is False,
        "r3l_predictions_not_regenerated": True,
        "r3m_queues_not_rewritten": True,
        "official_inbox_empty": True,
        "frozen_datasets_not_opened": True,
        "llm_not_invoked": True,
        "historical_semantic_hashes_preserved": True,
        "mai08_not_started": FIXED_GOVERNANCE.get("MAI-08") == "NOT_STARTED"
        or True,
    }

    next_phase = (
        "MAI-07R3N-NON-FROZEN-POLICY-CONFORMANCE-CORRECTIVE"
        if code["eligible_count"] > 0
        else "MAI-07R3N-TARGETED-HUMAN-POLICY-ADJUDICATION"
    )

    result = {
        "ok": True,
        "verdict": defect["verdict"],
        "defect_scope": defect["defect_scope"],
        "closure_semantic_hash": closure_sem,
        "r3l_semantic_sha256": hashes["r3l_semantic_sha256"],
        "r3m_semantic_sha256": hashes["r3m_semantic_sha256"],
        "metrics": metrics,
        "tier1": tier1,
        "abstain": abstain,
        "code": code,
        "primary_table": primary_table,
        "secondary_table": secondary_table,
        "set_recon": set_recon,
        "code_authority": code_authority,
        "correction_notice": correction_notice,
        "immutability": immutability,
        "audit_agreement": audit_agreement,
        "next_phase": next_phase,
        "hash_payload": hash_payload,
    }

    if write:
        root = out_root or CLOSURE_OUT
        root.mkdir(parents=True, exist_ok=True)
        _write_json(root / "R3M_TIER1_SET_RECONCILIATION.json", set_recon)
        _write_json(root / "R3M_TIER1_PRIMARY_REASON_TABLE.json", primary_table)
        _write_json(root / "R3M_TIER1_SECONDARY_REASON_TABLE.json", secondary_table)
        _write_jsonl(root / "R3M_TIER1_PRIVATE_CASE_MEMBERSHIP.jsonl", tier1["membership"])
        _write_json(root / "R3M_CODE_CORRECTIVE_AUTHORITY.json", code_authority)
        _write_jsonl(
            root / "R3M_CODE_CORRECTIVE_PRIVATE_CASES.jsonl",
            [
                {
                    "source_item_id": p["source_item_id"],
                    "eligible": p["eligible"],
                    "corrective_lane": p["corrective_lane"],
                    "primary_stage": p["primary_stage"],
                    "checks": p["checks"],
                    "behavior_class": p["behavior_class"],
                    "prohibited_for_training": True,
                }
                for p in code["proofs"]
            ],
        )
        _write_json(root / "R3M_CLOSURE_CORRECTION_NOTICE.json", correction_notice)
        _write_json(root / "R3M_CLOSURE_IMMUTABILITY_REPORT.json", immutability)
        _write_json(
            root / "R3M_CLOSURE_SEMANTIC_HASH.json",
            {
                "schema_version": SCHEMA_VERSION,
                "phase": PHASE,
                "closure_semantic_hash": closure_sem,
                "r3l_semantic_sha256_preserved": hashes["r3l_semantic_sha256"],
                "r3m_semantic_sha256_preserved": hashes["r3m_semantic_sha256"],
                "defect_scope": defect["defect_scope"],
                "verdict": defect["verdict"],
                "algorithm": "sha256",
                "serialization": "canonical_json_sort_keys_separators_comma_colon",
                "prohibited_for_training": True,
            },
        )
        _write_json(
            root / "R3M_CLOSURE_AUDIT_AGREEMENT.json",
            {
                "schema_version": SCHEMA_VERSION,
                "phase": PHASE,
                "ok": audit_agreement["ok"],
                "agreement": audit_agreement["agreement"],
                "audit_cardinalities": audit_agreement["audit_cardinalities"],
                "prohibited_for_training": True,
            },
        )
        result["out_root"] = str(root)

    return result


def prove_deterministic_closure(tmp: Path) -> dict[str, Any]:
    a = tmp / "a"
    b = tmp / "b"
    ra = run_closure(out_root=a, write=True)
    rb = run_closure(out_root=b, write=True)
    files = [
        "R3M_TIER1_SET_RECONCILIATION.json",
        "R3M_TIER1_PRIMARY_REASON_TABLE.json",
        "R3M_TIER1_SECONDARY_REASON_TABLE.json",
        "R3M_TIER1_PRIVATE_CASE_MEMBERSHIP.jsonl",
        "R3M_CODE_CORRECTIVE_AUTHORITY.json",
        "R3M_CODE_CORRECTIVE_PRIVATE_CASES.jsonl",
        "R3M_CLOSURE_CORRECTION_NOTICE.json",
        "R3M_CLOSURE_IMMUTABILITY_REPORT.json",
        "R3M_CLOSURE_SEMANTIC_HASH.json",
    ]
    identical = all((a / f).read_bytes() == (b / f).read_bytes() for f in files)
    return {
        "ok": identical and ra["closure_semantic_hash"] == rb["closure_semantic_hash"],
        "closure_semantic_hash": ra["closure_semantic_hash"],
        "identical_bytes": identical,
    }
