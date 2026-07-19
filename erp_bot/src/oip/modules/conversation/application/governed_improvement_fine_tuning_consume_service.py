"""MAI-48 slice 2 — consume governed improvement / fine-tuning into candidates.

Default: CANDIDATE_ONLY (build improvement candidate; never applies changes).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never fine-tune execution or production model swap.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.governed_improvement_fine_tuning import (
    GovernedImprovementFineTuningBundleV1,
    GovernedImprovementFineTuningReadiness,
    GovernedImprovementFineTuningStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-48.0.2-slice2"
AUTHORITY = "ADR_0065"


def _as_gift_meta(
    bundle: Mapping[str, Any] | GovernedImprovementFineTuningBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, GovernedImprovementFineTuningBundleV1):
        from .governed_improvement_fine_tuning_service import (
            governed_improvement_fine_tuning_to_metadata,
        )

        return governed_improvement_fine_tuning_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("fine_tune_authority_claimed") is True
        or data.get("improvement_applied") is True
        or data.get("fine_tuning_executed") is True
        or data.get("training_data_exported") is True
        or data.get("model_weights_changed") is True
        or data.get("production_model_swapped") is True
        or data.get("regression_suite_passed") is True
        or data.get("governed_change_approved") is True
        or data.get("current_law_definitive") is True
        or data.get("legal_effective_dates_proven") is True
        or data.get("claims_verified") is True
        or data.get("legal_proof_claimed") is True
        or data.get("kb_retrieval_invoked") is True
        or int(data.get("documents_retrieved") or 0) != 0
        or int(data.get("draft_mutations") or 0) != 0
        or int(data.get("posting_mutations") or 0) != 0
        or str(data.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(data.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(data.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
        or str(data.get("gold_questions_status") or "NOT_RELEASED")
        != "NOT_RELEASED"
        or str(
            data.get("pilot_scope")
            or "GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY"
        )
        != "GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY"
    )


def resolve_governed_improvement_fine_tuning_consume_mode(
    bundle: Mapping[str, Any] | GovernedImprovementFineTuningBundleV1 | None,
    *,
    allow_fine_tune: bool = False,
    allow_model_swap: bool = False,
) -> str:
    """Return consume mode (never implies apply/fine-tune on default path)."""
    data = _as_gift_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != GovernedImprovementFineTuningStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(
        data.get("governed_improvement_fine_tuning_readiness") or ""
    )
    if readiness == GovernedImprovementFineTuningReadiness.BLOCKED.value:
        return "BLOCKED"
    if (
        readiness
        == GovernedImprovementFineTuningReadiness.NOT_APPLICABLE.value
    ):
        return "SKIP"
    if readiness not in {
        GovernedImprovementFineTuningReadiness.POLICY_DECLARED.value,
        GovernedImprovementFineTuningReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_fine_tune:
        return "INVOKE_FINE_TUNE"
    if allow_model_swap:
        return "INVOKE_MODEL_SWAP"
    return "CANDIDATE_ONLY"


def build_governed_improvement_fine_tuning_candidate(
    bundle: Mapping[str, Any] | GovernedImprovementFineTuningBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_fine_tune: bool = False,
    allow_model_swap: bool = False,
) -> dict[str, Any]:
    """Build governed improvement / fine-tuning candidate (never applies)."""
    data = _as_gift_meta(bundle)
    mode = resolve_governed_improvement_fine_tuning_consume_mode(
        data,
        allow_fine_tune=allow_fine_tune,
        allow_model_swap=allow_model_swap,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "governed_improvement_fine_tuning_consume_mode": mode,
        "governed_improvement_fine_tuning_consume_ready": False,
        "governed_improvement_fine_tuning_candidate": None,
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
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_fine_tune": False,
        "allow_model_swap": False,
    }
    if data is None or mode in {"UNCHANGED", "SKIP", "BLOCKED"}:
        return base

    topics = data.get("in_scope_topics") or ()
    if isinstance(topics, tuple):
        topics = list(topics)
    unsupported = data.get("unsupported_topics") or ()
    if isinstance(unsupported, tuple):
        unsupported = list(unsupported)

    candidate = {
        "pilot_scope": "GOVERNED_IMPROVEMENT_FINE_TUNING_CANDIDATE_ONLY",
        "governed_improvement_fine_tuning_readiness": data.get(
            "governed_improvement_fine_tuning_readiness"
        ),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "improvement_proposal": None,
        "fine_tune_plan": None,
        "eval_regression_plan": None,
        "dataset_curation_plan": None,
        "prompt_iteration_plan": None,
        "model_swap_plan": None,
        "ablation_plan": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "fine_tune_authority_claimed": False,
        "improvement_applied": False,
        "fine_tuning_executed": False,
        "training_data_exported": False,
        "model_weights_changed": False,
        "production_model_swapped": False,
        "regression_suite_passed": False,
        "governed_change_approved": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "governed_improvement_fine_tuning_consume_ready": ready,
            "governed_improvement_fine_tuning_candidate": candidate,
        }
    )
    return base


def governed_improvement_fine_tuning_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_fine_tune: bool = False,
    allow_model_swap: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_fine_tune, allow_model_swap
    built = build_governed_improvement_fine_tuning_candidate(
        request.governed_improvement_fine_tuning_bundle,
        field_overrides={},
        allow_fine_tune=False,
        allow_model_swap=False,
    )
    return {
        "governed_improvement_fine_tuning_consume_mode": built[
            "governed_improvement_fine_tuning_consume_mode"
        ],
        "governed_improvement_fine_tuning_consume_ready": bool(
            built["governed_improvement_fine_tuning_consume_ready"]
        ),
        "governed_improvement_fine_tuning_candidate": built.get(
            "governed_improvement_fine_tuning_candidate"
        ),
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
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_fine_tune": False,
        "allow_model_swap": False,
    }


def assert_governed_improvement_fine_tuning_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("fine_tune_authority_claimed") is True
        or obs.get("improvement_applied") is True
        or obs.get("fine_tuning_executed") is True
        or obs.get("training_data_exported") is True
        or obs.get("model_weights_changed") is True
        or obs.get("production_model_swapped") is True
        or obs.get("regression_suite_passed") is True
        or obs.get("governed_change_approved") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_fine_tune") is True
        or obs.get("allow_model_swap") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("GOVERNED_IMPROVEMENT_FINE_TUNING_CONSUME_AUTHORITY")


def enrich_gift_metadata_with_consume(
    gift_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(gift_meta)
    obs = governed_improvement_fine_tuning_consume_observability(
        request,
        allow_fine_tune=False,
        allow_model_swap=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
