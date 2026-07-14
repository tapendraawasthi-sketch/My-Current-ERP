"""Bank reconciliation / treasury draft lifecycle (Phase 10).

Structured draft → confirmation card only. Frontend posts via treasury domain
commands (createStatementBatch, confirmBankMatch, postBankAdjustmentFromStatement,
postChequeStatusChange, etc). journalLines are empty for mutation intents that
need Phase 9 / treasury authority.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Literal

BankReconKind = Literal[
    "statement_import",
    "bank_match",
    "bank_unmatch",
    "bank_adjustment",
    "cheque_status",
    "treasury_query",
    "recon_close",
    "explanation",
]
DraftStatus = Literal[
    "draft",
    "awaiting_clarification",
    "complete",
    "validated",
    "previewed",
    "confirmed",
    "posted",
    "cancelled",
]

_IMPORT = re.compile(
    r"\b("
    r"import\s+(?:bank\s+)?statement|upload\s+(?:bank\s+)?statement|"
    r"statement\s+import|csv\s+import|"
    r"(?:import|upload)\s+(?:this\s+)?e2e\s+bank\s+statement"
    r")\b",
    re.I,
)
_MATCH = re.compile(
    r"\b("
    r"match\s+(?:bank|statement|receipt|payment)|"
    r"reconcile\s+(?:bank|statement|line)|"
    r"confirm\s+(?:bank\s+)?match|bank\s+reconcil"
    r")\b",
    re.I,
)
_UNMATCH = re.compile(r"\b(unmatch|reverse\s+(?:bank\s+)?match|unlink\s+statement)\b", re.I)
_ADJUST = re.compile(
    r"\b("
    r"bank\s+charge|bank\s+fee|bank\s+interest|"
    r"direct\s+deposit|direct\s+debit|bank\s+adjustment"
    r")\b",
    re.I,
)
_CHEQUE = re.compile(
    r"\b("
    r"cheque\s+cleared|check\s+cleared|clear\s+cheque|"
    r"cheque\s+bounce|bounce\s+cheque|cheque\s+status|"
    r"deposit\s+cheque|CH-E2E-\d+"
    r")\b",
    re.I,
)
_TREASURY = re.compile(
    r"\b("
    r"available\s+cash|treasury\s+position|book\s+vs\s+available|"
    r"cash\s+position|bank\s+position|uncleared\s+cheques?"
    r")\b",
    re.I,
)
_STATUS_Q = re.compile(
    r"("
    r"why\s+is\s+(?:the\s+)?bank\s+not\s+reconcil\w*|"
    r"bank\s+not\s+reconcil\w*|"
    r"reconcil(?:iation)?\s+status|"
    r"unmatched\s+(?:statement\s+)?lines?"
    r")",
    re.I,
)
_FORECAST_Q = re.compile(
    r"\b("
    r"(?:seven|7)[\s-]?day\s+(?:cash\s+)?forecast|"
    r"cash\s+flow\s+forecast|"
    r"forecast\s+(?:for\s+)?(?:the\s+)?(?:next\s+)?(?:7|seven)\s*days?"
    r")\b",
    re.I,
)
_CLOSE = re.compile(
    r"\b("
    r"close\s+(?:the\s+)?(?:e2e\s+)?(?:bank\s+)?reconcil\w*|"
    r"reconcil\w*\s+close"
    r")\b",
    re.I,
)
_EXPLANATION_Q = re.compile(
    r"^\s*(how\s+(?:is|are|do|does|to)|what\s+is|explain|define|meaning\s+of)\b",
    re.I,
)
_STEAL_SETTLEMENT = re.compile(
    r"\b("
    r"received\s+(?:rs|npr)|paid\s+(?:rs|npr)|customer\s+receipt|supplier\s+payment|"
    r"cash\s+to\s+bank|bank\s+to\s+cash|journal\s+entry"
    r")\b",
    re.I,
)
_STEAL_CONTRA = re.compile(
    r"\b("
    r"transfer\s+(?:rs|npr)|bank\s+to\s+bank|from\s+.+\s+to\s+|"
    r"contra\s+(?:entry|voucher)|with\s+bank\s+charge"
    r")\b",
    re.I,
)
_STEAL_INVENTORY = re.compile(
    r"\b(bought|purchased|sold|sale(?:s)?\s+invoice|purchase\s+invoice)\b",
    re.I,
)
# Prefer ungrouped digit runs first so "Rs 25000" is not truncated to 250
# by the optional thousands-group alternative matching only {1,3}.
_AMOUNT = re.compile(
    r"(?:rs\.?|npr)\s*([0-9]+(?:,[0-9]{3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)",
    re.I,
)
_CHEQUE_NO = re.compile(r"\b(CH-E2E-\d+|[A-Z]{0,3}\d{3,12})\b", re.I)
_REF = re.compile(r"\b((?:RV|PV|SI|PI)-E2E-\d+)\b", re.I)


def _d(value: Any) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value).replace(",", "")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        return None


def _money(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f")


def is_bank_recon_explanation_query(text: str) -> bool:
    if not _EXPLANATION_Q.search(text or ""):
        return False
    lower = (text or "").lower()
    # Status / forecast are dedicated read-only queries, not explanations
    if _STATUS_Q.search(text or "") or _FORECAST_Q.search(text or ""):
        return False
    if _TREASURY.search(text or ""):
        return False
    keys = (
        "bank reconcil",
        "statement",
        "cheque",
        "check clear",
        "treasury",
        "available cash",
        "bank match",
        "bank charge",
    )
    return any(k in lower for k in keys)


def is_bank_recon_status_query(text: str) -> bool:
    return bool(_STATUS_Q.search(text or ""))


def is_bank_recon_forecast_query(text: str) -> bool:
    return bool(_FORECAST_Q.search(text or ""))


def bank_recon_status_response(_text: str = "") -> str:
    return (
        "Bank is not fully reconciled while unmatched statement lines remain, "
        "or book vs bank difference is outside tolerance. "
        "Review unmatched lines, match RV/PV references, then close the session. "
        "Nothing is posted from a status query."
    )


def bank_recon_forecast_response(_text: str = "") -> str:
    return (
        "Seven-day cash forecast separates committed vs expected inflows/outflows "
        "from opening available cash. Horizon is 7 days; figures come from treasury "
        "position plus forecast items. Nothing is posted from a forecast query."
    )


def bank_recon_treasury_response(_text: str = "") -> str:
    return (
        "Treasury position (read-only): book balance is the ledger bank balance; "
        "available cash adjusts for uncleared issued/received cheques. "
        "Ask for a refresh after posting matches or cheque clears. Nothing is posted."
    )


def bank_recon_explanation_response(text: str) -> str:
    t = (text or "").lower()
    if "cheque" in t or "check" in t:
        return (
            "Cheque clearing links a deposited instrument to a bank statement line. "
            "Accounting usually already happened at issue/receive; clear is evidence. "
            "Bounce posts a corrective Phase 9 journal. Nothing is posted from an explanation."
        )
    if "treasury" in t or "available" in t:
        return (
            "Treasury position separates book balance (ledger) from available cash "
            "(book minus outstanding issued cheques, plus received cheques not yet cleared). "
            "Nothing is posted from an explanation."
        )
    if "match" in t or "reconcil" in t:
        return (
            "Bank reconciliation confirms links between statement lines and ERP vouchers. "
            "Matches are versioned; overmatch and stale line versions conflict. "
            "Nothing is posted from an explanation."
        )
    if "charge" in t or "interest" in t:
        return (
            "Bank charges/interest from statements must post via Phase 9 settlement commands "
            "(payment/receipt/journal/contra), then link to the statement line. "
            "Never use addVoucher. Nothing is posted from an explanation."
        )
    return (
        "Bank reconciliation imports statements, matches lines, posts bank adjustments via Phase 9, "
        "and tracks cheque/treasury position. Ask mode and explanations never mutate the ledger."
    )


def detect_bank_recon_kind(text: str) -> BankReconKind | None:
    if not text:
        return None
    if is_bank_recon_explanation_query(text):
        return "explanation"
    if _STEAL_INVENTORY.search(text):
        return None
    if is_bank_recon_status_query(text) or is_bank_recon_forecast_query(text):
        # Routed as read-only text in mode_aware; treat as treasury_query for draft kind
        return "treasury_query"
    # Prefer specific mutation intents over bare "bank statement" language.
    if _UNMATCH.search(text):
        return "bank_unmatch"
    if _CHEQUE.search(text):
        return "cheque_status"
    if _TREASURY.search(text):
        return "treasury_query"
    if _CLOSE.search(text):
        return "recon_close"
    if _ADJUST.search(text):
        lower = text.lower()
        # "from statement" / statement / reconcil context → bank_adjustment
        if any(
            k in lower
            for k in (
                "statement",
                "reconcil",
                "match line",
                "from statement",
            )
        ):
            return "bank_adjustment"
        if "bank charge" in lower or "bank interest" in lower or "bank fee" in lower:
            if "statement" in lower or "reconcil" in lower or "from statement" in lower:
                return "bank_adjustment"
    if _MATCH.search(text):
        return "bank_match"
    if _IMPORT.search(text):
        return "statement_import"
    return None


def prefer_bank_recon(text: str) -> bool:
    if is_bank_recon_status_query(text) or is_bank_recon_forecast_query(text):
        return True
    # Do not steal Phase 9 contra / transfer / settlement phrasing.
    if _STEAL_CONTRA.search(text or "") and "statement" not in (text or "").lower() and "reconcil" not in (
        text or ""
    ).lower():
        return False
    kind = detect_bank_recon_kind(text)
    if kind is None or kind == "explanation":
        return False
    if _STEAL_INVENTORY.search(text or ""):
        return False
    if kind == "bank_adjustment" and _STEAL_SETTLEMENT.search(text or ""):
        lower = (text or "").lower()
        if not any(k in lower for k in ("statement", "reconcil", "match")):
            return False
    return True


def is_bank_recon_read_only_kind(kind: BankReconKind | None) -> bool:
    return kind in {"treasury_query", "explanation"}


@dataclass
class BankReconDraft:
    draft_id: str
    kind: BankReconKind
    draft_version: int = 1
    amount: Decimal | None = None
    bank_account_id: str | None = "bank-e2e-main"
    statement_line_id: str | None = None
    erp_document_ids: list[str] = field(default_factory=list)
    cheque_id: str | None = None
    cheque_number: str | None = None
    cheque_next_status: str | None = None
    adjustment_type: str | None = None
    session_id: str | None = None
    csv_text: str | None = None
    reference: str | None = None
    missing_fields: list[str] = field(default_factory=list)
    status: DraftStatus = "draft"
    session_key: str = ""
    company_id: str = ""
    tenant_id: str = ""
    narration: str | None = None
    source_messages: list[str] = field(default_factory=list)
    preview: dict[str, Any] | None = None
    preview_hash: str | None = None
    idempotency_key: str | None = None
    created_by: str = ""
    expected_statement_line_version: int | None = None

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        if data.get("amount") is not None:
            data["amount"] = _money(_d(data["amount"]))
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> BankReconDraft:
        amt = _d(data.get("amount"))
        return cls(
            draft_id=str(data.get("draft_id") or uuid.uuid4()),
            kind=data.get("kind") or "bank_match",
            draft_version=int(data.get("draft_version") or 1),
            amount=amt,
            bank_account_id=data.get("bank_account_id"),
            statement_line_id=data.get("statement_line_id"),
            erp_document_ids=list(data.get("erp_document_ids") or []),
            cheque_id=data.get("cheque_id"),
            cheque_number=data.get("cheque_number"),
            cheque_next_status=data.get("cheque_next_status"),
            adjustment_type=data.get("adjustment_type"),
            session_id=data.get("session_id"),
            csv_text=data.get("csv_text"),
            reference=data.get("reference"),
            missing_fields=list(data.get("missing_fields") or []),
            status=data.get("status") or "draft",
            session_key=str(data.get("session_key") or ""),
            company_id=str(data.get("company_id") or ""),
            tenant_id=str(data.get("tenant_id") or ""),
            narration=data.get("narration"),
            source_messages=list(data.get("source_messages") or []),
            preview=data.get("preview"),
            preview_hash=data.get("preview_hash"),
            idempotency_key=data.get("idempotency_key"),
            created_by=str(data.get("created_by") or ""),
            expected_statement_line_version=data.get("expected_statement_line_version"),
        )


def _extract_amount(text: str) -> Decimal | None:
    m = _AMOUNT.search(text or "")
    return _d(m.group(1)) if m else None


def _infer_adjustment_type(text: str) -> str:
    t = (text or "").lower()
    if "interest" in t:
        return "bank_interest"
    if "direct deposit" in t:
        return "direct_deposit"
    if "direct debit" in t:
        return "direct_debit"
    if "transfer" in t:
        return "bank_transfer"
    return "bank_charge"


def _infer_cheque_status(text: str) -> str:
    t = (text or "").lower()
    if "bounce" in t:
        return "bounced"
    if "deposit" in t and "clear" not in t:
        return "deposited"
    if "cancel" in t:
        return "cancelled"
    if "stop" in t:
        return "stopped"
    return "cleared"


def merge_into_draft(draft: BankReconDraft, message: str) -> BankReconDraft:
    draft.source_messages.append(message)
    draft.draft_version += 1
    amt = _extract_amount(message)
    if amt is not None:
        draft.amount = amt
    for ref_m in _REF.finditer(message or ""):
        doc = ref_m.group(1).upper()
        if not draft.reference:
            draft.reference = doc
        if doc not in draft.erp_document_ids:
            draft.erp_document_ids = list({*draft.erp_document_ids, doc})
    chq = _CHEQUE_NO.search(message or "")
    if chq and ("CH-" in chq.group(1).upper() or "cheque" in message.lower() or "check" in message.lower()):
        draft.cheque_number = chq.group(1).upper()
    if draft.kind == "bank_adjustment":
        draft.adjustment_type = _infer_adjustment_type(message)
    if draft.kind == "cheque_status":
        draft.cheque_next_status = _infer_cheque_status(message)
        if "CH-E2E-001" in (message or "").upper():
            draft.cheque_id = "cheque-e2e-001"
        elif "CH-E2E-002" in (message or "").upper():
            draft.cheque_id = "cheque-e2e-002"
    draft.narration = " | ".join(draft.source_messages[-3:])
    return draft


def compute_missing(draft: BankReconDraft) -> list[str]:
    missing: list[str] = []
    if draft.kind == "bank_match":
        if not draft.erp_document_ids and not draft.reference:
            missing.append("erp_document")
        if draft.amount is None:
            missing.append("amount")
    elif draft.kind == "bank_adjustment":
        if draft.amount is None:
            missing.append("amount")
    elif draft.kind == "cheque_status":
        if not draft.cheque_id and not draft.cheque_number:
            missing.append("cheque")
    elif draft.kind == "bank_unmatch":
        if not draft.statement_line_id:
            missing.append("statement_line")
    return missing


def build_preview(draft: BankReconDraft) -> dict[str, Any]:
    return {
        "kind": draft.kind,
        "amount": _money(draft.amount),
        "bank_account_id": draft.bank_account_id,
        "statement_line_id": draft.statement_line_id,
        "erp_document_ids": list(draft.erp_document_ids),
        "cheque_id": draft.cheque_id,
        "cheque_number": draft.cheque_number,
        "cheque_next_status": draft.cheque_next_status,
        "adjustment_type": draft.adjustment_type,
        "reference": draft.reference,
        "narration": draft.narration,
        "treasury_read_only": draft.kind == "treasury_query",
    }


def start_or_merge_bank_recon(
    message: str,
    *,
    session_id: str,
    tenant_id: str,
    company_id: str,
    user_id: str,
    existing: BankReconDraft | None = None,
) -> BankReconDraft:
    kind = detect_bank_recon_kind(message) or (existing.kind if existing else None)
    if kind is None or kind == "explanation":
        kind = existing.kind if existing else "bank_match"

    if existing and existing.status in {"draft", "awaiting_clarification", "previewed"}:
        draft = existing
        detected = detect_bank_recon_kind(message)
        if detected not in (None, "explanation"):
            draft.kind = detected  # type: ignore[assignment]
    else:
        draft = BankReconDraft(
            draft_id=str(uuid.uuid4()),
            kind=kind,  # type: ignore[arg-type]
            session_key=session_id,
            company_id=company_id,
            tenant_id=tenant_id,
            created_by=user_id,
            idempotency_key=f"bank-recon-{uuid.uuid4()}",
        )

    draft = merge_into_draft(draft, message)
    draft.missing_fields = compute_missing(draft)
    if draft.missing_fields:
        draft.status = "awaiting_clarification"
        draft.preview = None
        draft.preview_hash = None
    else:
        draft.preview = build_preview(draft)
        draft.preview_hash = str(uuid.uuid5(uuid.NAMESPACE_URL, json.dumps(draft.preview, sort_keys=True)))
        draft.status = "previewed"
    return draft


def to_confirmation_card(draft: BankReconDraft) -> dict[str, Any] | None:
    # Read-only queries must never produce confirm-post cards
    if draft.kind in {"treasury_query", "explanation"}:
        return None
    if draft.status != "previewed" or not draft.preview:
        return None

    intent_map = {
        "statement_import": "bank_statement_import",
        "bank_match": "bank_match_confirm",
        "bank_unmatch": "bank_match_reverse",
        "bank_adjustment": "bank_adjustment_from_statement",
        "cheque_status": "cheque_status_change",
        "recon_close": "bank_recon_close",
    }
    tags = ["phase10_treasury", draft.kind]
    # Money string — avoid float truncation of voucher amounts (e.g. 25000).
    amount = _money(draft.amount) if draft.amount is not None else "0.00"
    return {
        "intent": intent_map.get(draft.kind, "bank_match_confirm"),
        "party": None,
        "amount": amount,
        "date": date.today().isoformat(),
        "raw_text": " | ".join(draft.source_messages) if draft.source_messages else (draft.narration or ""),
        "draft_id": draft.draft_id,
        "draft_version": draft.draft_version,
        "preview_hash": draft.preview_hash,
        "preview_version": draft.draft_version,
        "idempotency_key": draft.idempotency_key,
        "tags": tags,
        "narration": draft.narration,
        "method": "bank_recon_draft",
        "bank_recon_kind": draft.kind,
        "bank_account_id": draft.bank_account_id,
        "statement_line_id": draft.statement_line_id,
        "erp_document_ids": list(draft.erp_document_ids),
        "cheque_id": draft.cheque_id,
        "cheque_number": draft.cheque_number,
        "cheque_next_status": draft.cheque_next_status,
        "adjustment_type": draft.adjustment_type,
        "reference": draft.reference,
        "expected_statement_line_version": draft.expected_statement_line_version,
        "journalLines": [],
        "settlement_kind": None,
        "confidence": 0.9,
    }


def clarification_message(draft: BankReconDraft) -> str:
    labels = {
        "amount": "amount",
        "erp_document": "ERP voucher / document reference",
        "cheque": "cheque number",
        "statement_line": "statement line",
    }
    needed = ", ".join(labels.get(f, f) for f in draft.missing_fields) or "more detail"
    return f"To continue bank reconciliation I still need: {needed}."


def preview_message(draft: BankReconDraft) -> str:
    if draft.kind == "treasury_query":
        raw = " | ".join(draft.source_messages) if draft.source_messages else ""
        if is_bank_recon_status_query(raw):
            return bank_recon_status_response(raw)
        if is_bank_recon_forecast_query(raw):
            return bank_recon_forecast_response(raw)
        return bank_recon_treasury_response(raw)
    if draft.kind == "statement_import":
        return "Bank statement import draft ready. Confirm to import via treasury domain."
    if draft.kind == "bank_match":
        return "Bank match draft ready. Confirm to post confirmBankMatch."
    if draft.kind == "bank_adjustment":
        return (
            f"Bank adjustment ({draft.adjustment_type or 'bank_charge'}) draft ready. "
            "Confirm to post via Phase 9 + statement link."
        )
    if draft.kind == "cheque_status":
        return f"Cheque status change to {draft.cheque_next_status or 'cleared'} ready."
    if draft.kind == "recon_close":
        return "Close bank reconciliation session draft ready."
    return "Bank reconciliation draft ready for confirmation."


_LOCK = threading.Lock()
_MEMORY: dict[str, dict[str, Any]] = {}


def _store_path() -> Path:
    base = os.environ.get("ORBIX_DRAFT_STORE_DIR") or os.path.join(
        tempfile.gettempdir(), "orbix_drafts"
    )
    path = Path(base)
    path.mkdir(parents=True, exist_ok=True)
    return path / "bank_recon_drafts.json"


def _load_all() -> dict[str, dict[str, Any]]:
    global _MEMORY
    if _MEMORY:
        return _MEMORY
    path = _store_path()
    if path.exists():
        try:
            _MEMORY = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            _MEMORY = {}
    return _MEMORY


def _save_all(data: dict[str, dict[str, Any]]) -> None:
    global _MEMORY
    _MEMORY = data
    _store_path().write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def _draft_key(tenant_id: str, company_id: str, session_id: str) -> str:
    return f"{tenant_id}:{company_id}:{session_id}"


def save_draft(draft: BankReconDraft) -> None:
    with _LOCK:
        data = _load_all()
        data[_draft_key(draft.tenant_id, draft.company_id, draft.session_key)] = draft.to_dict()
        _save_all(data)


def load_pending_draft(
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


def load_draft(tenant_id: str, company_id: str, session_id: str) -> BankReconDraft | None:
    with _LOCK:
        data = _load_all()
        raw = data.get(_draft_key(tenant_id, company_id, session_id))
        return BankReconDraft.from_dict(raw) if raw else None


def clear_draft(tenant_id: str, company_id: str, session_id: str) -> None:
    with _LOCK:
        data = _load_all()
        data.pop(_draft_key(tenant_id, company_id, session_id), None)
        _save_all(data)
