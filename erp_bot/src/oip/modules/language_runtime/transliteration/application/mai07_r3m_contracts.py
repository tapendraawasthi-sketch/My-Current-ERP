"""MAI-07R3M — typed contracts for AI-assisted policy mismatch triage.

Engineering triage only. Not quality, not gold, not Round A.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal

PHASE = "MAI-07R3M-AI-ASSISTED-POLICY-MISMATCH-TRIAGE"
SCHEMA_VERSION = "mai07_r3m_policy_mismatch_triage_v1"

EvidenceStrength = Literal[
    "USER_ACCEPTED_ACCOUNTING_CONTENT_MAP",
    "USER_ACCEPTED_HEURISTIC_REFERENCE",
    "LOW_CONFIDENCE_REFERENCE",
    "AMBIGUOUS_REFERENCE",
    "INSUFFICIENT_LINGUISTIC_EVIDENCE",
    "SPAN_UNRESOLVED",
]

ObservationClass = Literal[
    "ACTUAL_CONFORMANCE_FAILURE",
    "RISK_ONLY_PASS",
    "SPAN_FAILURE",
    "NOT_APPLICABLE",
    "UNSUPPORTED",
    "CAPABILITY_NOT_IMPLEMENTED",
]

RootCauseStage = Literal[
    "SPAN_RESOLUTION",
    "LANGUAGE_FORM_ANALYSIS",
    "ELIGIBILITY",
    "IDENTITY_CANDIDATE_INVARIANT",
    "DEVANAGARI_GENERATOR_COVERAGE",
    "CANDIDATE_DEDUPLICATION_OR_CAP",
    "RANKING",
    "ENGLISH_IDENTITY_GUARD",
    "ACRONYM_OR_IDENTIFIER_PROTECTION",
    "OPTIONAL_POLICY",
    "CONTEXT_REVIEW_SIGNAL",
    "EVIDENCE_OR_POLICY_REFERENCE",
    "UNKNOWN",
    "INSUFFICIENT_OBSERVATION_EVIDENCE",
]

ActionDisposition = Literal[
    "CODE_CORRECTIVE_CANDIDATE",
    "RESOURCE_CORRECTIVE_CANDIDATE",
    "NON_FROZEN_TEST_CANDIDATE",
    "POLICY_CLARIFICATION_REQUIRED",
    "TARGETED_HUMAN_REVIEW_REQUIRED",
    "PROFESSIONAL_LINGUIST_REVIEW_REQUIRED",
    "NO_CORRECTIVE_ACTION_RISK_ONLY",
    "BLOCKED_MISSING_EVIDENCE",
]

FIXED_GOVERNANCE: dict[str, Any] = {
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


@dataclass(frozen=True)
class TriageEvidenceV1:
    evidence_strength: EvidenceStrength
    provenance_bucket: str
    confidence: str
    natural_context_ok: str
    suspected_ambiguity: str
    residual_tier: str
    residual_reasons: tuple[str, ...]
    outcome: str
    behavior_class: str
    review_disposition: str


@dataclass(frozen=True)
class RootCauseAssessmentV1:
    primary_stage: RootCauseStage
    secondary_stages: tuple[RootCauseStage, ...]
    stage_supported_by_saved_evidence: bool
    rationale_codes: tuple[str, ...]


@dataclass(frozen=True)
class MismatchTriageCaseV1:
    schema_version: str
    phase: str
    source_item_id: str
    diagnostic_case_id: str
    observation_class: ObservationClass
    root_cause: RootCauseAssessmentV1
    action_disposition: ActionDisposition
    evidence: TriageEvidenceV1
    secondary_reason_codes: tuple[str, ...]
    eligibility: str | None
    identity_present: bool | None
    identity_top1: bool | None
    identity_retained_at_5: bool | None
    devanagari_non_identity_present_at_5: bool | None
    devanagari_non_identity_top1: bool | None
    review_required: bool | None
    span_resolution: str | None
    prohibited_for_training: bool
    governance: dict[str, Any]


@dataclass(frozen=True)
class RootCauseClusterV1:
    cluster_id: str
    observation_class: ObservationClass
    primary_stage: RootCauseStage
    action_disposition: ActionDisposition
    evidence_strength: EvidenceStrength
    behavior_class: str
    provenance_bucket: str
    residual_tier: str
    case_count: int
    case_ids: tuple[str, ...]  # private artifacts only
    representative_opaque_ids: tuple[str, ...]
    corrective_eligible: bool
    human_review_needed: bool


@dataclass(frozen=True)
class CorrectiveActionCandidateV1:
    source_item_id: str
    action_disposition: ActionDisposition
    primary_stage: RootCauseStage
    evidence_strength: EvidenceStrength
    rationale_codes: tuple[str, ...]
    blocked_information: tuple[str, ...]


@dataclass(frozen=True)
class HumanReviewRequirementV1:
    source_item_id: str
    queue: ActionDisposition
    evidence_strength: EvidenceStrength
    rationale_codes: tuple[str, ...]


@dataclass(frozen=True)
class DiagnosticOnlyDispositionV1:
    source_item_id: str
    observation_class: ObservationClass
    rationale_codes: tuple[str, ...]


@dataclass(frozen=True)
class TriagePopulationV1:
    population_id: str
    case_ids: tuple[str, ...]
    count: int


@dataclass(frozen=True)
class TriageCompletenessReportV1:
    ok: bool
    residual_reconciled: int
    fail_classified: int
    span_classified: int
    tier3_actual_mismatch: int
    tier3_risk_only: int
    tier1_assessed: int
    duplicates: int
    missing: int
    gates: dict[str, bool]


@dataclass(frozen=True)
class TriageAuditReportV1:
    ok: bool
    mismatch_count: int
    mismatches: tuple[str, ...]


@dataclass(frozen=True)
class NextPhaseRecommendationV1:
    recommended_phase: str
    selection_rule_applied: str
    code_corrective_count: int
    resource_corrective_count: int
    human_review_count: int
    linguist_review_count: int
    rationale_codes: tuple[str, ...]


def to_dict(obj: Any) -> Any:
    if hasattr(obj, "__dataclass_fields__"):
        return asdict(obj)
    return obj
