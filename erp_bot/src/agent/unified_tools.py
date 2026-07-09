"""Phase 7 — Unified tool surface for routed Orbix agent."""

from __future__ import annotations

from langchain_core.tools import tool

from .nav_resolver import resolve_navigation
from ..bridges import dexie_bridge
from ..knowledge.unified_retriever import format_retrieved_context, retrieve
from ..vectorstore import chroma_store
from ..vectorstore.nav_index_store import search_nav_index
from .tool_registry import (
    calculate_tds,
    calculate_vat,
    get_bank_balance,
    get_cash_balance,
    get_party_balance,
    search_past_entries,
)


@tool
def search_nepal_knowledge(query: str) -> str:
    """Search Nepal accounting/tax knowledge base (VAT, TDS, SSF, double-entry)."""
    chunks = retrieve(query, intent="accounting_qa", k=5)
    return format_retrieved_context(chunks) or "No matching knowledge found."


@tool
def search_codebase(query: str) -> str:
    """Search ERP React/TypeScript source code."""
    results = chroma_store.search_codebase(query, k=5)
    if not results:
        return "No code matches found."
    return "\n\n---\n\n".join(
        f"[{r.get('source', 'unknown')}]\n{r.get('content', '')}" for r in results
    )


@tool
def find_navigation_path(screen_name: str) -> str:
    """Find ERP menu path and keyboard shortcut for a screen."""
    nav = resolve_navigation(screen_name)
    if nav and "not found" not in nav.lower():
        return nav
    hits = search_nav_index(screen_name, k=3)
    if not hits:
        return nav or "Navigation path not found."
    return nav + "\n\nRelated screens:\n" + "\n".join(
        f"- {h.get('source', '')}" for h in hits
    )


@tool
def query_party_balance_tool(party_name: str) -> str:
    """Get party receivable/payable from live session books."""
    return get_party_balance(party_name)


@tool
def query_past_entries(query: str, days: int = 30) -> str:
    """Search recent ledger entries in session snapshot."""
    return search_past_entries(query, days)


@tool
def query_cash_balance() -> str:
    """Current cash-in-hand from session."""
    return get_cash_balance()


@tool
def query_bank_balance() -> str:
    """Current bank balance from session."""
    return get_bank_balance()


@tool
def compute_vat(amount: float, is_inclusive: bool = True) -> str:
    """Calculate Nepal VAT at 13%."""
    return calculate_vat(amount, is_inclusive)


@tool
def compute_tds(payment_type: str, gross_amount: float) -> str:
    """Calculate Nepal TDS withholding."""
    return calculate_tds(payment_type, gross_amount)


UNIFIED_TOOLS = [
    search_nepal_knowledge,
    search_codebase,
    find_navigation_path,
    query_party_balance_tool,
    query_past_entries,
    query_cash_balance,
    query_bank_balance,
    compute_vat,
    compute_tds,
]

# Re-export for agent_builder compatibility
TOOLS = UNIFIED_TOOLS
