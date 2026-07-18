"""MAI-07R3L — typed contracts for AI-assisted runtime conformance diagnostics.

Engineering diagnostics only. Not language quality, not gold, not Round A.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

PHASE = "MAI-07R3L-AI-ASSISTED-RUNTIME-CONFORMANCE-DIAGNOSTIC"
SCHEMA_VERSION = "mai07_r3l_runtime_conformance_diagnostic_v1"

EvidenceStatus = Literal[
    "NON_INDEPENDENT_AI_ASSISTED_USER_ACCEPTED_POLICY_REFERENCE",
]
AgreementStatus = Literal[
    "NON_INDEPENDENT_AI_OUTPUT_SIMILARITY_ONLY",
]
ProvenanceBucket = Literal[
    "ACCOUNTING_CONTENT_MAP",
    "HEURISTIC_V1",
]
SpanResolutionStatus = Literal[
    "RESOLVED",
    "SPAN_NOT_FOUND",
    "SPAN_AMBIGUOUS",
]
ScoringApplicability = Literal[
    "SCORABLE",
    "NOT_APPLICABLE",
    "UNSUPPORTED",
]
BehaviorClass = Literal[
    "ENGLISH_IDENTITY",
    "DEVANAGARI_TRANSLITERATION",
    "IDENTITY_FIRST",
    "OPTIONAL",
    "ACRONYM",
    "CONTEXT_DEPENDENT",
    "ABSTAIN",
    "PROTECTED_OR_IDENTIFIER",
    "UNKNOWN_UNSUPPORTED",
]
ConformanceOutcome = Literal[
    "PASS",
    "FAIL",
    "NOT_APPLICABLE",
    "UNSUPPORTED",
    "SPAN_FAILURE",
    "CAPABILITY_NOT_IMPLEMENTED",
    "EXCEPTION",
]
ResidualTier = Literal[
    "TIER_1_CRITICAL",
    "TIER_2_HIGH",
    "TIER_3_MEDIUM",
]


FIXED_GOVERNANCE: dict[str, Any] = {
    "review_method": "AI_ASSISTED_HUMAN_VERIFIED_POLICY_REFERENCE",
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
class BehaviorExpectationV1:
    behavior_class: BehaviorClass
    review_disposition: str
    scoring_applicability: ScoringApplicability
    unique_top1_gold: bool
    require_identity_top1: bool
    require_identity_retained_at_5: bool
    require_devanagari_candidate_at_5: bool
    forbid_forced_devanagari_top1: bool
    forbid_raw_mutation: bool
    allow_abstain_or_review: bool
    reason_codes: tuple[str, ...]


@dataclass(frozen=True)
class RuntimeConformanceInputV1:
    schema_version: str
    phase: str
    source_item_id: str
    diagnostic_case_id: str
    input_text: str
    highlighted_span: str
    review_disposition: str
    confidence: str
    natural_context_ok: str
    suspected_ambiguity: str
    provenance_bucket: ProvenanceBucket
    evidence_status: EvidenceStatus
    agreement_status: AgreementStatus
    majority_is_gold: bool
    independent_human_irr: bool
    r3k_risk_tier: str | None
    r3k_risk_reason_codes: tuple[str, ...]
    has_accounting_domain: bool
    role_count: int
    behavior: BehaviorExpectationV1
    runtime_version: str
    resource_hash: str
    prohibited_for_training: bool
    governance: dict[str, Any]


@dataclass(frozen=True)
class RuntimeCandidateObservationV1:
    rank: int
    script: str
    kind: str
    is_identity: bool
    requires_review: bool
    has_devanagari_chars: bool
    is_devanagari_non_identity: bool
    surface_len: int
    # Surfaces stored only in governed local eval artifacts; scoring uses flags.


@dataclass(frozen=True)
class RuntimePredictionEnvelopeV1:
    schema_version: str
    phase: str
    source_item_id: str
    diagnostic_case_id: str
    runtime_version: str
    resource_hash: str
    span_resolution: SpanResolutionStatus
    span_start_offset: int | None
    span_end_offset: int | None
    eligibility: str | None
    runtime_disposition: str | None
    review_required: bool | None
    review_reason_codes: tuple[str, ...]
    candidate_count: int
    candidates: tuple[RuntimeCandidateObservationV1, ...]
    identity_present: bool
    identity_top1: bool
    identity_retained_at_5: bool
    devanagari_non_identity_present_at_5: bool
    devanagari_non_identity_top1: bool
    caps_ok: bool
    raw_text_unchanged: bool
    protected_span_identity_ok: bool
    code_point_alignment_ok: bool
    duplicate_candidate_count: int
    exception_status: str | None
    latency_ms: float
    reason_codes: tuple[str, ...]
    prohibited_for_training: bool
    # Safe surfaces for scoring only inside governed artifacts:
    source_surface: str | None
    candidate_surfaces: tuple[str, ...]


@dataclass(frozen=True)
class ConformanceResultV1:
    schema_version: str
    phase: str
    source_item_id: str
    diagnostic_case_id: str
    behavior_class: BehaviorClass
    review_disposition: str
    scoring_applicability: ScoringApplicability
    outcome: ConformanceOutcome
    metric_flags: dict[str, bool | None]
    reason_codes: tuple[str, ...]
    residual_tier: ResidualTier | None
    residual_reasons: tuple[str, ...]
    provenance_bucket: ProvenanceBucket
    r3k_risk_tier: str | None
    runtime_version: str
    resource_hash: str
    prohibited_for_training: bool


@dataclass(frozen=True)
class ConformanceMetricV1:
    metric_id: str
    population_id: str
    numerator: int
    denominator: int
    applicability: ScoringApplicability
    case_ids_numerator: tuple[str, ...]
    case_ids_denominator: tuple[str, ...]
    rate: float | None


@dataclass(frozen=True)
class ConformancePopulationV1:
    population_id: str
    required: bool
    case_ids: tuple[str, ...]
    count: int
    status: Literal["OK", "INVALID_REQUIRED_POPULATION", "NOT_APPLICABLE"]


@dataclass(frozen=True)
class ResidualRiskItemV1:
    source_item_id: str
    diagnostic_case_id: str
    residual_tier: ResidualTier
    reason_codes: tuple[str, ...]
    behavior_class: BehaviorClass
    provenance_bucket: ProvenanceBucket
    r3k_risk_tier: str | None
    input_text: str
    highlighted_span: str


@dataclass(frozen=True)
class ReviewerPacketItemV1:
    opaque_review_id: str
    input_text: str
    highlighted_span: str
    context_note: str
    disposition: str
    confidence: str
    reviewer_notes: str


@dataclass(frozen=True)
class RuntimeConformanceReportV1:
    schema_version: str
    phase: str
    ok: bool
    verdict: str
    semantic_hash: str
    runtime_version: str
    resource_hash: str
    overlay_enabled: bool
    case_count: int
    population_counts: dict[str, int]
    metrics: dict[str, Any]
    safety: dict[str, Any]
    residual_counts: dict[str, int]
    targeted_packet_count: int
    governance: dict[str, Any]
    provenance: dict[str, Any]


def to_dict(obj: Any) -> Any:
    if hasattr(obj, "__dataclass_fields__"):
        return asdict(obj)
    return obj
