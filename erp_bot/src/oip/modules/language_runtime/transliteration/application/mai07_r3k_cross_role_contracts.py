"""MAI-07R3K — typed contracts for AI-assisted cross-role consensus diagnostics.

Engineering diagnostics only. Not independent human IRR, not gold, not majority-as-authority.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

DecisionSource = Literal[
    "ACCOUNTING_DOMAIN_VERIFIED_IMPORT",
    "ACCOUNTING_VERIFIED_CONTENT_MAP",
    "HEURISTIC_V1",
]

ExactAgreementStatus = Literal[
    "UNANIMOUS",
    "MAJORITY",
    "SPLIT_NO_MAJORITY",
    "ALL_DIFFERENT",
    "SINGLE_ROLE",
]

RiskTier = Literal["TIER_1_CRITICAL", "TIER_2_HIGH", "TIER_3_MEDIUM", "TIER_4_LOW"]


@dataclass(frozen=True)
class RoleJudgmentV1:
    role_id: str
    review_id: str
    disposition: str
    confidence: str
    reason_category: str
    natural_context_ok: str
    suspected_ambiguity: str
    reviewer_notes: str
    source_workbook: str
    source_row: int
    decision_source: DecisionSource
    review_method: str
    independent_human_review: bool
    ai_autofill_used: bool
    user_accepted: bool
    professional_linguist_adjudication: bool
    prohibited_for_training: bool
    eligible_for_frozen_quality_gold: bool
    professional_linguist_b_is_ai_role_simulation: bool = False


@dataclass(frozen=True)
class DisagreementReasonV1:
    code: str
    detail: str


@dataclass(frozen=True)
class CrossRoleDecisionV1:
    source_item_id: str
    diagnostic_case_id: str
    input_text: str
    highlighted_span: str
    role_count: int
    has_accounting_domain: bool
    judgments: tuple[RoleJudgmentV1, ...]
    disposition_set: tuple[str, ...]
    exact_agreement_status: ExactAgreementStatus
    dispositions_unanimous: bool
    disagreement_reasons: tuple[DisagreementReasonV1, ...]
    risk_flags: tuple[str, ...]
    decision_sources: tuple[str, ...]
    heuristic_v1_present: bool
    accounting_map_present: bool
    majority_as_gold: bool = False  # always False — never authority


@dataclass(frozen=True)
class RiskQueueItemV1:
    diagnostic_case_id: str
    source_item_id: str
    risk_tier: RiskTier
    reason_codes: tuple[str, ...]
    input_text: str
    highlighted_span: str
    role_count: int
    disposition_set: tuple[str, ...]


@dataclass(frozen=True)
class AgreementDiagnosticV1:
    three_role_exact_disposition_agreement_rate: float
    three_role_exact_disposition_agree_count: int
    three_role_n: int
    four_role_exact_disposition_agreement_rate: float
    four_role_exact_disposition_agree_count: int
    four_role_n: int
    unanimous_count: int
    majority_count: int
    all_different_count: int
    split_no_majority_count: int
    abstention_containing_count: int
    review_vs_required_conflict_count: int
    agreement_by_disposition: dict[str, Any]
    agreement_by_confidence: dict[str, Any]
    natural_context_ok_agreement: dict[str, Any]
    suspected_ambiguity_agreement: dict[str, Any]
    agreement_by_decision_source_bucket: dict[str, Any]
    pairwise_role_disposition_agreement: dict[str, Any]
    conflict_taxonomy_counts: dict[str, int]
    # Explicitly non-independent AI-output similarity (NOT human IRR):
    ai_output_similarity_metrics_non_independent: dict[str, Any]


@dataclass(frozen=True)
class ConsensusDiagnosticReportV1:
    phase: str
    schema: str
    ok: bool
    semantic_hash: str
    input_accounting_semantic_hash: str
    input_remaining_semantic_hash: str
    unique_source_item_ids: int
    total_role_judgments: int
    four_role_cases: int
    three_role_cases: int
    role_counts: dict[str, int]
    agreement: AgreementDiagnosticV1
    risk_queue_count: int
    risk_tier_counts: dict[str, int]
    targeted_packet_item_count: int
    governance: dict[str, Any]
    provenance: dict[str, Any]


def to_dict(obj: Any) -> Any:
    if hasattr(obj, "__dataclass_fields__"):
        return asdict(obj)
    return obj
