"""MAI-07R3M-CLOSURE independent audit set reconciliation.

Does not import canonical set-building helpers from mai07_r3m_tier1_set_reconciliation.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .mai07_r3l_runtime_conformance_diagnostic import DEFAULT_OUT as R3L_OUT
from .mai07_r3m_policy_mismatch_triage import DEFAULT_OUT as R3M_OUT, load_jsonl

EXPECTED_R3L_SEM = "ca134c346414a2d30a448dddabb72287eac809965165a1a037431ee7c3cad6de"
EXPECTED_R3M_SEM = "bd9a9608fe540eb9f10753668df0b99337fee6acf08a15edaa71be6678002b09"


class Mai07R3MAuditSetError(ValueError):
    pass


def _primary(behavior: str, reasons: list[str]) -> str:
    rs = set(reasons)
    if behavior == "ABSTAIN" and "ABSTAIN_FORCE_TRANSLITERATED" in rs:
        return "ABSTAIN_FORCE_TRANSLITERATED"
    if "FALSE_FORCED_DEVANAGARI_TOP1" in rs:
        return "FALSE_FORCED_DEVANAGARI_TOP1"
    if "IDENTITY_NOT_TOP1" in rs:
        return "IDENTITY_NOT_TOP1"
    if "ACRONYM_OR_IDENTIFIER_CORRUPTION" in rs:
        return "ACRONYM_OR_IDENTIFIER_CORRUPTION"
    return f"OTHER_{sorted(reasons)[0]}"


def audit_recompute_sets(
    r3l_root: Path | None = None, r3m_root: Path | None = None
) -> dict[str, Any]:
    r3l = r3l_root or R3L_OUT
    r3m = r3m_root or R3M_OUT

    metrics = json.loads((r3l / "CANONICAL_METRICS.json").read_text(encoding="utf-8"))["metrics"]
    E = set(metrics["identity_top1"]["case_ids_denominator"])
    I = E - set(metrics["identity_top1"]["case_ids_numerator"])
    D = set(metrics["false_devanagari_top1"]["case_ids_numerator"])

    residual = load_jsonl(r3l / "RESIDUAL_RISK_QUEUE.jsonl")
    t1 = [r for r in residual if r.get("residual_tier") == "TIER_1_CRITICAL"]
    T = {r["source_item_id"] for r in t1}
    private = {r["source_item_id"] for r in load_jsonl(r3m / "TIER1_PRIVATE_ASSESSMENT.jsonl")}
    if T != private:
        raise Mai07R3MAuditSetError("tier1_private_mismatch")

    primary: dict[str, str] = {}
    secondary: dict[str, list[str]] = {}
    occ: dict[str, set[str]] = {}
    for r in t1:
        sid = r["source_item_id"]
        reasons = list(r.get("reason_codes") or [])
        p = _primary(r["behavior_class"], reasons)
        primary[sid] = p
        secondary[sid] = sorted(set(reasons) - ({p} if not p.startswith("OTHER_") else {p[6:]}))
        for rc in reasons:
            occ.setdefault(rc, set()).add(sid)

    A = set(occ.get("ABSTAIN_FORCE_TRANSLITERATED", set()))
    D_reason = set(occ.get("FALSE_FORCED_DEVANAGARI_TOP1", set()))
    I_reason = set(occ.get("IDENTITY_NOT_TOP1", set()))
    C = set(occ.get("ACRONYM_OR_IDENTIFIER_CORRUPTION", set()))

    primary_counts: dict[str, int] = {}
    for sid, p in primary.items():
        primary_counts[p] = primary_counts.get(p, 0) + 1
    secondary_counts: dict[str, int] = {}
    for sid, secs in secondary.items():
        for rc in secs:
            secondary_counts[rc] = secondary_counts.get(rc, 0) + 1

    codeq = load_jsonl(r3m / "ACTIONABLE_CODE_CORRECTIVE_QUEUE.jsonl")
    Q = {r["source_item_id"] for r in codeq}

    return {
        "E": sorted(E),
        "I": sorted(I),
        "D": sorted(D),
        "T": sorted(T),
        "A": sorted(A),
        "D_reason": sorted(D_reason),
        "I_reason": sorted(I_reason),
        "C": sorted(C),
        "Q": sorted(Q),
        "cardinalities": {
            "E": len(E),
            "I": len(I),
            "D": len(D),
            "T": len(T),
            "A": len(A),
            "D_reason": len(D_reason),
            "I_reason": len(I_reason),
            "C": len(C),
            "Q": len(Q),
        },
        "D_subset_I": D.issubset(I),
        "primary": dict(sorted(primary.items())),
        "secondary": {k: secondary[k] for k in sorted(secondary)},
        "primary_counts": dict(sorted(primary_counts.items())),
        "secondary_counts": dict(sorted(secondary_counts.items())),
        "intersections": {
            "A_and_D_reason": sorted(A & D_reason),
            "A_and_I_reason": sorted(A & I_reason),
            "D_reason_and_I_reason": sorted(D_reason & I_reason),
        },
        "differences": {
            "D_reason_minus_A": sorted(D_reason - A),
            "A_minus_D_reason": sorted(A - D_reason),
        },
        "union_card": len(A | D_reason | I_reason | C),
        "union_equals_T": (A | D_reason | I_reason | C) == T,
    }


def compare_canonical_audit(canonical: dict[str, Any], audit: dict[str, Any]) -> dict[str, Any]:
    mismatches: list[str] = []

    def chk(label: str, a: Any, b: Any) -> None:
        if a != b:
            mismatches.append(f"{label}:{a!r}!={b!r}")

    chk("T", canonical["T"], audit["T"])
    chk("A", canonical["A"], audit["A"])
    chk("D_reason", canonical["D_reason"], audit["D_reason"])
    chk("I_reason", canonical["I_reason"], audit["I_reason"])
    chk("C", canonical["C"], audit["C"])
    chk("E_card", len(canonical.get("metric_E") or canonical.get("E", [])), audit["cardinalities"]["E"])
    # Accept either nested metrics or flat
    if "I" in canonical:
        chk("I", canonical["I"], audit["I"])
    if "D" in canonical:
        chk("D", canonical["D"], audit["D"])
    chk("primary_counts", canonical["primary_reason_counts"], audit["primary_counts"])
    chk(
        "secondary_counts",
        canonical["secondary_reason_occurrence_counts"],
        audit["secondary_counts"],
    )
    chk(
        "A_and_D",
        canonical["intersections"]["A_and_D_reason"],
        audit["intersections"]["A_and_D_reason"],
    )
    chk(
        "A_and_I",
        canonical["intersections"]["A_and_I_reason"],
        audit["intersections"]["A_and_I_reason"],
    )
    chk(
        "D_and_I",
        canonical["intersections"]["D_reason_and_I_reason"],
        audit["intersections"]["D_reason_and_I_reason"],
    )
    chk("union_equals_T", canonical["union_equals_T"], audit["union_equals_T"])

    can_primary = {m["source_item_id"]: m["primary_reason"] for m in canonical["membership"]}
    chk("primary_assignments", can_primary, audit["primary"])
    can_secondary = {m["source_item_id"]: m["secondary_reasons"] for m in canonical["membership"]}
    chk("secondary_assignments", can_secondary, audit["secondary"])

    if "Q" in canonical:
        chk("Q", canonical["Q"], audit["Q"])

    return {"ok": len(mismatches) == 0, "mismatches": mismatches}


def run_audit_agreement(canonical_tier1: dict[str, Any], metrics: dict[str, Any], code_ids: list[str]) -> dict[str, Any]:
    audit = audit_recompute_sets()
    packed = {
        "T": canonical_tier1["T"],
        "A": canonical_tier1["A"],
        "D_reason": canonical_tier1["D_reason"],
        "I_reason": canonical_tier1["I_reason"],
        "C": canonical_tier1["C"],
        "E": metrics["E"],
        "I": metrics["I"],
        "D": metrics["D"],
        "Q": code_ids,
        "primary_reason_counts": canonical_tier1["primary_reason_counts"],
        "secondary_reason_occurrence_counts": canonical_tier1["secondary_reason_occurrence_counts"],
        "intersections": canonical_tier1["intersections"],
        "differences": canonical_tier1["differences"],
        "union_equals_T": canonical_tier1["union_equals_T"],
        "membership": canonical_tier1["membership"],
    }
    agreement = compare_canonical_audit(packed, audit)
    if not agreement["ok"]:
        raise Mai07R3MAuditSetError(f"canonical_audit_disagree:{agreement['mismatches'][:20]}")
    # Also verify input hashes locally
    r3l_sem = json.loads((R3L_OUT / "SEMANTIC_HASH.json").read_text(encoding="utf-8"))["semantic_hash"]
    r3m_sem = json.loads((R3M_OUT / "SEMANTIC_HASH.json").read_text(encoding="utf-8"))["semantic_hash"]
    if r3l_sem != EXPECTED_R3L_SEM or r3m_sem != EXPECTED_R3M_SEM:
        raise Mai07R3MAuditSetError("input_hash_mismatch")
    return {"ok": True, "agreement": agreement, "audit_cardinalities": audit["cardinalities"]}
