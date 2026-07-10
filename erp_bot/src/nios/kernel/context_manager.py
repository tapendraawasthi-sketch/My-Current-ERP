"""Dynamic Context Manager — per-request context assembly with token budget."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ContextSlice:
    name: str
    content: str
    priority: int
    tokens_est: int


@dataclass
class ContextBundle:
    slices: list[ContextSlice] = field(default_factory=list)
    token_budget: int = 4096
    tokens_used: int = 0

    def add(self, name: str, content: str, priority: int = 5) -> bool:
        if not content.strip():
            return False
        tokens_est = max(1, len(content) // 4)
        if self.tokens_used + tokens_est > self.token_budget:
            return False
        self.slices.append(ContextSlice(name=name, content=content, priority=priority, tokens_est=tokens_est))
        self.tokens_used += tokens_est
        return True

    def to_system_prompt(self) -> str:
        ordered = sorted(self.slices, key=lambda s: -s.priority)
        parts = [f"## {s.name}\n{s.content}" for s in ordered]
        return "\n\n".join(parts)


class ContextManager:
    def build(
        self,
        *,
        message: str,
        uil_action: str,
        session_id: str,
        balance: dict | None = None,
        retrieval_chunks: list[dict] | None = None,
        goal_tree_summary: str | None = None,
        token_budget: int = 4096,
    ) -> ContextBundle:
        bundle = ContextBundle(token_budget=token_budget)

        if goal_tree_summary:
            bundle.add("Goal", goal_tree_summary, priority=9)

        if balance:
            summary = (
                f"Cash={balance.get('cash', balance.get('cashBalance', 0))}, "
                f"Bank={balance.get('bank', balance.get('bankBalance', 0))}, "
                f"Receivable={balance.get('receivable', balance.get('receivables', 0))}, "
                f"Payable={balance.get('payable', balance.get('payables', 0))}"
            )
            parties = balance.get("parties") or balance.get("partyBalances") or []
            if isinstance(parties, list) and parties:
                top = parties[:5]
                summary += "\nParties: " + ", ".join(
                    f"{p.get('name', p.get('partyName', '?'))}={p.get('balance', 0)}" for p in top
                )
            bundle.add("ERP Snapshot", summary, priority=8)

        if retrieval_chunks:
            evidence = "\n".join(
                f"- [{c.get('metadata', {}).get('source', 'kb')}] {c.get('text', '')[:300]}"
                for c in retrieval_chunks[:5]
            )
            bundle.add("Evidence", evidence, priority=7)

        if uil_action in ("tax_query", "sell", "purchase"):
            bundle.add("Domain", "Nepal tax/accounting context. Cite IRD rules. Never invent rates.", priority=6)

        bundle.add("User Query", message, priority=10)
        return bundle


context_manager = ContextManager()
