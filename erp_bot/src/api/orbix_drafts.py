"""Orbix draft confirmation ack — records Dexie posting result against Python draft store.

Model B: Dexie remains authoritative for vouchers. This endpoint only updates draft status
so clarification / double-confirm draft state stays consistent with the UI ledger.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
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

router = APIRouter(prefix="/orbix/drafts", tags=["orbix-drafts"])


class MarkPostedBody(BaseModel):
    voucher_number: str = Field(..., min_length=1, max_length=128)
    posting_id: str = Field(..., min_length=1, max_length=128)
    posted_at: str | None = None
    company_id: str | None = None
    idempotent_replay: bool = False
    invoice_number: str | None = None
    client_verified: bool | None = None


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
async def mark_draft_posted(draft_id: str, body: MarkPostedBody) -> dict[str, Any]:
    """Acknowledge that the authoritative Dexie ledger posted this draft."""
    existing = get_purchase_posted(draft_id) or get_sales_posted(draft_id)
    if existing is not None:
        return {
            "status": "posted",
            "idempotent_replay": True,
            "posted_result": existing,
        }

    purchase = load_pending_purchase(session_id="", draft_id=draft_id)
    sale = load_pending_sale(session_id="", draft_id=draft_id)

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
