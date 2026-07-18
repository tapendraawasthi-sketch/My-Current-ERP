"""MAI-07R3M canonical triage classifier — saved R3L evidence only.

Does not invoke the transliteration runtime. Does not invent Devanagari targets.
"""

from __future__ import annotations

from typing import Any

from .mai07_r3m_contracts import (
    FIXED_GOVERNANCE,
    PHASE,
    SCHEMA_VERSION,
    ActionDisposition,
    EvidenceStrength,
    MismatchTriageCaseV1,
    ObservationClass,
    RootCauseAssessmentV1,
    RootCauseStage,
    TriageEvidenceV1,
)

CANONICAL_CLASSIFIER_ID = "mai07_r3m_canonical_triage_classifier"


def _evidence_strength(case: dict[str, Any], outcome: str, span_resolution: str | None) -> EvidenceStrength:
    if outcome == "SPAN_FAILURE" or (span_resolution in ("SPAN_NOT_FOUND", "SPAN_AMBIGUOUS")):
        return "SPAN_UNRESOLVED"
    conf = str(case.get("confidence", "")).upper()
    amb = str(case.get("suspected_ambiguity", "")).upper() in ("YES", "TRUE", "1")
    if amb:
        return "AMBIGUOUS_REFERENCE"
    if conf == "LOW":
        return "LOW_CONFIDENCE_REFERENCE"
    # Devanagari behavior never has exact target → insufficient linguistic for resource edits
    bc = case.get("behavior", {}).get("behavior_class") or case.get("behavior_class")
    if bc == "DEVANAGARI_TRANSLITERATION":
        # engineering stage still assignable; strength for resource edits is insufficient
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


def _root_cause_for_failure(
    *,
    behavior: str,
    residual_reasons: list[str],
    pred: dict[str, Any],
) -> tuple[RootCauseStage, tuple[str, ...], bool]:
    """Return (stage, rationale_codes, supported)."""
    elig = (pred.get("eligibility") or "") or ""
    elig_u = elig.upper()
    id_pres = bool(pred.get("identity_present"))
    id_top1 = bool(pred.get("identity_top1"))
    id_ret = bool(pred.get("identity_retained_at_5"))
    dev_top1 = bool(pred.get("devanagari_non_identity_top1"))
    dev_at5 = bool(pred.get("devanagari_non_identity_present_at_5"))
    reasons = set(residual_reasons)

    if behavior == "ENGLISH_IDENTITY":
        if not id_pres:
            return "IDENTITY_CANDIDATE_INVARIANT", ("IDENTITY_ABSENT",), True
        if "FALSE_FORCED_DEVANAGARI_TOP1" in reasons or (dev_top1 and not id_top1):
            return "ENGLISH_IDENTITY_GUARD", ("IDENTITY_PRESENT_DEVANAGARI_TOP1",), True
        if id_pres and not id_top1:
            return "RANKING", ("IDENTITY_PRESENT_NOT_TOP1",), True
        return "UNKNOWN", ("ENGLISH_IDENTITY_UNCLASSIFIED",), False

    if behavior == "DEVANAGARI_TRANSLITERATION":
        if "ABSTAIN" in elig_u or elig_u in ("", "NONE"):
            if not elig:
                return "INSUFFICIENT_OBSERVATION_EVIDENCE", ("ELIGIBILITY_MISSING",), False
        if elig_u in ("IDENTITY_ONLY", "ABSTAIN", "SKIPPED_PROTECTED", "SKIPPED_UNSUPPORTED", "SKIPPED_SECURITY"):
            return "ELIGIBILITY", (f"ELIGIBILITY_{elig_u}", "NO_DEVANAGARI_GENERATION"), True
        if elig_u == "GENERATE" and not dev_at5:
            return "DEVANAGARI_GENERATOR_COVERAGE", ("GENERATE_NO_DEVANAGARI_CANDIDATE",), True
        if elig_u == "GENERATE" and dev_at5 and not dev_top1:
            # policy does not require top-1 for Devanagari script presence
            return "RANKING", ("DEVANAGARI_PRESENT_NOT_TOP1_NON_GOLD",), True
        return "INSUFFICIENT_OBSERVATION_EVIDENCE", ("DEVANAGARI_STAGE_UNCLEAR",), False

    if behavior == "IDENTITY_FIRST":
        if not id_pres:
            return "IDENTITY_CANDIDATE_INVARIANT", ("IDENTITY_ABSENT",), True
        if not id_top1:
            return "RANKING", ("IDENTITY_PRESENT_NOT_TOP1",), True
        return "UNKNOWN", ("IDENTITY_FIRST_UNCLASSIFIED",), False

    if behavior == "OPTIONAL":
        if not id_ret:
            return "OPTIONAL_POLICY", ("OPTIONAL_IDENTITY_MISSING",), True
        return "OPTIONAL_POLICY", ("OPTIONAL_UNEXPECTED_FAIL",), False

    if behavior == "ACRONYM":
        if not id_top1 or "FALSE_FORCED_DEVANAGARI_TOP1" in reasons:
            return "ACRONYM_OR_IDENTIFIER_PROTECTION", ("ACRONYM_IDENTITY_CORRUPTION_OR_NOT_TOP1",), True
        return "ACRONYM_OR_IDENTIFIER_PROTECTION", ("ACRONYM_FAIL",), True

    if behavior == "CONTEXT_DEPENDENT":
        if "CONTEXT_IDENTITY_MISSING" in reasons or not id_ret:
            return "CONTEXT_REVIEW_SIGNAL", ("CONTEXT_IDENTITY_MISSING",), True
        if "CONTEXT_NO_DIVERSITY_OR_REVIEW_SIGNAL" in reasons:
            rev = pred.get("review_required")
            if rev is None:
                return "CAPABILITY_NOT_IMPLEMENTED" if False else "CONTEXT_REVIEW_SIGNAL", (
                    "CONTEXT_NO_DIVERSITY_OR_REVIEW",
                ), True
            return "CONTEXT_REVIEW_SIGNAL", ("CONTEXT_NO_DIVERSITY_OR_REVIEW",), True
        return "CONTEXT_REVIEW_SIGNAL", ("CONTEXT_FAIL",), False

    if behavior == "ABSTAIN":
        if "ABSTAIN_FORCE_TRANSLITERATED" in reasons or (dev_top1 and not id_top1):
            return "ELIGIBILITY", ("ABSTAIN_FORCED_REWRITE",), True
        return "ELIGIBILITY", ("ABSTAIN_FAIL",), False

    if behavior == "PROTECTED_OR_IDENTIFIER":
        if not id_pres:
            return "IDENTITY_CANDIDATE_INVARIANT", ("PROTECTED_IDENTITY_ABSENT",), True
        if not id_top1 or "FALSE_FORCED_DEVANAGARI_TOP1" in reasons:
            return "ACRONYM_OR_IDENTIFIER_PROTECTION", ("PROTECTED_NOT_IDENTITY_TOP1",), True
        if "IDENTITY_NOT_RETAINED_AT_5" in reasons:
            return "IDENTITY_CANDIDATE_INVARIANT", ("PROTECTED_IDENTITY_NOT_RETAINED",), True
        return "ACRONYM_OR_IDENTIFIER_PROTECTION", ("PROTECTED_FAIL",), True

    return "UNKNOWN", ("UNKNOWN_BEHAVIOR_FAIL",), False


def _action_for(
    *,
    obs: ObservationClass,
    stage: RootCauseStage,
    strength: EvidenceStrength,
    behavior: str,
    supported: bool,
) -> ActionDisposition:
    if obs == "SPAN_FAILURE":
        return "BLOCKED_MISSING_EVIDENCE"
    if obs == "RISK_ONLY_PASS":
        return "NO_CORRECTIVE_ACTION_RISK_ONLY"
    if obs in ("UNSUPPORTED", "NOT_APPLICABLE"):
        return "BLOCKED_MISSING_EVIDENCE"
    if obs == "CAPABILITY_NOT_IMPLEMENTED":
        return "POLICY_CLARIFICATION_REQUIRED"
    if not supported or stage in ("UNKNOWN", "INSUFFICIENT_OBSERVATION_EVIDENCE"):
        return "BLOCKED_MISSING_EVIDENCE"
    if strength in ("AMBIGUOUS_REFERENCE", "LOW_CONFIDENCE_REFERENCE"):
        return "TARGETED_HUMAN_REVIEW_REQUIRED"
    if behavior == "DEVANAGARI_TRANSLITERATION":
        # Never authorize resource/lexicon from missing exact targets
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


def classify_case(
    residual: dict[str, Any],
    result: dict[str, Any],
    pred: dict[str, Any],
    case: dict[str, Any],
) -> MismatchTriageCaseV1:
    outcome = result["outcome"]
    behavior = result["behavior_class"]
    residual_reasons = list(result.get("residual_reasons") or residual.get("reason_codes") or ())
    span_res = pred.get("span_resolution")
    strength = _evidence_strength(case, outcome, span_res)

    secondary = tuple(sorted(set(residual.get("reason_codes") or ()) - set(residual_reasons)))

    if outcome == "SPAN_FAILURE":
        obs: ObservationClass = "SPAN_FAILURE"
        stage: RootCauseStage = "SPAN_RESOLUTION"
        supported = True
        rationale = ("SPAN_UNRESOLVED_NO_FIRST_MATCH",)
    elif outcome == "PASS":
        obs = "RISK_ONLY_PASS"
        stage = "EVIDENCE_OR_POLICY_REFERENCE"
        supported = True
        rationale = tuple(sorted(set(residual.get("reason_codes") or residual_reasons))) or ("RISK_ONLY",)
    elif outcome == "UNSUPPORTED":
        obs = "UNSUPPORTED"
        stage = "EVIDENCE_OR_POLICY_REFERENCE"
        supported = True
        rationale = ("UNSUPPORTED_DISPOSITION",)
    elif outcome == "FAIL":
        obs = "ACTUAL_CONFORMANCE_FAILURE"
        stage, rationale, supported = _root_cause_for_failure(
            behavior=behavior,
            residual_reasons=residual_reasons,
            pred=pred,
        )
        # CONTEXT without review capability signal
        if behavior == "CONTEXT_DEPENDENT" and "CONTEXT_NO_DIVERSITY_OR_REVIEW_SIGNAL" in residual_reasons:
            if pred.get("review_required") is False and pred.get("candidate_count", 0) <= 1:
                # capability exists (field present) but signal absent → CONTEXT_REVIEW_SIGNAL
                pass
    else:
        obs = "NOT_APPLICABLE"
        stage = "INSUFFICIENT_OBSERVATION_EVIDENCE"
        supported = False
        rationale = ("UNEXPECTED_OUTCOME",)

    action = _action_for(
        obs=obs,
        stage=stage,
        strength=strength,
        behavior=behavior,
        supported=supported,
    )

    # Heuristic alone never → RESOURCE_CORRECTIVE
    if action == "RESOURCE_CORRECTIVE_CANDIDATE":
        action = "PROFESSIONAL_LINGUIST_REVIEW_REQUIRED"

    evidence = TriageEvidenceV1(
        evidence_strength=strength,
        provenance_bucket=case.get("provenance_bucket") or result.get("provenance_bucket") or "",
        confidence=str(case.get("confidence", "")),
        natural_context_ok=str(case.get("natural_context_ok", "")),
        suspected_ambiguity=str(case.get("suspected_ambiguity", "")),
        residual_tier=str(residual.get("residual_tier") or result.get("residual_tier") or ""),
        residual_reasons=tuple(residual_reasons),
        outcome=outcome,
        behavior_class=behavior,
        review_disposition=str(result.get("review_disposition") or case.get("review_disposition") or ""),
    )
    root = RootCauseAssessmentV1(
        primary_stage=stage,
        secondary_stages=(),
        stage_supported_by_saved_evidence=supported,
        rationale_codes=tuple(rationale),
    )
    return MismatchTriageCaseV1(
        schema_version=SCHEMA_VERSION,
        phase=PHASE,
        source_item_id=residual["source_item_id"],
        diagnostic_case_id=residual["diagnostic_case_id"],
        observation_class=obs,
        root_cause=root,
        action_disposition=action,
        evidence=evidence,
        secondary_reason_codes=secondary,
        eligibility=pred.get("eligibility"),
        identity_present=pred.get("identity_present"),
        identity_top1=pred.get("identity_top1"),
        identity_retained_at_5=pred.get("identity_retained_at_5"),
        devanagari_non_identity_present_at_5=pred.get("devanagari_non_identity_present_at_5"),
        devanagari_non_identity_top1=pred.get("devanagari_non_identity_top1"),
        review_required=pred.get("review_required"),
        span_resolution=span_res,
        prohibited_for_training=True,
        governance=dict(FIXED_GOVERNANCE),
    )


def classify_all(
    residuals: list[dict[str, Any]],
    results_by_id: dict[str, dict[str, Any]],
    preds_by_id: dict[str, dict[str, Any]],
    cases_by_id: dict[str, dict[str, Any]],
) -> list[MismatchTriageCaseV1]:
    out: list[MismatchTriageCaseV1] = []
    for r in sorted(residuals, key=lambda x: x["source_item_id"]):
        sid = r["source_item_id"]
        out.append(classify_case(r, results_by_id[sid], preds_by_id[sid], cases_by_id[sid]))
    return out
