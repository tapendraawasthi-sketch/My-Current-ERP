"""MAI-48 — governed improvement / fine-tuning policy (never applies changes).

Slice 1: declare candidate governed-improvement / optional fine-tuning policy
from cue detection. Never applies improvements, never executes fine-tuning,
never swaps production models.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.governed_improvement_fine_tuning import (
    GovernedImprovementFineTuningBundleV1,
    GovernedImprovementFineTuningReadiness,
    GovernedImprovementFineTuningStatus,
    GovernedImprovementFineTuningTopic,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-48.0.2-slice2"
AUTHORITY = "ADR_0065"

_GOVERNED = re.compile(
    r"\b(?:governed\s+improvement|improvement\s+proposal|change\s+proposal)\b",
    re.I,
)
_FINE_TUNE = re.compile(
    r"\b(?:fine[- ]?tun(?:e|ing)|LoRA|adapter\s+train(?:ing)?)\b",
    re.I,
)
_EVAL = re.compile(
    r"\b(?:eval\s+regression|regression\s+suite|holdout\s+eval)\b",
    re.I,
)
_DATASET = re.compile(
    r"\b(?:dataset\s+curation|training\s+dataset|curated\s+corpus)\b",
    re.I,
)
_PROMPT = re.compile(
    r"\b(?:prompt\s+iteration|prompt\s+revision|prompt\s+ablation)\b",
    re.I,
)
_MODEL_SWAP = re.compile(
    r"\b(?:model\s+swap|provider\s+swap|production\s+model\s+change)\b",
    re.I,
)
_ABLATION = re.compile(
    r"\b(?:ablation\s+study|ablation\s+test)\b",
    re.I,
)
_UNSUPPORTED = re.compile(
    r"\b(?:customs|excise|भन्सार|अन्तःशुल्क)\b",
    re.I,
)


def _detect_topics(text: str) -> tuple[list[str], list[str]]:
    in_scope: list[str] = []
    unsupported: list[str] = []
    raw = text or ""
    if _GOVERNED.search(raw):
        in_scope.append(
            GovernedImprovementFineTuningTopic.GOVERNED_IMPROVEMENT.value
        )
    if _FINE_TUNE.search(raw):
        in_scope.append(GovernedImprovementFineTuningTopic.FINE_TUNING.value)
    if _EVAL.search(raw):
        in_scope.append(
            GovernedImprovementFineTuningTopic.EVAL_REGRESSION.value
        )
    if _DATASET.search(raw):
        in_scope.append(
            GovernedImprovementFineTuningTopic.DATASET_CURATION.value
        )
    if _PROMPT.search(raw):
        in_scope.append(
            GovernedImprovementFineTuningTopic.PROMPT_ITERATION.value
        )
    if _MODEL_SWAP.search(raw):
        in_scope.append(GovernedImprovementFineTuningTopic.MODEL_SWAP.value)
    if _ABLATION.search(raw):
        in_scope.append(
            GovernedImprovementFineTuningTopic.ABLATION_STUDY.value
        )
    if _UNSUPPORTED.search(raw) and not in_scope:
        unsupported.append(
            GovernedImprovementFineTuningTopic.UNSUPPORTED.value
        )
    return in_scope, unsupported


def build_governed_improvement_fine_tuning_bundle(
    request: CanonicalAIRequestV1,
) -> GovernedImprovementFineTuningBundleV1:
    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return GovernedImprovementFineTuningBundleV1(
            analysis_status=GovernedImprovementFineTuningStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            governed_improvement_fine_tuning_readiness=(
                GovernedImprovementFineTuningReadiness.BLOCKED
            ),
            unsupported_topics=tuple(unsupported),
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "GOVERNED_IMPROVEMENT_FINE_TUNING_BLOCKED",
                "NO_FINE_TUNE_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return GovernedImprovementFineTuningBundleV1(
            analysis_status=GovernedImprovementFineTuningStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            governed_improvement_fine_tuning_readiness=(
                GovernedImprovementFineTuningReadiness.NOT_APPLICABLE
            ),
            reason_codes=(
                "NO_IN_SCOPE_GOVERNED_IMPROVEMENT_FINE_TUNING_TOPIC",
            ),
            warnings=("GOVERNED_IMPROVEMENT_FINE_TUNING_NOT_APPLICABLE",),
        )

    pilot_ready = (
        GovernedImprovementFineTuningReadiness.SCOPE_PARTIAL
        if unsupported
        else GovernedImprovementFineTuningReadiness.POLICY_DECLARED
    )
    reasons = [
        "PILOT_SCOPE_GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY",
        "IMPROVEMENT_SUITE_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_FINE_TUNE_AUTHORITY",
        "IMPROVEMENT_NOT_APPLIED",
        "FINE_TUNING_NOT_EXECUTED",
        "TRAINING_DATA_NOT_EXPORTED",
        "MODEL_WEIGHTS_NOT_CHANGED",
        "PRODUCTION_MODEL_NOT_SWAPPED",
        "REGRESSION_SUITE_NOT_PASSED",
        "GOVERNED_CHANGE_NOT_APPROVED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    return GovernedImprovementFineTuningBundleV1(
        analysis_status=GovernedImprovementFineTuningStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        governed_improvement_fine_tuning_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY",
            "MUST_NOT_APPLY_IMPROVEMENT_OR_FINE_TUNE",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_GOVERNED_CHANGE_APPROVED",
        ),
    )


def attach_governed_improvement_fine_tuning_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_governed_improvement_fine_tuning_bundle(request)
    return request.model_copy(
        update={"governed_improvement_fine_tuning_bundle": bundle}
    )


def assert_governed_improvement_fine_tuning_authority(
    bundle: GovernedImprovementFineTuningBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.fine_tune_authority_claimed
        or bundle.improvement_applied
        or bundle.fine_tuning_executed
        or bundle.training_data_exported
        or bundle.model_weights_changed
        or bundle.production_model_swapped
        or bundle.regression_suite_passed
        or bundle.governed_change_approved
        or bundle.current_law_definitive
        or bundle.legal_effective_dates_proven
        or bundle.claims_verified
        or bundle.legal_proof_claimed
        or bundle.kb_retrieval_invoked
        or bundle.documents_retrieved != 0
        or bundle.draft_mutations != 0
        or bundle.posting_mutations != 0
        or bundle.gap_p2_008_status != "OPEN"
        or bundle.specialist_signoff_status != "NOT_SIGNED"
        or bundle.release_status != "NOT_RELEASED"
        or bundle.gold_questions_status != "NOT_RELEASED"
        or bundle.pilot_scope
        != "GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY"
    ):
        raise RuntimeError("GOVERNED_IMPROVEMENT_FINE_TUNING_AUTHORITY")


def governed_improvement_fine_tuning_to_metadata(
    bundle: GovernedImprovementFineTuningBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "governed_improvement_fine_tuning_readiness": (
            bundle.governed_improvement_fine_tuning_readiness.value
        ),
        "pilot_scope": "GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
        "mutation_tools_allowed": False,
        "fine_tune_authority_claimed": False,
        "improvement_applied": False,
        "fine_tuning_executed": False,
        "training_data_exported": False,
        "model_weights_changed": False,
        "production_model_swapped": False,
        "regression_suite_passed": False,
        "governed_change_approved": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "gap_p2_008_status": "OPEN",
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
