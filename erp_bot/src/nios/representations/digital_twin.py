"""Digital Twin — per-business aggregate from World State."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .world_state.engine import WorldStateEngine, world_state_engine


@dataclass
class DigitalTwin:
    tenant_id: str | None
    company_id: str | None
    business: dict[str, Any] = field(default_factory=dict)
    tax: dict[str, Any] = field(default_factory=dict)
    customers: dict[str, Any] = field(default_factory=dict)
    employees: dict[str, Any] = field(default_factory=dict)
    inventory: dict[str, Any] = field(default_factory=dict)
    health_score: float = 0.0
    risks: list[str] = field(default_factory=list)
    updated_at: str | None = None


class DigitalTwinEngine:
    def __init__(self, world_state: WorldStateEngine | None = None) -> None:
        self.world_state = world_state or world_state_engine

    def build(
        self,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
        balance: dict | None = None,
    ) -> DigitalTwin:
        ws = self.world_state.query(
            intent="general",
            tenant_id=tenant_id,
            company_id=company_id,
            balance=balance,
        )

        twin = DigitalTwin(tenant_id=tenant_id, company_id=company_id)
        for sl in ws.slices:
            domain = sl["domain"]
            key = sl["key"]
            val = sl["value"]
            if domain == "business":
                twin.business[key] = val
            elif domain == "tax":
                twin.tax[key] = val
            elif domain == "customers":
                twin.customers[key] = val
            elif domain == "employees":
                twin.employees[key] = val
            elif domain == "inventory":
                twin.inventory[key] = val
            if sl.get("updated_at"):
                twin.updated_at = sl["updated_at"]

        twin.health_score, twin.risks = self._score(twin, ws.summary)
        return twin

    def _score(self, twin: DigitalTwin, summary: dict) -> tuple[float, list[str]]:
        score = 70.0
        risks: list[str] = []

        liquidity = summary.get("liquidity")
        if liquidity is not None:
            if liquidity < 0:
                score -= 25
                risks.append("Negative liquidity")
            elif liquidity < 50_000:
                score -= 10
                risks.append("Low cash buffer")

        wc = summary.get("working_capital")
        if wc is not None and wc < 0:
            score -= 15
            risks.append("Negative working capital")

        filing = summary.get("filing_status")
        if filing == "pending_review":
            risks.append("VAT filing pending review")

        return max(0.0, min(100.0, score)), risks

    def to_dict(self, twin: DigitalTwin) -> dict[str, Any]:
        return {
            "tenant_id": twin.tenant_id,
            "company_id": twin.company_id,
            "business": twin.business,
            "tax": twin.tax,
            "customers": twin.customers,
            "employees": twin.employees,
            "inventory": twin.inventory,
            "health_score": twin.health_score,
            "risks": twin.risks,
            "updated_at": twin.updated_at,
        }


digital_twin_engine = DigitalTwinEngine()
