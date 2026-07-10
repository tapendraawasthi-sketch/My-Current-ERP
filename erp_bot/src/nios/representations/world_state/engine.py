"""World State Engine — query and event-driven sync across 12 domains."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .domains import ALL_DOMAINS, EVENT_DOMAIN_MAP, INTENT_DOMAIN_MAP, WorldStateDomain
from .store import WorldStateStore


@dataclass
class WorldStateQuery:
    tenant_id: str | None
    company_id: str | None
    domains: list[WorldStateDomain]
    slices: list[dict[str, Any]] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)


class WorldStateEngine:
    def __init__(self, store: WorldStateStore | None = None) -> None:
        self.store = store or WorldStateStore()

    def domains_for_intent(self, intent: str) -> list[WorldStateDomain]:
        if intent in INTENT_DOMAIN_MAP:
            return INTENT_DOMAIN_MAP[intent]
        return [WorldStateDomain.BUSINESS, WorldStateDomain.TAX]

    def query(
        self,
        *,
        intent: str = "general",
        tenant_id: str | None = None,
        company_id: str | None = None,
        balance: dict | None = None,
        domains: list[WorldStateDomain] | None = None,
    ) -> WorldStateQuery:
        selected = domains or self.domains_for_intent(intent)
        slices = self.store.get_slices(
            [d.value for d in selected],
            tenant_id=tenant_id,
            company_id=company_id,
        )

        # Hydrate business slice from live ERP balance if store empty
        if balance and WorldStateDomain.BUSINESS in selected:
            has_business = any(s["domain"] == "business" for s in slices)
            if not has_business:
                biz = self._balance_to_business(balance)
                self.sync_from_balance(balance, tenant_id=tenant_id, company_id=company_id)
                slices.append({
                    "domain": "business",
                    "key": "balances",
                    "value": biz,
                    "version": 1,
                    "updated_at": None,
                    "source_event": "erp.session_snapshot",
                })

        summary = self._summarize(slices)
        return WorldStateQuery(
            tenant_id=tenant_id,
            company_id=company_id,
            domains=selected,
            slices=slices,
            summary=summary,
        )

    def on_event(
        self,
        event_type: str,
        payload: dict[str, Any],
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
    ) -> list[dict[str, Any]]:
        domains = EVENT_DOMAIN_MAP.get(event_type, [WorldStateDomain.BUSINESS])
        updates: list[dict[str, Any]] = []

        for domain in domains:
            patch = self._patch_for_event(domain, event_type, payload)
            if not patch:
                continue
            for key, value in patch.items():
                meta = self.store.upsert_slice(
                    domain.value,
                    key,
                    value,
                    tenant_id=tenant_id,
                    company_id=company_id,
                    source_event=event_type,
                )
                updates.append({**meta, "value": value})

        return updates

    def sync_from_balance(
        self,
        balance: dict,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
    ) -> dict[str, Any]:
        biz = self._balance_to_business(balance)
        return self.store.upsert_slice(
            WorldStateDomain.BUSINESS.value,
            "balances",
            biz,
            tenant_id=tenant_id,
            company_id=company_id,
            source_event="erp.session_snapshot",
        )

    def _balance_to_business(self, balance: dict) -> dict[str, Any]:
        cash = float(balance.get("cash", balance.get("cashBalance", 0)) or 0)
        bank = float(balance.get("bank", balance.get("bankBalance", 0)) or 0)
        receivable = float(balance.get("receivable", balance.get("receivables", 0)) or 0)
        payable = float(balance.get("payable", balance.get("payables", 0)) or 0)
        liquidity = cash + bank
        working_capital = receivable - payable
        return {
            "cash": cash,
            "bank": bank,
            "receivable": receivable,
            "payable": payable,
            "liquidity": liquidity,
            "working_capital": working_capital,
        }

    def _patch_for_event(
        self,
        domain: WorldStateDomain,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, dict[str, Any]]:
        grand = float(payload.get("grandTotal", 0) or 0)

        if domain == WorldStateDomain.TAX and event_type in ("voucher.posted", "invoice.created"):
            return {
                "vat_accumulator": {
                    "last_invoice_no": payload.get("invoiceNo") or payload.get("referenceNo"),
                    "last_grand_total": grand,
                    "last_vat_estimate": round(grand * 13 / 113, 2) if grand else 0,
                    "filing_status": "pending_review",
                }
            }

        if domain == WorldStateDomain.BUSINESS and event_type in ("voucher.posted", "invoice.created"):
            return {
                "recent_activity": {
                    "last_voucher_id": payload.get("voucherId"),
                    "last_party": payload.get("partyName"),
                    "last_amount": grand,
                    "last_event": event_type,
                }
            }

        if domain == WorldStateDomain.CUSTOMERS and payload.get("partyName"):
            return {
                f"party:{payload['partyName']}": {
                    "party_name": payload["partyName"],
                    "last_transaction_amount": grand,
                    "last_event": event_type,
                }
            }

        if domain == WorldStateDomain.INVENTORY and event_type == "invoice.created":
            return {
                "last_movement": {
                    "invoice_id": payload.get("invoiceId"),
                    "invoice_type": payload.get("invoiceType"),
                    "amount": grand,
                }
            }

        if domain == WorldStateDomain.EMPLOYEES and event_type == "payroll.run":
            return {
                "payroll": {
                    "run_id": payload.get("runId"),
                    "headcount": payload.get("headcount", 0),
                    "total_net_pay": payload.get("totalNetPay", 0),
                }
            }

        return {}

    def _summarize(self, slices: list[dict[str, Any]]) -> dict[str, Any]:
        by_domain: dict[str, list[dict]] = {}
        for s in slices:
            by_domain.setdefault(s["domain"], []).append(s)

        summary: dict[str, Any] = {"domain_count": len(by_domain), "slice_count": len(slices)}
        biz = by_domain.get("business", [])
        for sl in biz:
            if sl["key"] == "balances":
                summary["liquidity"] = sl["value"].get("liquidity")
                summary["working_capital"] = sl["value"].get("working_capital")
        tax = by_domain.get("tax", [])
        for sl in tax:
            if sl["key"] == "vat_accumulator":
                summary["vat_estimate"] = sl["value"].get("last_vat_estimate")
                summary["filing_status"] = sl["value"].get("filing_status")
        return summary

    def list_domains(self) -> list[dict[str, str]]:
        return [{"id": d.value, "name": d.name} for d in ALL_DOMAINS]


world_state_engine = WorldStateEngine()
