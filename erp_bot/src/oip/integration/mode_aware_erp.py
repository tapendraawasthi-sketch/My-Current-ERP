"""Mode-aware ERP chat handler — orchestrates classify → authorize → draft/report.

Inserted ahead of legacy regex fast-path so incomplete purchases/sales do not invent amounts.
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
    clarification_message as purchase_clarification_message,
    is_purchase_message,
    load_pending_draft as load_pending_purchase,
    preview_message as purchase_preview_message,
    save_draft as save_purchase_draft,
    start_or_merge_purchase,
    to_confirmation_card as purchase_to_confirmation_card,
)
from ...khata.sales_draft import (
    clarification_message as sales_clarification_message,
    is_sale_message,
    load_pending_draft as load_pending_sale,
    preview_message as sales_preview_message,
    save_draft as save_sales_draft,
    start_or_merge_sale,
    to_confirmation_card as sales_to_confirmation_card,
)
from ...khata.sales_return_draft import (
    clarification_message as sales_return_clarification_message,
    is_financial_credit_note_message,
    is_sales_return_message,
    load_pending_draft as load_pending_return,
    preview_message as sales_return_preview_message,
    save_draft as save_sales_return_draft,
    start_or_merge_return,
    to_confirmation_card as sales_return_to_confirmation_card,
)
from ...khata.purchase_return_draft import (
    clarification_message as purchase_return_clarification_message,
    is_financial_supplier_debit_note_message,
    is_purchase_return_message,
    load_pending_draft as load_pending_purchase_return,
    preview_message as purchase_return_preview_message,
    save_draft as save_purchase_return_draft,
    start_or_merge_return as start_or_merge_purchase_return,
    to_confirmation_card as purchase_return_to_confirmation_card,
)
from ...khata.financial_draft import (
    clarification_message as financial_clarification_message,
    explanation_response as financial_explanation_response,
    is_explanation_query as is_financial_explanation_query,
    load_pending_draft as load_pending_financial,
    prefer_financial_settlement,
    preview_message as financial_preview_message,
    save_draft as save_financial_draft,
    start_or_merge_financial,
    to_confirmation_card as financial_to_confirmation_card,
)
from ...khata.bank_recon_draft import (
    bank_recon_explanation_response,
    bank_recon_forecast_response,
    bank_recon_status_response,
    bank_recon_treasury_response,
    clarification_message as bank_recon_clarification_message,
    detect_bank_recon_kind,
    is_bank_recon_explanation_query,
    is_bank_recon_forecast_query,
    is_bank_recon_read_only_kind,
    is_bank_recon_status_query,
    load_pending_draft as load_pending_bank_recon,
    prefer_bank_recon,
    preview_message as bank_recon_preview_message,
    save_draft as save_bank_recon_draft,
    start_or_merge_bank_recon,
    to_confirmation_card as bank_recon_to_confirmation_card,
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
    applied_correction: dict[str, Any] | None = None


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
    draft_id: str | None = None,
    last_party: str | None = None,
    recent_parties: list[str] | None = None,
    turn_relation: dict[str, Any] | None = None,
    reference_coreference: dict[str, Any] | None = None,
    router_decision: dict[str, Any] | None = None,
) -> ModeAwareResult | None:
    """Return a deterministic result when mode/classification handles the turn.

    Returns None to fall through to legacy preprocess / LLM for general chat.
    """
    from .nepali_shop_nlu import handle_shop_nlu, is_greeting_message

    mode = normalize_orbix_mode(orbix_mode, invalid_policy="ask")
    can_post = user_may_post_purchase(role=user_role, permissions=permissions)
    caps = resolve_capabilities(mode, can_post=can_post)

    # MAI-01 — deny-by-default constitution before any draft merge/persist.
    # Import constitution OperationClass under a distinct name so a failed try
    # does not shadow the module-level orbix OperationClass (UnboundLocalError).
    try:
        from ..config.settings import get_oip_settings
        from ..domain.constitution import OperationClass as ConstitutionOperationClass
        from ..domain.constitution.enforcement import enforce_draft_operation
        from ..domain.constitution.config_guard import insecure_dev_identity_allowed
        from ..infrastructure.security.session_context import current_principal

        settings = get_oip_settings()
        if mode == "accountant" and (
            settings.auth_required or not insecure_dev_identity_allowed()
        ):
            if current_principal() is None and not insecure_dev_identity_allowed():
                if settings.auth_required:
                    _, decision = enforce_draft_operation(
                        orbix_mode=mode,
                        operation=ConstitutionOperationClass.CREATE_PERSISTED_DRAFT,
                        requested_tenant_id=tenant_id or None,
                        requested_company_id=company_id or None,
                    )
                    if not decision.allowed:
                        return ModeAwareResult(
                            skip_llm=True,
                            text=decision.safe_user_message
                            or "Authentication is required before preparing accounting drafts.",
                            card=None,
                            intent="policy_denied",
                            method="mai01_constitution",
                            orbix_mode=mode,
                            error={
                                "type": "permission_denied",
                                "code": decision.decision_code.value,
                                "policy_version": decision.policy_version,
                            },
                        )
        if mode == "ask":
            # Defense in depth: Ask never persists drafts even if later regex matches.
            caps = resolve_capabilities("ask", can_post=False)
    except Exception:
        # Fail closed for mutation capabilities if policy stack errors.
        if mode == "ask":
            caps = resolve_capabilities("ask", can_post=False)

    pending_purchase = load_pending_purchase(
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        draft_id=draft_id,
    )
    pending_sale = load_pending_sale(
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        draft_id=draft_id,
    )
    pending_return = load_pending_return(
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        draft_id=draft_id,
    )
    pending_purchase_return = load_pending_purchase_return(
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        draft_id=draft_id,
    )
    pending_financial = load_pending_financial(
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        draft_id=draft_id,
    )
    pending_bank_recon = load_pending_bank_recon(
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        draft_id=draft_id,
    )

    # Prefer the draft that matches an explicit draft_id, else the one awaiting clarification.
    pending = None
    pending_kind: str | None = None
    if draft_id and pending_bank_recon and pending_bank_recon.draft_id == draft_id:
        pending, pending_kind = pending_bank_recon, "bank_recon"
    elif draft_id and pending_financial and pending_financial.draft_id == draft_id:
        pending, pending_kind = pending_financial, "financial"
    elif draft_id and pending_purchase_return and pending_purchase_return.draft_id == draft_id:
        pending, pending_kind = pending_purchase_return, "purchase_return"
    elif draft_id and pending_return and pending_return.draft_id == draft_id:
        pending, pending_kind = pending_return, "return"
    elif draft_id and pending_sale and pending_sale.draft_id == draft_id:
        pending, pending_kind = pending_sale, "sale"
    elif draft_id and pending_purchase and pending_purchase.draft_id == draft_id:
        pending, pending_kind = pending_purchase, "purchase"
    elif pending_bank_recon and pending_bank_recon.status == "awaiting_clarification":
        # Do not continue a stale bank-recon clarification when the user clearly
        # started a settlement/contra utterance (Phase 9 must win).
        if prefer_financial_settlement(message) and not prefer_bank_recon(message):
            pending, pending_kind = None, None
        else:
            pending, pending_kind = pending_bank_recon, "bank_recon"
    elif pending_financial and pending_financial.status == "awaiting_clarification":
        pending, pending_kind = pending_financial, "financial"
    elif pending_purchase_return and pending_purchase_return.status == "awaiting_clarification":
        pending, pending_kind = pending_purchase_return, "purchase_return"
    elif pending_return and pending_return.status == "awaiting_clarification":
        pending, pending_kind = pending_return, "return"
    elif pending_sale and pending_sale.status == "awaiting_clarification":
        pending, pending_kind = pending_sale, "sale"
    elif pending_purchase and pending_purchase.status == "awaiting_clarification":
        pending, pending_kind = pending_purchase, "purchase"
    elif pending_bank_recon:
        if prefer_financial_settlement(message) and not prefer_bank_recon(message):
            pending, pending_kind = (pending_financial, "financial") if pending_financial else (None, None)
        else:
            pending, pending_kind = pending_bank_recon, "bank_recon"
    elif pending_financial:
        pending, pending_kind = pending_financial, "financial"
    elif pending_purchase_return:
        pending, pending_kind = pending_purchase_return, "purchase_return"
    elif pending_return:
        pending, pending_kind = pending_return, "return"
    elif pending_sale:
        pending, pending_kind = pending_sale, "sale"
    elif pending_purchase:
        pending, pending_kind = pending_purchase, "purchase"

    # MAI-14 slice 2: clear pending before classify/merge when turn-relation
    # forbids binding (NEW_TOPIC / UNKNOWN / CONFIRMATION / CANCEL / FAILED).
    # ``turn_relation=None`` keeps legacy unit-test behavior.
    try:
        from ..modules.conversation.application.turn_relation_service import (
            allows_pending_merge,
        )

        if not allows_pending_merge(turn_relation):
            pending = None
            pending_kind = None
            pending_purchase = None
            pending_sale = None
            pending_return = None
            pending_purchase_return = None
            pending_financial = None
            pending_bank_recon = None
            draft_id = None
    except Exception:  # noqa: BLE001
        # Fail closed when gate helper errors and metadata was provided.
        if turn_relation is not None:
            pending = None
            pending_kind = None
            pending_purchase = None
            pending_sale = None
            pending_return = None
            pending_purchase_return = None
            pending_financial = None
            pending_bank_recon = None
            draft_id = None

    classification = classify_operation(
        message,
        has_pending_draft=pending is not None and pending.status == "awaiting_clarification",
        has_active_report=has_active_report,
        has_pending_confirmation=has_pending_confirmation,
    )
    op = classification.operation_class

    # MAI-15 slice 2: amount correction overlay (CORRECT + parseable AMOUNT only).
    correction_overlay: dict[str, Any] = {}
    try:
        from ..modules.conversation.application.reference_coreference_service import (
            select_amount_correction_overlay,
        )

        if pending is not None:
            correction_overlay = select_amount_correction_overlay(
                reference_coreference=reference_coreference,
                turn_relation=turn_relation,
                pending_kind=pending_kind,
            )
    except Exception:  # noqa: BLE001
        correction_overlay = {}
    field_overrides: dict[str, Any] = {}
    if correction_overlay.get("total_amount") is not None:
        field_overrides = {"total_amount": correction_overlay["total_amount"]}

    # MAI-17 slice 2: OOD abstain / family gate — clarify; never silent draft writes.
    try:
        from ..modules.conversation.application.hierarchical_router_service import (
            router_abstain_user_message,
            should_abstain_router_decision,
        )

        pending_clarify = (
            pending is not None
            and getattr(pending, "status", None) == "awaiting_clarification"
        )
        if should_abstain_router_decision(
            router_decision,
            has_pending_clarify=pending_clarify,
            turn_relation=turn_relation,
            operation_class=op.value if op is not None else None,
        ):
            return ModeAwareResult(
                skip_llm=True,
                text=router_abstain_user_message(router_decision),
                intent="router_ood_abstain",
                method="mai17_router_ood_gate",
                operation_class=OperationClass.GENERAL_QUESTION.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                error={
                    "code": "ROUTER_OOD_ABSTAIN",
                    "ood": (router_decision or {}).get("ood")
                    if isinstance(router_decision, dict)
                    else None,
                    "domain": (router_decision or {}).get("domain")
                    if isinstance(router_decision, dict)
                    else None,
                    "intent_family": (router_decision or {}).get("intent_family")
                    if isinstance(router_decision, dict)
                    else None,
                },
            )
    except Exception:  # noqa: BLE001
        # Fail closed only when metadata was provided.
        if router_decision is not None:
            return ModeAwareResult(
                skip_llm=True,
                text=(
                    "I could not map that to a clear ERP action. "
                    "Please rephrase your request."
                ),
                intent="router_ood_abstain",
                method="mai17_router_ood_gate",
                operation_class=OperationClass.GENERAL_QUESTION.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                error={"code": "ROUTER_OOD_GATE_FAILED"},
            )

    # Phase 10 bank recon explanations - before settlement, never mutate
    if is_bank_recon_explanation_query(message):
        return ModeAwareResult(
            skip_llm=True,
            text=bank_recon_explanation_response(message),
            intent="accounting_qa",
            method="bank_recon_draft",
            operation_class=OperationClass.ACCOUNTING_QUESTION.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
        )

    # Phase 10 read-only status / forecast / treasury — no confirm-post card
    if is_bank_recon_status_query(message):
        return ModeAwareResult(
            skip_llm=True,
            text=bank_recon_status_response(message),
            intent="accounting_qa",
            method="bank_recon_draft",
            operation_class=OperationClass.ACCOUNTING_QUESTION.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
        )
    if is_bank_recon_forecast_query(message):
        return ModeAwareResult(
            skip_llm=True,
            text=bank_recon_forecast_response(message),
            intent="accounting_qa",
            method="bank_recon_draft",
            operation_class=OperationClass.ACCOUNTING_QUESTION.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
        )

    # Phase 9 settlement explanations - before fallthrough, never mutate
    if is_financial_explanation_query(message):
        lower = message.lower()
        if any(
            k in lower
            for k in (
                "receipt",
                "payment",
                "contra",
                "journal",
                "settlement",
                "allocate",
                "advance",
            )
        ):
            return ModeAwareResult(
                skip_llm=True,
                text=financial_explanation_response(message),
                intent="accounting_qa",
                method="financial_draft",
                operation_class=OperationClass.ACCOUNTING_QUESTION.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
            )

    # Prefer bank recon (statement/cheque/treasury language) before settlement
    if prefer_bank_recon(message) and not pending:
        kind = detect_bank_recon_kind(message)
        # Read-only treasury queries: never ask-mode deny, never confirmation card
        if kind == "treasury_query" or is_bank_recon_read_only_kind(kind):
            return ModeAwareResult(
                skip_llm=True,
                text=bank_recon_treasury_response(message),
                intent="treasury_position_query",
                method="bank_recon_draft",
                operation_class=OperationClass.ACCOUNTING_QUESTION.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
            )
        label = "bank reconciliation"
        if mode == "ask" or not caps.can_create_draft:
            return ModeAwareResult(
                skip_llm=True,
                text=ask_mode_mutation_message(label),
                intent="mode_restriction",
                method="mode_policy",
                operation_class=OperationClass.TRANSACTION_CREATE.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                error=mode_restriction_payload(operation="transaction_create", can_preview=True),
            )
        return _process_bank_recon(
            message,
            mode=mode,
            caps=caps,
            session_id=session_id,
            tenant_id=tenant_id,
            company_id=company_id,
            user_id=user_id,
            existing=None,
            operation_class=OperationClass.TRANSACTION_CREATE,
        )

    # Prefer settlement even when classifier returns general_question (e.g. bare debit/credit JE)
    if prefer_financial_settlement(message) and not pending:
        label = "settlement"
        if mode == "ask" or not caps.can_create_draft:
            return ModeAwareResult(
                skip_llm=True,
                text=ask_mode_mutation_message(label),
                intent="mode_restriction",
                method="mode_policy",
                operation_class=OperationClass.TRANSACTION_CREATE.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                error=mode_restriction_payload(operation="transaction_create", can_preview=True),
            )
        return _process_financial(
            message,
            mode=mode,
            caps=caps,
            session_id=session_id,
            tenant_id=tenant_id,
            company_id=company_id,
            user_id=user_id,
            existing=None,
            operation_class=OperationClass.TRANSACTION_CREATE,
        )

    if op == OperationClass.GENERAL_QUESTION and not pending:
        # Greeting must never fall through to Language KB / encyclopedia LLM.
        if (classification.intent_hint == "greeting") or is_greeting_message(message):
            shop = handle_shop_nlu(message, session_id=session_id)
            if shop and shop.skip_llm:
                return ModeAwareResult(
                    skip_llm=True,
                    text=shop.text,
                    intent=shop.intent,
                    method=shop.method,
                    operation_class=op.value,
                    orbix_mode=mode,
                    capabilities=caps.to_dict(),
                )
        return None

    if op == OperationClass.ERP_DATA_QUERY:
        shop = handle_shop_nlu(
            message,
            session_id=session_id,
            last_party=last_party,
            recent_parties=recent_parties,
        )
        if shop and shop.skip_llm:
            return ModeAwareResult(
                skip_llm=True,
                text=shop.text,
                intent=shop.intent,
                method=shop.method,
                operation_class=op.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
            )
        return None

    # Accounting / VAT explanation questions fall through to LLM - never mutate
    if op == OperationClass.ACCOUNTING_QUESTION:
        return None

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
                skip_llm=False,
                text="",
                intent="report_generation",
                method="report_spec",
                operation_class=op.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                report_spec=spec.to_dict(),
            )
        return None

    # Clarification / CORRECT merge into pending draft.
    # MAI-15: amount overlays also force purchase/sale process when CORRECT.
    force_amount_correct = bool(field_overrides) and pending_kind in {"purchase", "sale"}
    if pending and (op == OperationClass.CLARIFICATION_REPLY or force_amount_correct):
        if pending_kind == "bank_recon" and not force_amount_correct:
            return _process_bank_recon(
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
        if pending_kind == "financial" and not force_amount_correct:
            return _process_financial(
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
        if pending_kind == "purchase_return" and not force_amount_correct:
            return _process_purchase_return(
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
        if pending_kind == "return" and not force_amount_correct:
            return _process_sales_return(
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
        if pending_kind == "sale":
            return _process_sale(
                message,
                mode=mode,
                caps=caps,
                session_id=session_id,
                tenant_id=tenant_id,
                company_id=company_id,
                user_id=user_id,
                existing=pending,
                operation_class=op,
                field_overrides=field_overrides or None,
                correction_overlay=correction_overlay or None,
            )
        if pending_kind == "purchase" or force_amount_correct:
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
                field_overrides=field_overrides or None,
                correction_overlay=correction_overlay or None,
            )

    purchase_return_signal = (
        is_purchase_return_message(message) or is_financial_supplier_debit_note_message(message)
    )
    return_signal = is_sales_return_message(message) or is_financial_credit_note_message(message)
    sale_signal = is_sale_message(message)
    purchase_signal = is_purchase_message(message)
    financial_signal = prefer_financial_settlement(message)
    bank_recon_signal = prefer_bank_recon(message)

    # Purchase return / supplier debit note — checked BEFORE sales returns and
    # purchases so purchase-side intents (which also match bare "returned"/"purchase")
    # are never stolen by the sales-return or purchase-entry paths.
    if purchase_return_signal:
        label = (
            "debit note"
            if is_financial_supplier_debit_note_message(message)
            else "purchase return"
        )
        if mode == "ask" or not caps.can_create_draft:
            return ModeAwareResult(
                skip_llm=True,
                text=ask_mode_mutation_message(label),
                intent="mode_restriction",
                method="mode_policy",
                operation_class=OperationClass.TRANSACTION_CREATE.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                error=mode_restriction_payload(operation="transaction_create", can_preview=True),
            )
        return _process_purchase_return(
            message,
            mode=mode,
            caps=caps,
            session_id=session_id,
            tenant_id=tenant_id,
            company_id=company_id,
            user_id=user_id,
            existing=(
                pending_purchase_return
                if pending_purchase_return
                and pending_purchase_return.status in {"draft", "awaiting_clarification"}
                else None
            ),
            operation_class=OperationClass.TRANSACTION_CREATE,
        )


    # Bank recon before settlement so reconcile/statement/cheque language is not stolen.
    # Never steal Phase 9 contra/transfer settlement phrasing.
    if (
        bank_recon_signal
        and not purchase_return_signal
        and not return_signal
        and not (financial_signal and not prefer_bank_recon(message))
    ):
        kind = detect_bank_recon_kind(message)
        if kind == "treasury_query" or is_bank_recon_read_only_kind(kind):
            return ModeAwareResult(
                skip_llm=True,
                text=bank_recon_treasury_response(message),
                intent="treasury_position_query",
                method="bank_recon_draft",
                operation_class=OperationClass.ACCOUNTING_QUESTION.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
            )
        label = "bank reconciliation"
        if mode == "ask" or not caps.can_create_draft:
            return ModeAwareResult(
                skip_llm=True,
                text=ask_mode_mutation_message(label),
                intent="mode_restriction",
                method="mode_policy",
                operation_class=OperationClass.TRANSACTION_CREATE.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                error=mode_restriction_payload(operation="transaction_create", can_preview=True),
            )
        return _process_bank_recon(
            message,
            mode=mode,
            caps=caps,
            session_id=session_id,
            tenant_id=tenant_id,
            company_id=company_id,
            user_id=user_id,
            existing=(
                pending_bank_recon
                if pending_bank_recon
                and pending_bank_recon.status in {"draft", "awaiting_clarification", "previewed"}
                else None
            ),
            operation_class=OperationClass.TRANSACTION_CREATE,
        )

    # Financial settlement (receipt / payment / contra / journal) — after purchase-return
    # check so returns are not stolen; before sale/purchase so "Paid/Received" is not inventory.
    if financial_signal and not purchase_return_signal and not return_signal and not bank_recon_signal:
        label = "settlement"
        if mode == "ask" or not caps.can_create_draft:
            return ModeAwareResult(
                skip_llm=True,
                text=ask_mode_mutation_message(label),
                intent="mode_restriction",
                method="mode_policy",
                operation_class=OperationClass.TRANSACTION_CREATE.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                error=mode_restriction_payload(operation="transaction_create", can_preview=True),
            )
        return _process_financial(
            message,
            mode=mode,
            caps=caps,
            session_id=session_id,
            tenant_id=tenant_id,
            company_id=company_id,
            user_id=user_id,
            existing=(
                pending_financial
                if pending_financial
                and pending_financial.status in {"draft", "awaiting_clarification", "previewed"}
                else None
            ),
            operation_class=OperationClass.TRANSACTION_CREATE,
        )

    # Prefer return/CN over sale when both present (e.g. "return the sale…")
    if return_signal:
        label = (
            "credit note"
            if is_financial_credit_note_message(message)
            else "sales return"
        )
        if mode == "ask" or not caps.can_create_draft:
            return ModeAwareResult(
                skip_llm=True,
                text=ask_mode_mutation_message(label),
                intent="mode_restriction",
                method="mode_policy",
                operation_class=OperationClass.TRANSACTION_CREATE.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                error=mode_restriction_payload(operation="transaction_create", can_preview=True),
            )
        return _process_sales_return(
            message,
            mode=mode,
            caps=caps,
            session_id=session_id,
            tenant_id=tenant_id,
            company_id=company_id,
            user_id=user_id,
            existing=(
                pending_return
                if pending_return and pending_return.status in {"draft", "awaiting_clarification"}
                else None
            ),
            operation_class=OperationClass.TRANSACTION_CREATE,
        )

    # Transaction create — route sales vs purchase by language signal
    if op == OperationClass.TRANSACTION_CREATE or sale_signal or purchase_signal:
        kind = "sale" if sale_signal and not purchase_signal else (
            "purchase" if purchase_signal and not sale_signal else (
                pending_kind or ("sale" if sale_signal else "purchase")
            )
        )
        # Ambiguous "transaction" wording without sold/bought: prefer pending kind
        if not sale_signal and not purchase_signal and pending_kind in {"sale", "purchase"}:
            kind = pending_kind
        elif not sale_signal and not purchase_signal and "sale" in message.lower():
            kind = "sale"

        label = "sale" if kind == "sale" else "purchase"
        if mode == "ask" or not caps.can_create_draft:
            return ModeAwareResult(
                skip_llm=True,
                text=ask_mode_mutation_message(label),
                intent="mode_restriction",
                method="mode_policy",
                operation_class=OperationClass.TRANSACTION_CREATE.value,
                orbix_mode=mode,
                capabilities=caps.to_dict(),
                error=mode_restriction_payload(operation="transaction_create", can_preview=True),
            )

        if kind == "sale":
            return _process_sale(
                message,
                mode=mode,
                caps=caps,
                session_id=session_id,
                tenant_id=tenant_id,
                company_id=company_id,
                user_id=user_id,
                existing=(
                    pending_sale
                    if pending_sale and pending_sale.status in {"draft", "awaiting_clarification"}
                    else None
                ),
                operation_class=OperationClass.TRANSACTION_CREATE,
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
                pending_purchase
                if pending_purchase and pending_purchase.status in {"draft", "awaiting_clarification"}
                else None
            ),
            operation_class=OperationClass.TRANSACTION_CREATE,
        )

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
    field_overrides: dict[str, Any] | None = None,
    correction_overlay: dict[str, Any] | None = None,
) -> ModeAwareResult:
    draft = start_or_merge_purchase(
        message,
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        user_id=user_id,
        existing=existing,
        field_overrides=field_overrides,
    )
    save_purchase_draft(draft)
    applied_correction = None
    if correction_overlay and field_overrides:
        from ..modules.conversation.application.reference_coreference_service import (
            build_applied_correction_receipt,
        )

        applied_correction = build_applied_correction_receipt(
            overlay=correction_overlay,
            draft_id=draft.draft_id,
        )

    if draft.status == "awaiting_clarification":
        captured: list[dict[str, Any]] = []
        if draft.item and draft.item.name:
            captured.append(
                {
                    "field": "item",
                    "label": "Item",
                    "value": draft.item.name,
                    "display_value": draft.item.name,
                    "confidence": draft.confidence.get("item", 0.9),
                }
            )
        if draft.quantity is not None:
            captured.append(
                {
                    "field": "quantity",
                    "label": "Quantity",
                    "value": str(draft.quantity),
                    "display_value": str(draft.quantity),
                }
            )
        if draft.supplier and draft.supplier.name:
            captured.append(
                {
                    "field": "supplier",
                    "label": "Supplier",
                    "value": draft.supplier.name,
                    "display_value": draft.supplier.name,
                }
            )
        return ModeAwareResult(
            skip_llm=True,
            text=purchase_clarification_message(draft),
            card=None,
            intent="purchase_entry",
            method="purchase_draft",
            operation_class=operation_class.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
            error={
                "type": "clarification_required",
                "draft_id": draft.draft_id,
                "transaction_type": "purchase",
                "draft_status": draft.status,
                "missing_fields": draft.missing_fields,
                "ambiguous_fields": draft.ambiguous_fields,
                "captured_fields": captured,
                "nothing_posted": True,
            },
            draft_id=draft.draft_id,
            applied_correction=applied_correction,
        )

    card = purchase_to_confirmation_card(draft)
    return ModeAwareResult(
        skip_llm=True,
        text=purchase_preview_message(draft),
        card=card,
        intent="purchase_entry",
        method="purchase_draft",
        operation_class=operation_class.value,
        orbix_mode=mode,
        capabilities=caps.to_dict(),
        draft_id=draft.draft_id,
        applied_correction=applied_correction,
    )


def _process_sale(
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
    field_overrides: dict[str, Any] | None = None,
    correction_overlay: dict[str, Any] | None = None,
) -> ModeAwareResult:
    draft = start_or_merge_sale(
        message,
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        user_id=user_id,
        existing=existing,
        field_overrides=field_overrides,
    )
    save_sales_draft(draft)
    applied_correction = None
    if correction_overlay and field_overrides:
        from ..modules.conversation.application.reference_coreference_service import (
            build_applied_correction_receipt,
        )

        applied_correction = build_applied_correction_receipt(
            overlay=correction_overlay,
            draft_id=draft.draft_id,
        )

    if draft.status == "awaiting_clarification":
        captured: list[dict[str, Any]] = []
        if draft.item and draft.item.name:
            captured.append(
                {
                    "field": "item",
                    "label": "Item",
                    "value": draft.item.name,
                    "display_value": draft.item.name,
                    "confidence": draft.confidence.get("item", 0.9),
                }
            )
        if draft.quantity is not None:
            captured.append(
                {
                    "field": "quantity",
                    "label": "Quantity",
                    "value": str(draft.quantity),
                    "display_value": str(draft.quantity),
                }
            )
        if draft.customer and draft.customer.name:
            captured.append(
                {
                    "field": "customer",
                    "label": "Customer",
                    "value": draft.customer.name,
                    "display_value": draft.customer.name,
                }
            )
        return ModeAwareResult(
            skip_llm=True,
            text=sales_clarification_message(draft),
            card=None,
            intent="sale_entry",
            method="sales_draft",
            operation_class=operation_class.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
            error={
                "type": "clarification_required",
                "draft_id": draft.draft_id,
                "transaction_type": "sale",
                "draft_status": draft.status,
                "missing_fields": draft.missing_fields,
                "ambiguous_fields": draft.ambiguous_fields,
                "captured_fields": captured,
                "nothing_posted": True,
            },
            draft_id=draft.draft_id,
            applied_correction=applied_correction,
        )

    card = sales_to_confirmation_card(draft)
    return ModeAwareResult(
        skip_llm=True,
        text=sales_preview_message(draft),
        card=card,
        intent="sale_entry",
        method="sales_draft",
        operation_class=operation_class.value,
        orbix_mode=mode,
        capabilities=caps.to_dict(),
        draft_id=draft.draft_id,
        applied_correction=applied_correction,
    )


def _process_sales_return(
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
    draft = start_or_merge_return(
        message,
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        user_id=user_id,
        existing=existing,
    )
    save_sales_return_draft(draft)

    adj = draft.adjustment_type or "inventory_sales_return"
    txn_label = "financial_credit_note" if adj == "financial_credit_note" else "inventory_sales_return"

    if draft.status == "awaiting_clarification":
        captured: list[dict[str, Any]] = []
        if draft.original_invoice_no:
            captured.append(
                {
                    "field": "original_invoice_no",
                    "label": "Original invoice",
                    "value": draft.original_invoice_no,
                    "display_value": draft.original_invoice_no,
                }
            )
        if draft.item and draft.item.name:
            captured.append(
                {
                    "field": "item",
                    "label": "Item",
                    "value": draft.item.name,
                    "display_value": draft.item.name,
                }
            )
        if draft.quantity is not None:
            captured.append(
                {
                    "field": "quantity",
                    "label": "Quantity",
                    "value": str(draft.quantity),
                    "display_value": str(draft.quantity),
                }
            )
        if draft.customer and draft.customer.name:
            captured.append(
                {
                    "field": "customer",
                    "label": "Customer",
                    "value": draft.customer.name,
                    "display_value": draft.customer.name,
                }
            )
        if draft.financial_amount is not None:
            captured.append(
                {
                    "field": "financial_amount",
                    "label": "Amount",
                    "value": str(draft.financial_amount),
                    "display_value": str(draft.financial_amount),
                }
            )
        return ModeAwareResult(
            skip_llm=True,
            text=sales_return_clarification_message(draft),
            card=None,
            intent="sales_return_entry",
            method="sales_return_draft",
            operation_class=operation_class.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
            error={
                "type": "clarification_required",
                "draft_id": draft.draft_id,
                "transaction_type": txn_label,
                "draft_status": draft.status,
                "missing_fields": draft.missing_fields,
                "ambiguous_fields": draft.ambiguous_fields,
                "captured_fields": captured,
                "nothing_posted": True,
            },
            draft_id=draft.draft_id,
        )

    card = sales_return_to_confirmation_card(draft)
    return ModeAwareResult(
        skip_llm=True,
        text=sales_return_preview_message(draft),
        card=card,
        intent="sales_return_entry",
        method="sales_return_draft",
        operation_class=operation_class.value,
        orbix_mode=mode,
        capabilities=caps.to_dict(),
        draft_id=draft.draft_id,
    )


def _process_purchase_return(
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
    draft = start_or_merge_purchase_return(
        message,
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        user_id=user_id,
        existing=existing,
    )
    save_purchase_return_draft(draft)

    adj = draft.adjustment_type or "inventory_purchase_return"
    txn_label = (
        "financial_supplier_debit_note"
        if adj == "financial_supplier_debit_note"
        else "inventory_purchase_return"
    )

    if draft.status == "awaiting_clarification":
        captured: list[dict[str, Any]] = []
        if draft.original_invoice_no:
            captured.append(
                {
                    "field": "original_invoice_no",
                    "label": "Original invoice",
                    "value": draft.original_invoice_no,
                    "display_value": draft.original_invoice_no,
                }
            )
        if draft.item and draft.item.name:
            captured.append(
                {
                    "field": "item",
                    "label": "Item",
                    "value": draft.item.name,
                    "display_value": draft.item.name,
                }
            )
        if draft.quantity is not None:
            captured.append(
                {
                    "field": "quantity",
                    "label": "Quantity",
                    "value": str(draft.quantity),
                    "display_value": str(draft.quantity),
                }
            )
        if draft.supplier and draft.supplier.name:
            captured.append(
                {
                    "field": "supplier",
                    "label": "Supplier",
                    "value": draft.supplier.name,
                    "display_value": draft.supplier.name,
                }
            )
        if draft.financial_amount is not None:
            captured.append(
                {
                    "field": "financial_amount",
                    "label": "Amount",
                    "value": str(draft.financial_amount),
                    "display_value": str(draft.financial_amount),
                }
            )
        return ModeAwareResult(
            skip_llm=True,
            text=purchase_return_clarification_message(draft),
            card=None,
            intent="purchase_return_entry",
            method="purchase_return_draft",
            operation_class=operation_class.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
            error={
                "type": "clarification_required",
                "draft_id": draft.draft_id,
                "transaction_type": txn_label,
                "draft_status": draft.status,
                "missing_fields": draft.missing_fields,
                "ambiguous_fields": draft.ambiguous_fields,
                "captured_fields": captured,
                "nothing_posted": True,
            },
            draft_id=draft.draft_id,
        )

    card = purchase_return_to_confirmation_card(draft)
    return ModeAwareResult(
        skip_llm=True,
        text=purchase_return_preview_message(draft),
        card=card,
        intent="purchase_return_entry",
        method="purchase_return_draft",
        operation_class=operation_class.value,
        orbix_mode=mode,
        capabilities=caps.to_dict(),
        draft_id=draft.draft_id,
    )

def _process_financial(
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
    draft = start_or_merge_financial(
        message,
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        user_id=user_id,
        existing=existing,
    )
    save_financial_draft(draft)

    if draft.status == "awaiting_clarification":
        captured: list[dict[str, Any]] = []
        if draft.party_name:
            captured.append(
                {
                    "field": "party",
                    "label": "Party",
                    "value": draft.party_name,
                    "display_value": draft.party_name,
                }
            )
        if draft.amount is not None:
            captured.append(
                {
                    "field": "amount",
                    "label": "Amount",
                    "value": str(draft.amount),
                    "display_value": str(draft.amount),
                }
            )
        if draft.invoice_nos:
            captured.append(
                {
                    "field": "invoice_nos",
                    "label": "Invoices",
                    "value": ", ".join(draft.invoice_nos),
                    "display_value": ", ".join(draft.invoice_nos),
                }
            )
        return ModeAwareResult(
            skip_llm=True,
            text=financial_clarification_message(draft),
            card=None,
            intent=draft.kind,
            method="financial_draft",
            operation_class=operation_class.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
            error={
                "type": "clarification_required",
                "draft_id": draft.draft_id,
                "transaction_type": draft.kind,
                "draft_status": draft.status,
                "missing_fields": draft.missing_fields,
                "captured_fields": captured,
                "nothing_posted": True,
            },
            draft_id=draft.draft_id,
        )

    card = financial_to_confirmation_card(draft)
    return ModeAwareResult(
        skip_llm=True,
        text=financial_preview_message(draft),
        card=card,
        intent=(card or {}).get("intent") or draft.kind,
        method="financial_draft",
        operation_class=operation_class.value,
        orbix_mode=mode,
        capabilities=caps.to_dict(),
        draft_id=draft.draft_id,
    )


def _process_bank_recon(
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
    draft = start_or_merge_bank_recon(
        message,
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        user_id=user_id,
        existing=existing,
    )
    save_bank_recon_draft(draft)

    # Read-only: never attach a confirmation card (no orbix-confirm-post)
    if draft.kind == "treasury_query" or is_bank_recon_read_only_kind(draft.kind):
        return ModeAwareResult(
            skip_llm=True,
            text=bank_recon_preview_message(draft),
            card=None,
            intent="treasury_position_query",
            method="bank_recon_draft",
            operation_class=OperationClass.ACCOUNTING_QUESTION.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
            draft_id=draft.draft_id,
        )

    if draft.status == "awaiting_clarification":
        return ModeAwareResult(
            skip_llm=True,
            text=bank_recon_clarification_message(draft),
            card=None,
            intent="bank_reconciliation",
            method="bank_recon_draft",
            operation_class=operation_class.value,
            orbix_mode=mode,
            capabilities=caps.to_dict(),
            error={
                "type": "clarification_required",
                "draft_id": draft.draft_id,
                "transaction_type": "bank_reconciliation",
                "draft_status": draft.status,
                "missing_fields": draft.missing_fields,
                "nothing_posted": True,
            },
            draft_id=draft.draft_id,
        )

    card = bank_recon_to_confirmation_card(draft)
    return ModeAwareResult(
        skip_llm=True,
        text=bank_recon_preview_message(draft),
        card=card,
        intent=(card or {}).get("intent") or "bank_reconciliation",
        method="bank_recon_draft",
        operation_class=operation_class.value,
        orbix_mode=mode,
        capabilities=caps.to_dict(),
        draft_id=draft.draft_id,
    )

