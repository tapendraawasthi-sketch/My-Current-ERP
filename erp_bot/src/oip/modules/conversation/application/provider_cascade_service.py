"""MAI-22 slice 1 — provider cascade annotation (no model calls).

Deterministic selected provider + ordered fallback chain from settings /
static defaults. Never invokes adapters or mutates drafts.
"""

from __future__ import annotations

from typing import Any

from ....contracts.clarification_plan import ClarificationPlanStatus
from ....contracts.provider_cascade import (
    ProviderCascadeAnalysisStatus,
    ProviderCascadeBundleV1,
)
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.typed_plan import TypedPlanAnalysisStatus

RUNTIME_VERSION = "mai-22.0.1-slice1"
AUTHORITY = "ADR_0039"
POLICY_NAME = "deterministic_default_v1"

# Static engineering defaults (annotation only; not live health).
_DEFAULT_CASCADE: tuple[str, ...] = ("ollama", "groq", "openai", "custom")


def _settings_primary() -> tuple[str, str | None]:
    try:
        from ....config.settings import get_oip_settings

        settings = get_oip_settings()
        primary = (settings.default_provider or "").strip() or "ollama"
        model = (settings.default_model or "").strip() or None
        return primary, model
    except Exception:  # noqa: BLE001
        return "ollama", None


def _build_cascade_order(primary: str) -> tuple[str, ...]:
    ordered: list[str] = [primary]
    for pid in _DEFAULT_CASCADE:
        if pid not in ordered:
            ordered.append(pid)
    return tuple(ordered)


def build_provider_cascade_bundle(
    request: CanonicalAIRequestV1,
) -> ProviderCascadeBundleV1:
    clarify = request.clarification_plan_bundle
    typed = request.typed_plan_bundle

    if clarify is not None and clarify.analysis_status == ClarificationPlanStatus.ASK:
        return ProviderCascadeBundleV1(
            analysis_status=ProviderCascadeAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            policy_name=POLICY_NAME,
            reason_codes=("CLARIFICATION_PENDING",),
            warnings=("CLARIFICATION_PENDING",),
        )

    if typed is None:
        return ProviderCascadeBundleV1(
            analysis_status=ProviderCascadeAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            policy_name=POLICY_NAME,
            reason_codes=("NO_TYPED_PLAN",),
            warnings=("NO_TYPED_PLAN",),
        )

    if typed.analysis_status != TypedPlanAnalysisStatus.COMPLETE:
        return ProviderCascadeBundleV1(
            analysis_status=ProviderCascadeAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            policy_name=POLICY_NAME,
            reason_codes=("TYPED_PLAN_SKIP",),
            warnings=("TYPED_PLAN_NOT_COMPLETE",),
        )

    primary, model = _settings_primary()
    cascade = _build_cascade_order(primary)
    fallback = cascade[1:] if len(cascade) > 1 else ()

    return ProviderCascadeBundleV1(
        analysis_status=ProviderCascadeAnalysisStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        selected_provider_id=primary,
        selected_model_id=model,
        cascade_order=cascade,
        fallback_chain=fallback,
        policy_name=POLICY_NAME,
        reason_codes=("TYPED_PLAN_COMPLETE", "DETERMINISTIC_DEFAULT"),
        silent_applications=0,
        draft_mutations=0,
        model_invocations=0,
    )


def attach_provider_cascade_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_provider_cascade_bundle(request)
    return request.model_copy(update={"provider_cascade_bundle": bundle})


def assert_provider_cascade_authority(
    bundle: ProviderCascadeBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.silent_applications != 0
        or bundle.draft_mutations != 0
        or bundle.model_invocations != 0
    ):
        raise RuntimeError("PROVIDER_CASCADE_AUTHORITY")


def provider_cascade_to_metadata(
    bundle: ProviderCascadeBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "selected_provider_id": bundle.selected_provider_id,
        "selected_model_id": bundle.selected_model_id,
        "cascade_order": list(bundle.cascade_order),
        "fallback_chain": list(bundle.fallback_chain),
        "policy_name": bundle.policy_name,
        "reason_codes": list(bundle.reason_codes),
        "silent_applications": bundle.silent_applications,
        "draft_mutations": bundle.draft_mutations,
        "model_invocations": bundle.model_invocations,
        "is_execution_authority": False,
    }


__all__ = [
    "AUTHORITY",
    "POLICY_NAME",
    "RUNTIME_VERSION",
    "assert_provider_cascade_authority",
    "attach_provider_cascade_to_request",
    "build_provider_cascade_bundle",
    "provider_cascade_to_metadata",
]
