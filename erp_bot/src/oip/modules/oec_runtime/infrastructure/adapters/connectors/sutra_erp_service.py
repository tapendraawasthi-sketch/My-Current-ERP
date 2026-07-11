"""Sutra ERP business logic — parameterized SQL, validation enforced."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Protocol

from ......integration.contracts.erp_commands import ErpCommandType


class SqlExecutor(Protocol):
    async def fetchone(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None: ...
    async def fetchall(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]: ...
    async def execute(self, sql: str, params: tuple[Any, ...] = ()) -> int: ...
    async def executemany(self, sql: str, params_seq: list[tuple[Any, ...]]) -> int: ...
    async def begin(self) -> None: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _erp_ref(prefix: str, suffix: str) -> str:
    return f"{prefix}-{suffix[:12]}-{uuid.uuid4().hex[:8]}"


class SutraErpService:
    """Production ERP operations against Sutra-compatible schema."""

    def __init__(self, executor: SqlExecutor) -> None:
        self._db = executor

    async def ensure_seed(self, *, tenant_id: str, company_id: str) -> None:
        existing = await self._db.fetchone(
            "SELECT account_id FROM erp_chart_of_accounts WHERE tenant_id = ? AND company_id = ? LIMIT 1",
            (tenant_id, company_id),
        )
        if existing:
            return
        accounts = (
            ("1000", "Cash", "asset"),
            ("1100", "Bank", "asset"),
            ("1200", "Accounts Receivable", "asset"),
            ("2000", "Accounts Payable", "liability"),
            ("4000", "Sales Revenue", "income"),
            ("5000", "Purchases", "expense"),
            ("5100", "Expenses", "expense"),
        )
        for code, name, account_type in accounts:
            await self._db.execute(
                """
                INSERT OR IGNORE INTO erp_chart_of_accounts
                (account_id, tenant_id, company_id, code, name, account_type, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
                """,
                (str(uuid.uuid4()), tenant_id, company_id, code, name, account_type),
            )
        await self._db.execute(
            """
            INSERT OR IGNORE INTO erp_fiscal_periods
            (period_id, tenant_id, company_id, name, start_date, end_date, is_open)
            VALUES (?, ?, ?, 'FY Current', '2026-01-01', '2026-12-31', 1)
            """,
            (str(uuid.uuid4()), tenant_id, company_id),
        )

    async def post_journal_entry(self, payload: dict[str, Any]) -> dict[str, Any]:
        tenant_id = payload["tenant_id"]
        company_id = payload["company_id"]
        idempotency_key = payload.get("idempotency_key", "")
        await self.ensure_seed(tenant_id=tenant_id, company_id=company_id)

        if idempotency_key:
            existing = await self._db.fetchone(
                "SELECT voucher_id, voucher_no FROM erp_vouchers WHERE idempotency_key = ?",
                (idempotency_key,),
            )
            if existing:
                return {
                    "status": "duplicate",
                    "erp_reference": existing["voucher_no"],
                    "voucher_id": existing["voucher_id"],
                    "rows_affected": 0,
                }

        lines = payload.get("lines") or self._default_lines(payload)
        total_debit = sum(float(line.get("debit", 0)) for line in lines)
        total_credit = sum(float(line.get("credit", 0)) for line in lines)
        if abs(total_debit - total_credit) > 0.01:
            raise ValueError(f"Journal entry not balanced: Dr={total_debit} Cr={total_credit}")

        period = await self._db.fetchone(
            """
            SELECT is_open FROM erp_fiscal_periods
            WHERE tenant_id = ? AND company_id = ? AND is_open = 1
            ORDER BY start_date DESC LIMIT 1
            """,
            (tenant_id, company_id),
        )
        if not period:
            raise ValueError("Fiscal period is closed")

        voucher_id = str(uuid.uuid4())
        voucher_no = _erp_ref("JV", voucher_id)
        voucher_date = payload.get("voucher_date") or datetime.now(timezone.utc).date().isoformat()
        narration = payload.get("narration", "Journal entry")
        rows_affected = 0

        await self._db.begin()
        try:
            await self._db.execute(
                """
                INSERT INTO erp_vouchers
                (voucher_id, tenant_id, company_id, voucher_no, voucher_date, voucher_type,
                 status, narration, idempotency_key, total_debit, total_credit, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'posted', ?, ?, ?, ?, ?)
                """,
                (
                    voucher_id,
                    tenant_id,
                    company_id,
                    voucher_no,
                    voucher_date,
                    payload.get("voucher_type", "journal"),
                    narration,
                    idempotency_key or None,
                    total_debit,
                    total_credit,
                    _utc_now_iso(),
                ),
            )
            rows_affected += 1
            line_rows: list[tuple[Any, ...]] = []
            posting_rows: list[tuple[Any, ...]] = []
            for line in lines:
                line_id = str(uuid.uuid4())
                account_code = line.get("account_code") or line.get("account", "5100")
                account_name = line.get("account_name") or line.get("account", "Expenses")
                debit = float(line.get("debit", 0))
                credit = float(line.get("credit", 0))
                line_rows.append((line_id, voucher_id, account_code, account_name, debit, credit))
                posting_rows.append(
                    (
                        str(uuid.uuid4()),
                        tenant_id,
                        company_id,
                        voucher_id,
                        account_code,
                        voucher_date,
                        debit,
                        credit,
                    )
                )
            await self._db.executemany(
                """
                INSERT INTO erp_voucher_lines (line_id, voucher_id, account_code, account_name, debit, credit)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                line_rows,
            )
            await self._db.executemany(
                """
                INSERT INTO erp_ledger_postings
                (posting_id, tenant_id, company_id, voucher_id, account_code, posting_date, debit, credit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                posting_rows,
            )
            rows_affected += len(line_rows) + len(posting_rows)
            await self._db.commit()
        except Exception:
            await self._db.rollback()
            raise

        return {
            "status": "accepted",
            "erp_reference": voucher_no,
            "voucher_id": voucher_id,
            "rows_affected": rows_affected,
            "total_debit": total_debit,
            "total_credit": total_credit,
        }

    async def approve_pending_action(self, payload: dict[str, Any]) -> dict[str, Any]:
        action_ref = payload.get("action_ref") or payload.get("approval_id", "")
        if not action_ref:
            raise ValueError("action_ref required for approval")
        tenant_id = payload["tenant_id"]
        company_id = payload["company_id"]
        await self._db.execute(
            """
            INSERT INTO erp_approvals (approval_id, tenant_id, company_id, action_ref, status, updated_at)
            VALUES (?, ?, ?, ?, 'approved', ?)
            ON CONFLICT(approval_id) DO UPDATE SET status = 'approved', updated_at = excluded.updated_at
            """,
            (str(uuid.uuid4()), tenant_id, company_id, action_ref, _utc_now_iso()),
        )
        return {"status": "accepted", "erp_reference": _erp_ref("APR", action_ref), "action_ref": action_ref}

    async def query_ledger_balance(self, payload: dict[str, Any]) -> dict[str, Any]:
        tenant_id = payload["tenant_id"]
        company_id = payload["company_id"]
        account_code = payload.get("account_code", "1000")
        row = await self._db.fetchone(
            """
            SELECT COALESCE(SUM(debit), 0) AS total_debit, COALESCE(SUM(credit), 0) AS total_credit
            FROM erp_ledger_postings
            WHERE tenant_id = ? AND company_id = ? AND account_code = ?
            """,
            (tenant_id, company_id, account_code),
        )
        balance = float((row or {}).get("total_debit", 0)) - float((row or {}).get("total_credit", 0))
        return {"account_code": account_code, "balance": balance, "rows": [row or {}]}

    async def get_coa_snapshot(self, payload: dict[str, Any]) -> dict[str, Any]:
        tenant_id = payload["tenant_id"]
        company_id = payload["company_id"]
        rows = await self._db.fetchall(
            """
            SELECT code, name, account_type FROM erp_chart_of_accounts
            WHERE tenant_id = ? AND company_id = ? AND is_active = 1
            ORDER BY code
            """,
            (tenant_id, company_id),
        )
        return {
            "snapshot_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "company_id": company_id,
            "captured_at": _utc_now_iso(),
            "accounts": rows,
            "metadata": {"account_count": len(rows)},
        }

    async def is_period_open(self, payload: dict[str, Any]) -> dict[str, Any]:
        tenant_id = payload["tenant_id"]
        company_id = payload["company_id"]
        period_id = payload.get("fiscal_period_id")
        if period_id:
            row = await self._db.fetchone(
                "SELECT is_open FROM erp_fiscal_periods WHERE period_id = ? AND tenant_id = ? AND company_id = ?",
                (period_id, tenant_id, company_id),
            )
        else:
            row = await self._db.fetchone(
                """
                SELECT is_open, period_id FROM erp_fiscal_periods
                WHERE tenant_id = ? AND company_id = ?
                ORDER BY start_date DESC LIMIT 1
                """,
                (tenant_id, company_id),
            )
        is_open = bool(row and row.get("is_open"))
        return {"is_open": is_open, "fiscal_period_id": (row or {}).get("period_id")}

    async def generate_financial_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        tenant_id = payload["tenant_id"]
        company_id = payload["company_id"]
        report_type = payload.get("report_type", "trial_balance")
        rows = await self._db.fetchall(
            """
            SELECT account_code,
                   COALESCE(SUM(debit), 0) AS total_debit,
                   COALESCE(SUM(credit), 0) AS total_credit
            FROM erp_ledger_postings
            WHERE tenant_id = ? AND company_id = ?
            GROUP BY account_code
            ORDER BY account_code
            """,
            (tenant_id, company_id),
        )
        return {"report_type": report_type, "rows": rows, "row_count": len(rows)}

    async def calculate_vat(self, payload: dict[str, Any]) -> dict[str, Any]:
        amount = float(payload.get("amount", 0))
        rate = float(payload.get("vat_rate", payload.get("rate", 0.13)))
        vat = round(amount * rate, 2)
        return {"amount": amount, "vat_rate": rate, "vat_amount": vat, "total": round(amount + vat, 2)}

    async def query_party_balance(self, payload: dict[str, Any]) -> dict[str, Any]:
        tenant_id = payload["tenant_id"]
        company_id = payload["company_id"]
        party_name = payload.get("party_name", "")
        row = await self._db.fetchone(
            "SELECT party_id, name, party_type FROM erp_parties WHERE tenant_id = ? AND company_id = ? AND name = ?",
            (tenant_id, company_id, party_name),
        )
        return {"party": row or {}, "balance": 0.0}

    @staticmethod
    def _default_lines(payload: dict[str, Any]) -> list[dict[str, Any]]:
        amount = float(payload.get("amount", 1000))
        return [
            {"account_code": "5100", "account_name": "Expenses", "debit": amount, "credit": 0},
            {"account_code": "1000", "account_name": "Cash", "debit": 0, "credit": amount},
        ]
