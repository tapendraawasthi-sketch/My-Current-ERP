"""MAI-22 — provider cascade annotation + orchestrator consume.

Slice 1: deterministic selected provider + ordered fallbacks (annotation).
Slice 2: apply COMPLETE cascade onto RouteDecision before start_execution.
Never mutates drafts; cascade bundle stays non-execution-authority.
"""

from __future__ import annotations

from typing import Any, Mapping, TypeVar

from ....contracts.clarification_plan import ClarificationPlanStatus
from ....contracts.provider_cascade import (
    ProviderCascadeAnalysisStatus,
    ProviderCascadeBundleV1,
)
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.typed_plan import TypedPlanAnalysisStatus

RUNTIME_VERSION = "mai-22.0.2-slice2"
AUTHORITY = "ADR_0039"
POLICY_NAME = "deterministic_default_v1"

# Static engineering defaults (annotation only; not live health).
_DEFAULT_CASCADE: tuple[str, ...] = ("ollama", "groq", "openai", "custom")

RouteT = TypeVar("RouteT")


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


def should_apply_provider_cascade(
    provider_cascade: Mapping[str, Any] | None,
) -> bool:
    """True when orchestrator must overlay cascade onto the route."""
    if not isinstance(provider_cascade, Mapping):
        return False
    if provider_cascade.get("is_execution_authority") is True:
        return False
    if int(provider_cascade.get("model_invocations") or 0) != 0:
        return False
    if int(provider_cascade.get("draft_mutations") or 0) != 0:
        return False
    if str(provider_cascade.get("analysis_status") or "") != (
        ProviderCascadeAnalysisStatus.COMPLETE.value
    ):
        return False
    return bool(str(provider_cascade.get("selected_provider_id") or "").strip())


def apply_provider_cascade_to_route(
    route: RouteT,
    provider_cascade: Mapping[str, Any] | None,
) -> RouteT:
    """Overlay COMPLETE cascade onto RouteDecision; no-op otherwise.

    Updates primary_provider + fallback_chain and records policy_decisions.
    Does not invoke models or mutate drafts.
    """
    if not should_apply_provider_cascade(provider_cascade):
        return route
    assert isinstance(provider_cascade, Mapping)

    primary = str(provider_cascade.get("selected_provider_id") or "").strip()
    model_hint = provider_cascade.get("selected_model_id")
    model_hint_s = str(model_hint).strip() if model_hint else None

    order_raw = provider_cascade.get("cascade_order") or []
    if isinstance(order_raw, (list, tuple)) and order_raw:
        order = [str(x).strip() for x in order_raw if str(x).strip()]
    else:
        order = [primary]
    if not order or order[0] != primary:
        order = [primary] + [p for p in order if p != primary]
    fallback = tuple(p for p in order[1:] if p)

    try:
        from ...router.domain.value_objects import (
            FallbackChain,
            ProviderSelection,
            RoutingScore,
        )
    except Exception:  # noqa: BLE001
        return route

    prev_primary = getattr(route, "primary_provider", None)
    score = getattr(prev_primary, "score", None)
    caps = getattr(prev_primary, "capabilities", ()) or ()
    new_primary = ProviderSelection(
        provider_id=primary,
        model_hint=model_hint_s or getattr(prev_primary, "model_hint", None),
        capabilities=tuple(caps),
        score=score if score is not None else RoutingScore(),
    )
    new_fallback = FallbackChain(
        providers=fallback,
        max_retries=getattr(
            getattr(route, "fallback_chain", None), "max_retries", 2
        ),
        retry_policy=getattr(
            getattr(route, "fallback_chain", None),
            "retry_policy",
            "exponential_backoff",
        ),
    )
    pd = dict(getattr(route, "policy_decisions", None) or {})
    pd["provider_cascade"] = {
        "applied": True,
        "runtime_version": provider_cascade.get("runtime_version"),
        "selected_provider_id": primary,
        "selected_model_id": model_hint_s,
        "cascade_order": list(order),
        "fallback_chain": list(fallback),
        "is_execution_authority": False,
        "authority": AUTHORITY,
    }
    return route.model_copy(  # type: ignore[attr-defined]
        update={
            "primary_provider": new_primary,
            "fallback_chain": new_fallback,
            "policy_decisions": pd,
        }
    )


__all__ = [
    "AUTHORITY",
    "POLICY_NAME",
    "RUNTIME_VERSION",
    "apply_provider_cascade_to_route",
    "assert_provider_cascade_authority",
    "attach_provider_cascade_to_request",
    "build_provider_cascade_bundle",
    "provider_cascade_to_metadata",
    "should_apply_provider_cascade",
]
