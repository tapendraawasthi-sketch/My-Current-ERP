"""Orbix draft confirmation ack — records Dexie posting result against Python draft store.

Model B: Dexie remains authoritative for vouchers. This endpoint only updates draft status
so clarification / double-confirm draft state stays consistent with the UI ledger.

MAI-01: mark-posted requires authenticated principal + MARK_POSTED policy (Ask denied).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from src.khata.purchase_draft import (
    PurchaseDraft,
    get_posted_result as get_purchase_posted,
    load_pending_draft as load_pending_purchase,
    mark_posted as mark_purchase_posted,
)
from src.khata.sales_draft import (
    SalesDraft,
    get_posted_result as get_sales_posted,
    load_pending_draft as load_pending_sale,
    mark_posted as mark_sales_posted,
)
from src.oip.config.settings import get_oip_settings
from src.oip.domain.constitution import DecisionCode, InteractionMode, OperationClass, PolicyContext, evaluate_policy
from src.oip.domain.constitution.config_guard import insecure_dev_identity_allowed
from src.oip.domain.constitution.trusted_identity import principal_from_security, try_dev_principal
from src.oip.infrastructure.di.container import get_container
from src.oip.infrastructure.observability.logging import log_event
from src.oip.infrastructure.security.jwt_service import JwtAuthError
from src.oip.infrastructure.security.session_context import bind_principal, current_principal

router = APIRouter(prefix="/orbix/drafts", tags=["orbix-drafts"])


class MarkPostedBody(BaseModel):
    voucher_number: str = Field(..., min_length=1, max_length=128)
    posting_id: str = Field(..., min_length=1, max_length=128)
    posted_at: str | None = None
    company_id: str | None = None
    idempotent_replay: bool = False
    invoice_number: str | None = None
    client_verified: bool | None = None
    orbix_mode: str | None = Field(default="accountant")


async def _authorize_mark_posted(
    request: Request,
    *,
    body: MarkPostedBody,
    authorization: str | None,
) -> None:
    settings = get_oip_settings()
    principal = current_principal()
    if principal is None and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            container = await get_container()
            principal = await container.jwt_service.verify_access_token(token)
            bind_principal(principal)
        except JwtAuthError as exc:
            raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED") from exc

    trusted = principal_from_security(principal) if principal else try_dev_principal()
    if settings.auth_required and trusted is None:
        raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")
    if trusted is None and not insecure_dev_identity_allowed():
        raise HTTPException(status_code=401, detail="AUTHENTICATION_REQUIRED")

    mode = (body.orbix_mode or "accountant").strip().lower()
    if mode not in {"ask", "accountant"}:
        mode = "ask"
    decision = evaluate_policy(
        PolicyContext(
            mode=InteractionMode.ASK if mode == "ask" else InteractionMode.ACCOUNTANT,
            operation=OperationClass.MARK_POSTED,
            principal=trusted,
            requested_company_id=body.company_id,
            requested_tenant_id=trusted.tenant_id if trusted else None,
            explicit_confirmation=True,
            correlation_id=request.headers.get("x-correlation-id", ""),
        )
    )
    log_event("mai01.policy_decision", **decision.to_audit_dict(), route="mark-posted")
    if not decision.allowed:
        status = 401 if decision.decision_code is DecisionCode.AUTHENTICATION_REQUIRED else 403
        raise HTTPException(status_code=status, detail=decision.decision_code.value)


@router.get("/{draft_id}")
async def get_draft(draft_id: str) -> dict[str, Any]:
    draft = load_pending_purchase(session_id="", draft_id=draft_id) or load_pending_sale(
        session_id="", draft_id=draft_id
    )
    posted = get_purchase_posted(draft_id) or get_sales_posted(draft_id)
    if draft is None and posted is None:
        from src.khata import purchase_draft as pd
        from src.khata import sales_draft as sd

        with pd._LOCK:
            data = pd._load_all()
            raw = data.get(draft_id)
        if not raw:
            with sd._LOCK:
                data = sd._load_all()
                raw = data.get(draft_id)
        if not raw:
            raise HTTPException(status_code=404, detail="draft_not_found")
        return {
            "draft_id": draft_id,
            "status": raw.get("status"),
            "posted_result": raw.get("posted_result"),
        }
    if posted is not None:
        return {"draft_id": draft_id, "status": "posted", "posted_result": posted}
    assert draft is not None
    return {
        "draft_id": draft.draft_id,
        "status": draft.status,
        "preview_hash": draft.preview_hash,
        "missing_fields": draft.missing_fields,
    }


@router.post("/{draft_id}/mark-posted")
async def mark_draft_posted(
    draft_id: str,
    body: MarkPostedBody,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Acknowledge that the authoritative Dexie ledger posted this draft."""
    await _authorize_mark_posted(request, body=body, authorization=authorization)

    existing = get_purchase_posted(draft_id) or get_sales_posted(draft_id)
    if existing is not None:
        return {
            "status": "posted",
            "idempotent_replay": True,
            "posted_result": existing,
        }

    purchase = load_pending_purchase(session_id="", draft_id=draft_id)
    sale = load_pending_sale(session_id="", draft_id=draft_id)

    # Ownership: when draft exists with company_id, body selector must match (if supplied).
    draft_company = None
    if sale is not None:
        draft_company = getattr(sale, "company_id", None) or None
    elif purchase is not None:
        draft_company = getattr(purchase, "company_id", None) or None
    if draft_company and body.company_id and body.company_id != draft_company:
        raise HTTPException(status_code=403, detail="COMPANY_SCOPE_MISMATCH")

    result = {
        "voucher_number": body.voucher_number,
        "posting_id": body.posting_id,
        "posted_at": body.posted_at,
        "invoice_number": body.invoice_number,
        "source": "dexie_authoritative",
    }

    if sale is not None:
        mark_sales_posted(sale, result)
    elif purchase is not None:
        mark_purchase_posted(purchase, result)
    else:
        # Prefer sales shell when SI invoice number present; else purchase
        if body.invoice_number and str(body.invoice_number).upper().startswith("SI"):
            draft = SalesDraft(
                draft_id=draft_id,
                status="previewed",
                company_id=body.company_id or "",
            )
            mark_sales_posted(draft, result)
        else:
            draft = PurchaseDraft(
                draft_id=draft_id,
                status="previewed",
                company_id=body.company_id or "",
            )
            mark_purchase_posted(draft, result)

    return {
        "status": "posted",
        "idempotent_replay": False,
        "posted_result": result,
    }
