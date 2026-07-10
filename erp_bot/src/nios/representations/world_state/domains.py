"""World State domains — 12 continuously maintained slices."""

from __future__ import annotations

from enum import Enum


class WorldStateDomain(str, Enum):
    BUSINESS = "business"
    ECONOMY = "economy"
    LAW = "law"
    MARKET = "market"
    TAX = "tax"
    INVENTORY = "inventory"
    EMPLOYEES = "employees"
    CUSTOMERS = "customers"
    COMPETITORS = "competitors"
    MACROECONOMICS = "macroeconomics"
    POLITICAL_RISK = "political_risk"
    CURRENCY_BANKING = "currency_banking"


ALL_DOMAINS: list[WorldStateDomain] = list(WorldStateDomain)

# Event → domains that should refresh
EVENT_DOMAIN_MAP: dict[str, list[WorldStateDomain]] = {
    "voucher.posted": [
        WorldStateDomain.BUSINESS,
        WorldStateDomain.TAX,
        WorldStateDomain.CUSTOMERS,
    ],
    "invoice.created": [
        WorldStateDomain.BUSINESS,
        WorldStateDomain.TAX,
        WorldStateDomain.INVENTORY,
        WorldStateDomain.CUSTOMERS,
    ],
    "stock.movement": [WorldStateDomain.INVENTORY, WorldStateDomain.BUSINESS],
    "payroll.run": [WorldStateDomain.EMPLOYEES, WorldStateDomain.TAX, WorldStateDomain.BUSINESS],
    "nios.chat.completed": [WorldStateDomain.BUSINESS],
}

# Intent → domains to query before reasoning
INTENT_DOMAIN_MAP: dict[str, list[WorldStateDomain]] = {
    "ledger_query": [WorldStateDomain.BUSINESS, WorldStateDomain.CUSTOMERS],
    "tax_query": [WorldStateDomain.TAX, WorldStateDomain.LAW, WorldStateDomain.BUSINESS],
    "simulation": [WorldStateDomain.BUSINESS, WorldStateDomain.EMPLOYEES, WorldStateDomain.TAX],
    "scenario": [WorldStateDomain.BUSINESS, WorldStateDomain.ECONOMY, WorldStateDomain.MARKET],
    "accounting_qa": [WorldStateDomain.LAW, WorldStateDomain.TAX],
    "khata_entry": [WorldStateDomain.BUSINESS, WorldStateDomain.CUSTOMERS],
}
