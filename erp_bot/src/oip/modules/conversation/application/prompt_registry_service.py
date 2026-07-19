"""MAI-23 — prompt template + structured-output schema annotation/consume.

Slice 1: select template id and schema ref from typed-plan event type.
Slice 2: format a system-prompt directive for provider assembly (guide only).
Never invokes models, mutates drafts, or grants posting authority.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.clarification_plan import ClarificationPlanStatus
from ....contracts.prompt_registry import (
    PromptRegistryAnalysisStatus,
    PromptRegistryBundleV1,
)
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.typed_plan import TypedPlanAnalysisStatus

RUNTIME_VERSION = "mai-23.0.2-slice2"
AUTHORITY = "ADR_0040"

# Deterministic engineering seed map (annotation refs only).
_TEMPLATE_BY_EVENT: dict[str, tuple[str, str]] = {
    "purchase": ("erp.purchase.preview.v1", "schemas/erp.purchase.preview.v1"),
    "sale": ("erp.sale.preview.v1", "schemas/erp.sale.preview.v1"),
    "sales": ("erp.sale.preview.v1", "schemas/erp.sale.preview.v1"),
    "purchase_return": (
        "erp.purchase_return.preview.v1",
        "schemas/erp.purchase_return.preview.v1",
    ),
    "sales_return": (
        "erp.sales_return.preview.v1",
        "schemas/erp.sales_return.preview.v1",
    ),
    "payment": ("erp.payment.preview.v1", "schemas/erp.payment.preview.v1"),
    "receipt": ("erp.receipt.preview.v1", "schemas/erp.receipt.preview.v1"),
    "report": ("erp.report.read.v1", "schemas/erp.report.read.v1"),
}


def build_prompt_registry_bundle(
    request: CanonicalAIRequestV1,
) -> PromptRegistryBundleV1:
    clarify = request.clarification_plan_bundle
    typed = request.typed_plan_bundle
    frame = request.event_frame
    event_type = None
    if typed is not None and typed.event_type:
        event_type = typed.event_type
    elif frame is not None:
        event_type = frame.event_type

    if clarify is not None and clarify.analysis_status == ClarificationPlanStatus.ASK:
        return PromptRegistryBundleV1(
            analysis_status=PromptRegistryAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=event_type,
            reason_codes=("CLARIFICATION_PENDING",),
            warnings=("CLARIFICATION_PENDING",),
        )

    if typed is None:
        return PromptRegistryBundleV1(
            analysis_status=PromptRegistryAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=event_type,
            reason_codes=("NO_TYPED_PLAN",),
            warnings=("NO_TYPED_PLAN",),
        )

    if typed.analysis_status != TypedPlanAnalysisStatus.COMPLETE:
        return PromptRegistryBundleV1(
            analysis_status=PromptRegistryAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=event_type,
            reason_codes=("TYPED_PLAN_SKIP",),
            warnings=("TYPED_PLAN_NOT_COMPLETE",),
        )

    mapping = _TEMPLATE_BY_EVENT.get(event_type or "")
    if mapping is None:
        return PromptRegistryBundleV1(
            analysis_status=PromptRegistryAnalysisStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=event_type,
            reason_codes=("NO_TEMPLATE_FOR_EVENT",),
            warnings=("NO_TEMPLATE_FOR_EVENT",),
        )

    template_id, schema_ref = mapping
    return PromptRegistryBundleV1(
        analysis_status=PromptRegistryAnalysisStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        event_type=event_type,
        selected_prompt_template_id=template_id,
        structured_output_schema_ref=schema_ref,
        reason_codes=("TYPED_PLAN_COMPLETE", "DETERMINISTIC_TEMPLATE_MAP"),
        silent_applications=0,
        draft_mutations=0,
        model_invocations=0,
    )


def attach_prompt_registry_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_prompt_registry_bundle(request)
    return request.model_copy(update={"prompt_registry_bundle": bundle})


def assert_prompt_registry_authority(
    bundle: PromptRegistryBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.silent_applications != 0
        or bundle.draft_mutations != 0
        or bundle.model_invocations != 0
    ):
        raise RuntimeError("PROMPT_REGISTRY_AUTHORITY")


def prompt_registry_to_metadata(
    bundle: PromptRegistryBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "event_type": bundle.event_type,
        "selected_prompt_template_id": bundle.selected_prompt_template_id,
        "structured_output_schema_ref": bundle.structured_output_schema_ref,
        "reason_codes": list(bundle.reason_codes),
        "silent_applications": bundle.silent_applications,
        "draft_mutations": bundle.draft_mutations,
        "model_invocations": bundle.model_invocations,
        "is_execution_authority": False,
    }


def should_apply_prompt_registry(
    prompt_registry: Mapping[str, Any] | None,
) -> bool:
    if not isinstance(prompt_registry, Mapping):
        return False
    if prompt_registry.get("is_execution_authority") is True:
        return False
    if int(prompt_registry.get("model_invocations") or 0) != 0:
        return False
    if int(prompt_registry.get("draft_mutations") or 0) != 0:
        return False
    if str(prompt_registry.get("analysis_status") or "") != (
        PromptRegistryAnalysisStatus.COMPLETE.value
    ):
        return False
    return bool(
        str(prompt_registry.get("selected_prompt_template_id") or "").strip()
    )


def format_prompt_registry_directive(
    prompt_registry: Mapping[str, Any] | PromptRegistryBundleV1 | None,
) -> str:
    """Return a system-prompt guide block, or empty when not applicable."""
    if prompt_registry is None:
        return ""
    if isinstance(prompt_registry, PromptRegistryBundleV1):
        data = prompt_registry_to_metadata(prompt_registry)
    else:
        data = dict(prompt_registry)
    if not should_apply_prompt_registry(data):
        return ""

    template_id = str(data.get("selected_prompt_template_id") or "").strip()
    schema_ref = str(data.get("structured_output_schema_ref") or "").strip()
    event_type = str(data.get("event_type") or "").strip() or "-"
    lines = [
        "=== PROMPT REGISTRY / STRUCTURED OUTPUT (MAI-23) ===",
        f"Selected template: {template_id}",
        f"Structured output schema ref: {schema_ref or '-'}",
        f"Event type: {event_type}",
        "Instructions:",
        "- Prefer this template's intent for reply shape and field focus.",
        "- When emitting structured fields, align with the schema ref.",
        "- Do not invent accounting facts or grant posting authority.",
        "- Do not execute confirm/post tools from this directive alone.",
        "=== END PROMPT REGISTRY / STRUCTURED OUTPUT ===",
    ]
    return "\n".join(lines)


def append_prompt_registry_to_system_prompt(
    base_prompt: str,
    prompt_registry: Mapping[str, Any] | PromptRegistryBundleV1 | None,
) -> str:
    base = (base_prompt or "").rstrip()
    block = format_prompt_registry_directive(prompt_registry).strip()
    if not block:
        return base
    return f"{base}\n\n{block}"


__all__ = [
    "AUTHORITY",
    "RUNTIME_VERSION",
    "append_prompt_registry_to_system_prompt",
    "assert_prompt_registry_authority",
    "attach_prompt_registry_to_request",
    "build_prompt_registry_bundle",
    "format_prompt_registry_directive",
    "prompt_registry_to_metadata",
    "should_apply_prompt_registry",
]
