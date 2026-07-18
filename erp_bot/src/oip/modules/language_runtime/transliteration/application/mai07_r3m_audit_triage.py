"""MAI-07R3M independent audit triage classifier.

Clean-room reimplementation. MUST NOT import mai07_r3m_canonical_triage.
"""

from __future__ import annotations

from typing import Any

# Intentionally do not import mai07_r3m_canonical_triage.

PHASE = "MAI-07R3M-AI-ASSISTED-POLICY-MISMATCH-TRIAGE"
SCHEMA_VERSION = "mai07_r3m_policy_mismatch_triage_v1"
AUDIT_CLASSIFIER_ID = "mai07_r3m_audit_triage_classifier"

_GOV = {
    "independent_human_review": False,
    "professional_linguist_adjudication": False,
    "linguist_approved": False,
    "production_approved": False,
    "quality_gates_passed": False,
    "official_round_a_lock_eligible": False,
    "round_a_locked": False,
    "round_b_authorized": False,
    "round_b_ready": False,
    "frozen_v3_quality_gate_authorized": False,
    "majority_voting_is_gold": False,
    "agreement_is_independent_human_irr": False,
    "runtime_conformance_is_language_quality": False,
    "prohibited_for_training": True,
    "MAI-07": "NEEDS_CORRECTIVE_WORK",
    "MAI-08": "NOT_STARTED",
}


def _strength(case: dict[str, Any], outcome: str, span_resolution: str | None) -> str:
    if outcome == "SPAN_FAILURE" or span_resolution in ("SPAN_NOT_FOUND", "SPAN_AMBIGUOUS"):
        return "SPAN_UNRESOLVED"
    conf = str(case.get("confidence", "")).upper()
    amb = str(case.get("suspected_ambiguity", "")).upper() in ("YES", "TRUE", "1")
    if amb:
        return "AMBIGUOUS_REFERENCE"
    if conf == "LOW":
        return "LOW_CONFIDENCE_REFERENCE"
    bc = case.get("behavior", {}).get("behavior_class") or case.get("behavior_class")
    if bc == "DEVANAGARI_TRANSLITERATION":
        if case.get("provenance_bucket") == "HEURISTIC_V1":
            return "USER_ACCEPTED_HEURISTIC_REFERENCE"
        return "INSUFFICIENT_LINGUISTIC_EVIDENCE"
    if case.get("provenance_bucket") == "ACCOUNTING_CONTENT_MAP":
        nco = str(case.get("natural_context_ok", "")).upper()
        if conf == "HIGH" and nco in ("YES", "TRUE", "1") and not amb:
            return "USER_ACCEPTED_ACCOUNTING_CONTENT_MAP"
        if conf in ("MEDIUM", "HIGH"):
            return "USER_ACCEPTED_ACCOUNTING_CONTENT_MAP"
        return "LOW_CONFIDENCE_REFERENCE"
    if case.get("provenance_bucket") == "HEURISTIC_V1":
        return "USER_ACCEPTED_HEURISTIC_REFERENCE"
    return "INSUFFICIENT_LINGUISTIC_EVIDENCE"


def _stage_fail(behavior: str, residual_reasons: list[str], pred: dict[str, Any]) -> tuple[str, list[str], bool]:
    elig_u = str(pred.get("eligibility") or "").upper()
    id_pres = bool(pred.get("identity_present"))
    id_top1 = bool(pred.get("identity_top1"))
    id_ret = bool(pred.get("identity_retained_at_5"))
    dev_top1 = bool(pred.get("devanagari_non_identity_top1"))
    dev_at5 = bool(pred.get("devanagari_non_identity_present_at_5"))
    reasons = set(residual_reasons)

    if behavior == "ENGLISH_IDENTITY":
        if not id_pres:
            return "IDENTITY_CANDIDATE_INVARIANT", ["IDENTITY_ABSENT"], True
        if "FALSE_FORCED_DEVANAGARI_TOP1" in reasons or (dev_top1 and not id_top1):
            return "ENGLISH_IDENTITY_GUARD", ["IDENTITY_PRESENT_DEVANAGARI_TOP1"], True
        if id_pres and not id_top1:
            return "RANKING", ["IDENTITY_PRESENT_NOT_TOP1"], True
        return "UNKNOWN", ["ENGLISH_IDENTITY_UNCLASSIFIED"], False

    if behavior == "DEVANAGARI_TRANSLITERATION":
        if not elig_u:
            return "INSUFFICIENT_OBSERVATION_EVIDENCE", ["ELIGIBILITY_MISSING"], False
        if elig_u in ("IDENTITY_ONLY", "ABSTAIN", "SKIPPED_PROTECTED", "SKIPPED_UNSUPPORTED", "SKIPPED_SECURITY"):
            return "ELIGIBILITY", [f"ELIGIBILITY_{elig_u}", "NO_DEVANAGARI_GENERATION"], True
        if elig_u == "GENERATE" and not dev_at5:
            return "DEVANAGARI_GENERATOR_COVERAGE", ["GENERATE_NO_DEVANAGARI_CANDIDATE"], True
        if elig_u == "GENERATE" and dev_at5 and not dev_top1:
            return "RANKING", ["DEVANAGARI_PRESENT_NOT_TOP1_NON_GOLD"], True
        return "INSUFFICIENT_OBSERVATION_EVIDENCE", ["DEVANAGARI_STAGE_UNCLEAR"], False

    if behavior == "IDENTITY_FIRST":
        if not id_pres:
            return "IDENTITY_CANDIDATE_INVARIANT", ["IDENTITY_ABSENT"], True
        if not id_top1:
            return "RANKING", ["IDENTITY_PRESENT_NOT_TOP1"], True
        return "UNKNOWN", ["IDENTITY_FIRST_UNCLASSIFIED"], False

    if behavior == "OPTIONAL":
        if not id_ret:
            return "OPTIONAL_POLICY", ["OPTIONAL_IDENTITY_MISSING"], True
        return "OPTIONAL_POLICY", ["OPTIONAL_UNEXPECTED_FAIL"], False

    if behavior == "ACRONYM":
        return "ACRONYM_OR_IDENTIFIER_PROTECTION", ["ACRONYM_IDENTITY_CORRUPTION_OR_NOT_TOP1"], True

    if behavior == "CONTEXT_DEPENDENT":
        if "CONTEXT_IDENTITY_MISSING" in reasons or not id_ret:
            return "CONTEXT_REVIEW_SIGNAL", ["CONTEXT_IDENTITY_MISSING"], True
        if "CONTEXT_NO_DIVERSITY_OR_REVIEW_SIGNAL" in reasons:
            return "CONTEXT_REVIEW_SIGNAL", ["CONTEXT_NO_DIVERSITY_OR_REVIEW"], True
        return "CONTEXT_REVIEW_SIGNAL", ["CONTEXT_FAIL"], False

    if behavior == "ABSTAIN":
        if "ABSTAIN_FORCE_TRANSLITERATED" in reasons or (dev_top1 and not id_top1):
            return "ELIGIBILITY", ["ABSTAIN_FORCED_REWRITE"], True
        return "ELIGIBILITY", ["ABSTAIN_FAIL"], False

    if behavior == "PROTECTED_OR_IDENTIFIER":
        if not id_pres:
            return "IDENTITY_CANDIDATE_INVARIANT", ["PROTECTED_IDENTITY_ABSENT"], True
        if not id_top1 or "FALSE_FORCED_DEVANAGARI_TOP1" in reasons:
            return "ACRONYM_OR_IDENTIFIER_PROTECTION", ["PROTECTED_NOT_IDENTITY_TOP1"], True
        if "IDENTITY_NOT_RETAINED_AT_5" in reasons:
            return "IDENTITY_CANDIDATE_INVARIANT", ["PROTECTED_IDENTITY_NOT_RETAINED"], True
        return "ACRONYM_OR_IDENTIFIER_PROTECTION", ["PROTECTED_FAIL"], True

    return "UNKNOWN", ["UNKNOWN_BEHAVIOR_FAIL"], False


def _action(obs: str, stage: str, strength: str, behavior: str, supported: bool) -> str:
    if obs == "SPAN_FAILURE":
        return "BLOCKED_MISSING_EVIDENCE"
    if obs == "RISK_ONLY_PASS":
        return "NO_CORRECTIVE_ACTION_RISK_ONLY"
    if obs in ("UNSUPPORTED", "NOT_APPLICABLE"):
        return "BLOCKED_MISSING_EVIDENCE"
    if not supported or stage in ("UNKNOWN", "INSUFFICIENT_OBSERVATION_EVIDENCE"):
        return "BLOCKED_MISSING_EVIDENCE"
    if strength in ("AMBIGUOUS_REFERENCE", "LOW_CONFIDENCE_REFERENCE"):
        return "TARGETED_HUMAN_REVIEW_REQUIRED"
    if behavior == "DEVANAGARI_TRANSLITERATION":
        if stage == "ELIGIBILITY" and strength == "USER_ACCEPTED_ACCOUNTING_CONTENT_MAP":
            return "CODE_CORRECTIVE_CANDIDATE"
        if stage == "DEVANAGARI_GENERATOR_COVERAGE":
            return "NON_FROZEN_TEST_CANDIDATE"
        return "PROFESSIONAL_LINGUIST_REVIEW_REQUIRED"
    if strength == "USER_ACCEPTED_HEURISTIC_REFERENCE":
        if stage in ("ENGLISH_IDENTITY_GUARD", "ACRONYM_OR_IDENTIFIER_PROTECTION", "IDENTITY_CANDIDATE_INVARIANT"):
            return "NON_FROZEN_TEST_CANDIDATE"
        return "TARGETED_HUMAN_REVIEW_REQUIRED"
    if strength == "USER_ACCEPTED_ACCOUNTING_CONTENT_MAP":
        if stage in (
            "ENGLISH_IDENTITY_GUARD",
            "ACRONYM_OR_IDENTIFIER_PROTECTION",
            "IDENTITY_CANDIDATE_INVARIANT",
            "ELIGIBILITY",
            "RANKING",
        ):
            return "CODE_CORRECTIVE_CANDIDATE"
        if stage in ("CONTEXT_REVIEW_SIGNAL", "OPTIONAL_POLICY"):
            return "POLICY_CLARIFICATION_REQUIRED"
        return "NON_FROZEN_TEST_CANDIDATE"
    if strength == "INSUFFICIENT_LINGUISTIC_EVIDENCE":
        return "PROFESSIONAL_LINGUIST_REVIEW_REQUIRED"
    return "POLICY_CLARIFICATION_REQUIRED"


def classify_case_audit(
    residual: dict[str, Any],
    result: dict[str, Any],
    pred: dict[str, Any],
    case: dict[str, Any],
) -> dict[str, Any]:
    outcome = result["outcome"]
    behavior = result["behavior_class"]
    residual_reasons = list(result.get("residual_reasons") or residual.get("reason_codes") or ())
    span_res = pred.get("span_resolution")
    strength = _strength(case, outcome, span_res)
    secondary = sorted(set(residual.get("reason_codes") or ()) - set(residual_reasons))

    if outcome == "SPAN_FAILURE":
        obs, stage, supported, rationale = "SPAN_FAILURE", "SPAN_RESOLUTION", True, ["SPAN_UNRESOLVED_NO_FIRST_MATCH"]
    elif outcome == "PASS":
        obs, stage, supported = "RISK_ONLY_PASS", "EVIDENCE_OR_POLICY_REFERENCE", True
        rationale = sorted(set(residual.get("reason_codes") or residual_reasons)) or ["RISK_ONLY"]
    elif outcome == "UNSUPPORTED":
        obs, stage, supported, rationale = (
            "UNSUPPORTED",
            "EVIDENCE_OR_POLICY_REFERENCE",
            True,
            ["UNSUPPORTED_DISPOSITION"],
        )
    elif outcome == "FAIL":
        obs = "ACTUAL_CONFORMANCE_FAILURE"
        stage, rationale, supported = _stage_fail(behavior, residual_reasons, pred)
    else:
        obs, stage, supported, rationale = (
            "NOT_APPLICABLE",
            "INSUFFICIENT_OBSERVATION_EVIDENCE",
            False,
            ["UNEXPECTED_OUTCOME"],
        )

    action = _action(obs, stage, strength, behavior, supported)
    if action == "RESOURCE_CORRECTIVE_CANDIDATE":
        action = "PROFESSIONAL_LINGUIST_REVIEW_REQUIRED"

    return {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "source_item_id": residual["source_item_id"],
        "diagnostic_case_id": residual["diagnostic_case_id"],
        "observation_class": obs,
        "root_cause": {
            "primary_stage": stage,
            "secondary_stages": [],
            "stage_supported_by_saved_evidence": supported,
            "rationale_codes": list(rationale),
        },
        "action_disposition": action,
        "evidence": {
            "evidence_strength": strength,
            "provenance_bucket": case.get("provenance_bucket") or result.get("provenance_bucket") or "",
            "confidence": str(case.get("confidence", "")),
            "natural_context_ok": str(case.get("natural_context_ok", "")),
            "suspected_ambiguity": str(case.get("suspected_ambiguity", "")),
            "residual_tier": str(residual.get("residual_tier") or result.get("residual_tier") or ""),
            "residual_reasons": list(residual_reasons),
            "outcome": outcome,
            "behavior_class": behavior,
            "review_disposition": str(result.get("review_disposition") or case.get("review_disposition") or ""),
        },
        "secondary_reason_codes": secondary,
        "eligibility": pred.get("eligibility"),
        "identity_present": pred.get("identity_present"),
        "identity_top1": pred.get("identity_top1"),
        "identity_retained_at_5": pred.get("identity_retained_at_5"),
        "devanagari_non_identity_present_at_5": pred.get("devanagari_non_identity_present_at_5"),
        "devanagari_non_identity_top1": pred.get("devanagari_non_identity_top1"),
        "review_required": pred.get("review_required"),
        "span_resolution": span_res,
        "prohibited_for_training": True,
        "governance": dict(_GOV),
    }


def classify_all_audit(
    residuals: list[dict[str, Any]],
    results_by_id: dict[str, dict[str, Any]],
    preds_by_id: dict[str, dict[str, Any]],
    cases_by_id: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    return [
        classify_case_audit(r, results_by_id[r["source_item_id"]], preds_by_id[r["source_item_id"]], cases_by_id[r["source_item_id"]])
        for r in sorted(residuals, key=lambda x: x["source_item_id"])
    ]


def compare_triage(canonical_rows: list[dict[str, Any]], audit_rows: list[dict[str, Any]]) -> dict[str, Any]:
    mismatches: list[str] = []
    if len(canonical_rows) != len(audit_rows):
        return {"ok": False, "mismatch_count": 1, "mismatches": ["length"], "phase": PHASE}
    a_by = {r["source_item_id"]: r for r in canonical_rows}
    b_by = {r["source_item_id"]: r for r in audit_rows}
    if set(a_by) != set(b_by):
        mismatches.append("case_id_set")
    fields = (
        "observation_class",
        "action_disposition",
    )
    for sid in sorted(set(a_by) & set(b_by)):
        a, b = a_by[sid], b_by[sid]
        for f in fields:
            if a.get(f) != b.get(f):
                mismatches.append(f"{sid}.{f}")
        if a["root_cause"]["primary_stage"] != b["root_cause"]["primary_stage"]:
            mismatches.append(f"{sid}.primary_stage")
        if a["evidence"]["evidence_strength"] != b["evidence"]["evidence_strength"]:
            mismatches.append(f"{sid}.evidence_strength")
    return {
        "schema_version": SCHEMA_VERSION,
        "phase": PHASE,
        "ok": len(mismatches) == 0,
        "mismatch_count": len(mismatches),
        "mismatches": mismatches[:80],
        "prohibited_for_training": True,
    }
