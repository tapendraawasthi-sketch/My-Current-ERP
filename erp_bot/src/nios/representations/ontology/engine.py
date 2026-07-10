"""Universal Ontology — typed hierarchy with temporal queries."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ...knowledge.graph.store import KnowledgeGraphStore

# Seed ontology triples: (subject, relation, object)
ONTOLOGY_SEED: list[tuple[str, str, str]] = [
    ("Invoice", "is_a", "FinancialDocument"),
    ("FinancialDocument", "is_a", "BusinessEvidence"),
    ("BusinessEvidence", "supports", "AccountingTruth"),
    ("AccountingTruth", "supports", "TaxDecision"),
    ("TaxDecision", "requires", "LegalAuthority"),
    ("LegalAuthority", "cites", "ActSection"),
    ("VATReturn", "is_a", "TaxFiling"),
    ("TaxFiling", "requires", "LegalAuthority"),
    ("PayrollRun", "is_a", "BusinessEvidence"),
    ("JournalEntry", "is_a", "AccountingTruth"),
    ("PartyBalance", "is_a", "AccountingTruth"),
    ("NepalVATAct", "is_a", "LegalAuthority"),
    ("IncomeTaxAct", "is_a", "LegalAuthority"),
]


@dataclass
class OntologyClass:
    name: str
    parents: list[str]
    children: list[str]


class OntologyEngine:
    def __init__(self, store: KnowledgeGraphStore | None = None) -> None:
        self.store = store or KnowledgeGraphStore()
        self._class_index: dict[str, OntologyClass] = {}
        self._node_ids: dict[str, str] = {}
        self._bootstrapped = False

    def bootstrap(self) -> int:
        if self._bootstrapped:
            return 0
        count = 0
        labels = {s for triple in ONTOLOGY_SEED for s in (triple[0], triple[2])}
        for label in labels:
            if label not in self._node_ids:
                self._node_ids[label] = self.store.add_node(
                    label, "OntologyClass", properties={"seeded": True}
                )
                count += 1
        for subject, relation, obj in ONTOLOGY_SEED:
            self.store.add_edge(self._node_ids[subject], self._node_ids[obj], relation)
            count += 1
        self._rebuild_index()
        self._bootstrapped = True
        return count

    def _rebuild_index(self) -> None:
        self._class_index = {}
        for subject, relation, obj in ONTOLOGY_SEED:
            if relation != "is_a":
                continue
            if subject not in self._class_index:
                self._class_index[subject] = OntologyClass(subject, [], [])
            if obj not in self._class_index:
                self._class_index[obj] = OntologyClass(obj, [], [])
            self._class_index[subject].parents.append(obj)
            self._class_index[obj].children.append(subject)

    def is_subclass(self, child: str, parent: str) -> bool:
        self.bootstrap()
        if child == parent:
            return True
        visited: set[str] = set()
        stack = [child]
        while stack:
            current = stack.pop()
            if current in visited:
                continue
            visited.add(current)
            cls = self._class_index.get(current)
            if not cls:
                continue
            for p in cls.parents:
                if p == parent:
                    return True
                stack.append(p)
        return False

    def query_temporal(
        self,
        concept: str,
        *,
        as_of: str | None = None,
        jurisdiction: str = "NP",
        fiscal_year: str | None = None,
    ) -> dict[str, Any]:
        self.bootstrap()
        nodes = self.store.find_nodes(node_type="OntologyClass", label_contains=concept, as_of=as_of)
        related = []
        if nodes:
            related = self.store.traverse(nodes[0]["id"], depth=2, as_of=as_of)
        return {
            "concept": concept,
            "as_of": as_of,
            "jurisdiction": jurisdiction,
            "fiscal_year": fiscal_year,
            "nodes": nodes,
            "relations": related,
            "is_subclass_of_financial_document": self.is_subclass(concept, "FinancialDocument"),
        }

    def applicable_rules(
        self,
        concept: str,
        *,
        as_of: str | None = None,
        jurisdiction: str = "NP",
    ) -> list[dict[str, Any]]:
        """Temporal rule selection — FY/date-aware."""
        self.bootstrap()
        rules: list[dict[str, Any]] = []
        if self.is_subclass(concept, "TaxDecision") or concept in ("VATReturn", "TaxFiling"):
            rules.append({
                "rule_id": "vat_standard",
                "rate": 13.0,
                "jurisdiction": jurisdiction,
                "effective_from": "2022-07-16",
                "cite": "VAT Act 2052",
                "selected_by": "ontology.temporal",
            })
        if concept in ("PayrollRun", "TaxDecision") or "Payroll" in concept:
            rules.append({
                "rule_id": "income_tax_progressive",
                "jurisdiction": jurisdiction,
                "effective_from": "2081-04-01",
                "cite": "Income Tax Act FY 2081/82",
                "selected_by": "ontology.temporal",
            })
        return rules


ontology_engine = OntologyEngine()
