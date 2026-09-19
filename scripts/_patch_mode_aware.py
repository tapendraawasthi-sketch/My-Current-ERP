from pathlib import Path

# Add load_pending_draft alias to bank_recon_draft
p = Path("erp_bot/src/khata/bank_recon_draft.py")
t = p.read_text(encoding="utf-8")
if "def load_pending_draft" not in t:
    t = t.replace(
        "def load_draft(tenant_id: str, company_id: str, session_id: str) -> BankReconDraft | None:",
        '''def load_pending_draft(
    *,
    session_id: str,
    tenant_id: str = "",
    company_id: str = "",
    draft_id: str | None = None,
) -> BankReconDraft | None:
    draft = load_draft(tenant_id, company_id, session_id)
    if draft is None:
        return None
    if draft_id and draft.draft_id != draft_id:
        return None
    return draft


def load_draft(tenant_id: str, company_id: str, session_id: str) -> BankReconDraft | None:''',
    )
    p.write_text(t, encoding="utf-8", newline="\n")
    print("added load_pending_draft")
else:
    print("already has load_pending_draft")

# Patch mode_aware_erp.py
m = Path("erp_bot/src/oip/integration/mode_aware_erp.py")
mt = m.read_text(encoding="utf-8")
if "bank_recon_draft" not in mt:
    mt = mt.replace(
        '''from ...khata.financial_draft import (
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
''',
        '''from ...khata.financial_draft import (
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
    clarification_message as bank_recon_clarification_message,
    is_bank_recon_explanation_query,
    load_pending_draft as load_pending_bank_recon,
    prefer_bank_recon,
    preview_message as bank_recon_preview_message,
    save_draft as save_bank_recon_draft,
    start_or_merge_bank_recon,
    to_confirmation_card as bank_recon_to_confirmation_card,
)
''',
    )

    # load pending bank recon
    mt = mt.replace(
        '''    pending_financial = load_pending_financial(
        session_id=session_id,
        tenant_id=tenant_id,
        company_id=company_id,
        draft_id=draft_id,
    )
''',
        '''    pending_financial = load_pending_financial(
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
''',
    )

    # pending selection - insert bank_recon before financial where appropriate
    mt = mt.replace(
        '''    if draft_id and pending_financial and pending_financial.draft_id == draft_id:
        pending, pending_kind = pending_financial, "financial"
''',
        '''    if draft_id and pending_bank_recon and pending_bank_recon.draft_id == draft_id:
        pending, pending_kind = pending_bank_recon, "bank_recon"
    elif draft_id and pending_financial and pending_financial.draft_id == draft_id:
        pending, pending_kind = pending_financial, "financial"
''',
    )
    mt = mt.replace(
        '''    elif pending_financial and pending_financial.status == "awaiting_clarification":
        pending, pending_kind = pending_financial, "financial"
''',
        '''    elif pending_bank_recon and pending_bank_recon.status == "awaiting_clarification":
        pending, pending_kind = pending_bank_recon, "bank_recon"
    elif pending_financial and pending_financial.status == "awaiting_clarification":
        pending, pending_kind = pending_financial, "financial"
''',
    )
    mt = mt.replace(
        '''    elif pending_financial:
        pending, pending_kind = pending_financial, "financial"
''',
        '''    elif pending_bank_recon:
        pending, pending_kind = pending_bank_recon, "bank_recon"
    elif pending_financial:
        pending, pending_kind = pending_financial, "financial"
''',
    )

    # explanations - bank recon before settlement
    mt = mt.replace(
        '''    # Phase 9 settlement explanations - before fallthrough, never mutate
    if is_financial_explanation_query(message):
''',
        '''    # Phase 10 bank recon explanations - before settlement, never mutate
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

    # Phase 9 settlement explanations - before fallthrough, never mutate
    if is_financial_explanation_query(message):
''',
    )

    # Prefer bank recon BEFORE prefer_financial_settlement early path
    mt = mt.replace(
        '''    # Prefer settlement even when classifier returns general_question (e.g. bare debit/credit JE)
    if prefer_financial_settlement(message) and not pending:
''',
        '''    # Prefer bank recon (statement/cheque/treasury language) before settlement
    if prefer_bank_recon(message) and not pending:
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
''',
    )

    # Clarification merge for bank_recon
    mt = mt.replace(
        '''    if pending and op == OperationClass.CLARIFICATION_REPLY:
        if pending_kind == "financial":
            return _process_financial(
''',
        '''    if pending and op == OperationClass.CLARIFICATION_REPLY:
        if pending_kind == "bank_recon":
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
        if pending_kind == "financial":
            return _process_financial(
''',
    )

    # Main routing: bank_recon before financial_signal block
    mt = mt.replace(
        '''    financial_signal = prefer_financial_settlement(message)

    # Purchase return / supplier debit note — checked BEFORE sales returns and
''',
        '''    financial_signal = prefer_financial_settlement(message)
    bank_recon_signal = prefer_bank_recon(message)

    # Purchase return / supplier debit note — checked BEFORE sales returns and
''',
    )

    mt = mt.replace(
        '''    # Financial settlement (receipt / payment / contra / journal) — after purchase-return
    # check so returns are not stolen; before sale/purchase so "Paid/Received" is not inventory.
    if financial_signal and not purchase_return_signal and not return_signal:
''',
        '''    # Bank recon before settlement so reconcile/statement/cheque language is not stolen
    if bank_recon_signal and not purchase_return_signal and not return_signal:
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
''',
    )

    # Append _process_bank_recon before _process_financial or at end of file
    if "_process_bank_recon" not in mt:
        mt += '''

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

    if draft.kind == "treasury_query":
        card = bank_recon_to_confirmation_card(draft)
        return ModeAwareResult(
            skip_llm=True,
            text=bank_recon_preview_message(draft),
            card=card,
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
        intent="bank_reconciliation",
        method="bank_recon_draft",
        operation_class=operation_class.value,
        orbix_mode=mode,
        capabilities=caps.to_dict(),
        draft_id=draft.draft_id,
    )
'''

    m.write_text(mt, encoding="utf-8", newline="\n")
    print("mode_aware patched", "prefer_bank_recon" in mt, "_process_bank_recon" in mt)
else:
    print("mode_aware already patched")