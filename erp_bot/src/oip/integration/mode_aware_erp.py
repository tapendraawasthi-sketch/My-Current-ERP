"""Mode-aware ERP chat handler — orchestrates classify → authorize → draft/report.

Inserted ahead of legacy regex fast-path so incomplete purchases do not invent amounts.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ...orbix.mode_policy import (
    ModeCapabilities,
    ask_mode_mutation_message,
    mode_restriction_payload,
    normalize_orbix_mode,
    resolve_capabilities,
    user_may_post_purchase,
)
from ...orbix.operation_classifier import (
    OperationClass,
    classify_operation,
    is_mutating_operation,
)
from ...orbix.report_spec import (
    SUPPORTED_REPORTS,
    parse_report_specification,
    unsupported_report_message,
)
from ...khata.purchase_draft import (
    clarification_message,
    is_purchase_message,
    load_pending_draft,
    preview_message,
    save_draft,
    start_or_merge_purchase,
    to_confirmation_card,
)


@dataclass(frozen=True)
class ModeAwareResult:
    skip_llm: bool
    text: str
    card: dict[str, Any] | None = None
    intent: str | None = None
    method: str = "mode_aware"
    operation_class: str | None = None
    orbix_mode: str = "ask"
    capabilities: dict[str, bool] | None = None
    error: dict[str, Any] | None = None
    report_spec: dict[str, Any] | None = None
    draft_id: str | None = None


def handle_mode_aware_erp(
    message: str,
    *,
    orbix_mode: str | None = None,
    session_id: str = "",
    tenant_id: str = "",
    company_id: str = "",
    user_id: str = "",
    user_role: str | None = None,
    permissions: dict[str, Any] | None = None,
    has_active_report: bool = False,
    has_pending_confirmation: bool = False,
) -> ModeAwareResult | None:
    """Return a deterministic result when mode/classification handles the turn.

    Returns None to fall through to legacy preprocess / LLM for general chat.
    """
    mode = normalize_orbix_mode(orbix_mode, invalid_policy="ask")
    can_post = user_may_post_purchase(role=user_role, permissions=permissions)
    caps = resolve_capabilities(mode, can_post=can_post)

    pending = load_pending_draft(
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
    )
    classification = classify_operation(
        message,
        has_pending_draft=pending is not None and pending.status == "awaiting_clarification",
        has_active_report=has_active_report,
        has_pending_confirmation=has_pending_confirmation,
    )
    op = classification.operation_class

    # Normal greetings / questions — do not force transaction workflow
    if op == OperationClass.GENERAL_QUESTION and not pending:
        return None
    if op == OperationClass.ACCOUNTING_QUESTION:
        return None

    # Report requests — produce specification; live figures come from frontend engine
    if op in (OperationClass.REPORT_REQUEST, OperationClass.REPORT_FOLLOW_UP):
        spec = parse_report_specification(message, company_id=company_id)
        if spec and spec.report_type not in SUPPORTED_REPORTS:
            gap = unsupported_report_message(spec.report_type)
            return ModeAwareResult(
                skip_llm=True,
                text=gap["message"],
                intent="report_generation",
                method="report_spec",
                operation_class=op.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                error=gap,
                report_spec=spec.to_dict(),
            )
        if spec:
            return ModeAwareResult(
                skip_llm=False,  # let frontend/report engine or LLM explain; spec attached
                text="",
                intent="report_generation",
                method="report_spec",
                operation_class=op.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                report_spec=spec.to_dict(),
            )
        return None

    # Clarification merge into pending purchase draft
    if pending and op == OperationClass.CLARIFICATION_REPLY:
        return _process_purchase(
            message,
            mode=mode,
            caps=caps,
            session_id=session_id,
            tenant_id=tenant_id,
            company_id=company_id,
            user_id=user_id,
            existing=pending,
            operation_class=op,
        )

    # Transaction create / purchase
    if op == OperationClass.TRANSACTION_CREATE or is_purchase_message(message):
        if mode == "ask" or not caps.can_create_draft:
            return ModeAwareResult(
                skip_llm=True,
                text=ask_mode_mutation_message("purchase"),
                intent="mode_restriction",
                method="mode_policy",
                operation_class=OperationClass.TRANSACTION_CREATE.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                error=mode_restriction_payload(operation="transaction_create", can_preview=True),
            )
        return _process_purchase(
            message,
            mode=mode,
            caps=caps,
            session_id=session_id,
            tenant_id=tenant_id,
            company_id=company_id,
            user_id=user_id,
            existing=(
                pending
                if pending and pending.status in {"draft", "awaiting_clarification"}
                else None
            ),
            operation_class=OperationClass.TRANSACTION_CREATE,
        )

    # Other mutating ops in Ask mode
    if is_mutating_operation(op) and (mode == "ask" or not caps.can_create_draft):
        return ModeAwareResult(
            skip_llm=True,
            text=ask_mode_mutation_message(op.value),
            intent="mode_restriction",
            method="mode_policy",
            operation_class=op.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
            error=mode_restriction_payload(operation=op.value),
        )

    return None


def _process_purchase(
    message: str,
    *,
    mode: str,
    caps: ModeCapabilities,
    session_id: str,
    tenant_id: str,
    company_id: str,
    user_id: str,
    existing,
    operation_class: OperationClass,
) -> ModeAwareResult:
    draft = start_or_merge_purchase(
        message,
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        user_id=user_id,
        existing=existing,
    )
    save_draft(draft)

    if draft.status == "awaiting_clarification":
        return ModeAwareResult(
            skip_llm=True,
            text=clarification_message(draft),
            card=None,
            intent="purchase_entry",
            method="purchase_draft",
            operation_class=operation_class.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
            error={
                "type": "clarification_required",
                "draft_id": draft.draft_id,
                "missing_fields": draft.missing_fields,
                "ambiguous_fields": draft.ambiguous_fields,
            },
            draft_id=draft.draft_id,
        )

    card = to_confirmation_card(draft)
    return ModeAwareResult(
        skip_llm=True,
        text=preview_message(draft),
        card=card,
        intent="purchase_entry",
        method="purchase_draft",
        operation_class=operation_class.value,
        orbix_mode=mode,
        capabilities=caps.to_dict(),
        draft_id=draft.draft_id,
    )
