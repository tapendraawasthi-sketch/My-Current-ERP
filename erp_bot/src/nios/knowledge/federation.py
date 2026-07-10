"""Federated Knowledge — unified query across adapters."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from ..representations.ontology.engine import ontology_engine
from ..representations.world_state.engine import world_state_engine
from .graph.store import KnowledgeGraphStore


@dataclass
class EvidenceObject:
    source: str
    authority: float
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)


class FederationAdapter(Protocol):
    source_id: str
    authority: float

    def query(self, intent: str, query: str, context: dict) -> list[EvidenceObject]: ...


class ErpFederationAdapter:
    source_id = "federation.erp"
    authority = 1.0

    def query(self, intent: str, query: str, context: dict) -> list[EvidenceObject]:
        balance = context.get("balance")
        if not balance:
            return []
        ws = world_state_engine.query(intent=intent, balance=balance)
        if not ws.summary:
            return []
        return [
            EvidenceObject(
                source=self.source_id,
                authority=self.authority,
                text=f"ERP World State: liquidity={ws.summary.get('liquidity')}, "
                f"working_capital={ws.summary.get('working_capital')}",
                metadata=ws.summary,
            )
        ]


class OntologyFederationAdapter:
    source_id = "federation.ontology"
    authority = 0.95

    def query(self, intent: str, query: str, context: dict) -> list[EvidenceObject]:
        concept = "TaxDecision" if "tax" in intent else "FinancialDocument"
        result = ontology_engine.query_temporal(concept)
        rules = ontology_engine.applicable_rules(concept)
        texts = [f"Ontology: {concept} ({len(result['relations'])} relations)"]
        for rule in rules[:2]:
            texts.append(f"Rule {rule['rule_id']}: {rule.get('cite', '')}")
        return [
            EvidenceObject(
                source=self.source_id,
                authority=self.authority,
                text=" | ".join(texts),
                metadata={"rules": rules, "nodes": len(result["nodes"])},
            )
        ]


class MemoryFederationAdapter:
    source_id = "federation.memory"
    authority = 0.7

    def query(self, intent: str, query: str, context: dict) -> list[EvidenceObject]:
        store = KnowledgeGraphStore()
        obs = store.find_nodes(label_contains=query[:20] if query else "", limit=3)
        if not obs:
            return []
        return [
            EvidenceObject(
                source=self.source_id,
                authority=self.authority,
                text=f"Graph node: {n['label']} ({n['node_type']})",
                metadata=n,
            )
            for n in obs
        ]


class GovFederationAdapter:
    source_id = "federation.gov"
    authority = 0.98

    def query(self, intent: str, query: str, context: dict) -> list[EvidenceObject]:
        from .feeds import gov_search

        q = query.lower()
        if "tax" not in intent and "vat" not in q and "nrb" not in q and "sebon" not in q:
            return []
        topic = None
        if "vat" in q:
            topic = "vat"
        elif "income" in q or "tax" in q:
            topic = "income_tax"
        elif "nrb" in q or "bank rate" in q:
            topic = "monetary"
        elif "sebon" in q:
            topic = "securities"
        hits = gov_search(query, topic=topic)
        return [
            EvidenceObject(
                source=self.source_id,
                authority=self.authority,
                text=h["text"],
                metadata={"jurisdiction": h.get("jurisdiction", "NP"), "authority": h.get("authority"), "source_url": h.get("source")},
            )
            for h in hits[:3]
        ]


class NepseFederationAdapter:
    source_id = "federation.nepse"
    authority = 0.92

    def query(self, intent: str, query: str, context: dict) -> list[EvidenceObject]:
        import re

        from .feeds import nepse_quote

        if "invest" not in intent and "nepse" not in query.lower():
            sym_m = re.search(r"\b([A-Z]{3,6})\b", query)
            if not sym_m:
                return []
            symbol = sym_m.group(1)
        else:
            sym_m = re.search(r"\b([A-Z]{3,6})\b", query)
            symbol = sym_m.group(1) if sym_m else "NABIL"

        quote = nepse_quote(symbol)
        if not quote:
            return []
        return [
            EvidenceObject(
                source=self.source_id,
                authority=self.authority,
                text=(
                    f"NEPSE {symbol}: LTP Rs.{quote['ltp']:,.2f} "
                    f"({quote.get('change_pct', 0):+.2f}%) | P/E {quote['pe']} | {quote['sector']}"
                ),
                metadata={"symbol": symbol, **quote},
            )
        ]


class VectorFederationAdapter:
    source_id = "federation.vector"
    authority = 0.88

    def query(self, intent: str, query: str, context: dict) -> list[EvidenceObject]:
        try:
            from ...knowledge.hybrid_rag import get_hybrid_rag

            chunks = get_hybrid_rag().search(query, top_k=2)
            return [
                EvidenceObject(
                    source=self.source_id,
                    authority=self.authority,
                    text=(c.get("text") or "")[:300],
                    metadata={"score": c.get("score"), "source": c.get("metadata", {}).get("source")},
                )
                for c in (chunks or [])
            ]
        except Exception:
            return []


class WebFederationAdapter:
    source_id = "federation.web"
    authority = 0.75

    ALLOWLIST = ("ird.gov.np", "nrb.org.np", "sebon.gov.np", "lawcommission.gov.np")

    def query(self, intent: str, query: str, context: dict) -> list[EvidenceObject]:
        if context.get("allow_web_search") is False:
            return []
        return [
            EvidenceObject(
                source=self.source_id,
                authority=self.authority,
                text=f"Allowlisted web reference for: {query[:80]}",
                metadata={"allowlist": self.ALLOWLIST, "intent": intent},
            )
        ]


class FilesFederationAdapter:
    source_id = "federation.files"
    authority = 0.85

    def query(self, intent: str, query: str, context: dict) -> list[EvidenceObject]:
        tenant_id = context.get("tenant_id")
        company_id = context.get("company_id")
        if tenant_id and company_id and query.strip():
            try:
                from uuid import UUID

                from backend.knowledge.container import get_knowledge_container

                hits = get_knowledge_container().orchestrator.search_documents(
                    query,
                    tenant_id=UUID(str(tenant_id)),
                    company_id=UUID(str(company_id)),
                    k=5,
                )
                if hits:
                    return [
                        EvidenceObject(
                            source=self.source_id,
                            authority=self.authority,
                            text=h.get("text", "")[:2000],
                            metadata={
                                **(h.get("metadata") or {}),
                                "chroma_id": h.get("id"),
                                "distance": h.get("distance"),
                            },
                        )
                        for h in hits
                    ]
            except Exception:
                pass

        files = context.get("uploaded_files") or []
        if not files:
            return []
        return [
            EvidenceObject(
                source=self.source_id,
                authority=self.authority,
                text=f"File evidence: {f.get('name', 'document')}",
                metadata=f,
            )
            for f in files[:3]
        ]


class PartnerFederationAdapter:
    source_id = "federation.partner"
    authority = 0.8

    def query(self, intent: str, query: str, context: dict) -> list[EvidenceObject]:
        partner = context.get("partner_api")
        if not partner:
            return []
        return [
            EvidenceObject(
                source=self.source_id,
                authority=self.authority,
                text=f"Partner API ({partner}): stub response for {intent}",
                metadata={"partner": partner},
            )
        ]


class FederatedKnowledge:
    def __init__(self) -> None:
        self.adapters: list[FederationAdapter] = [
            ErpFederationAdapter(),
            OntologyFederationAdapter(),
            GovFederationAdapter(),
            NepseFederationAdapter(),
            MemoryFederationAdapter(),
            VectorFederationAdapter(),
            WebFederationAdapter(),
            FilesFederationAdapter(),
            PartnerFederationAdapter(),
        ]

    def query(
        self,
        intent: str,
        query: str,
        *,
        context: dict | None = None,
        slices: list[str] | None = None,
    ) -> list[EvidenceObject]:
        ctx = context or {}
        if slices:
            self.adapters = [a for a in self.adapters if a.source_id.split(".")[-1] in slices or True]

        merged: list[EvidenceObject] = []
        for adapter in self.adapters:
            try:
                merged.extend(adapter.query(intent, query, ctx))
            except Exception:
                continue

        merged.sort(key=lambda e: -e.authority)
        return merged


federated_knowledge = FederatedKnowledge()
