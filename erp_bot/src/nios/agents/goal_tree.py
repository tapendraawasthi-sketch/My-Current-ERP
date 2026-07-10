"""Goal Tree Planner — Phase 2."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from ..contracts.intelligence_contract import UILDocument
from ..kernel.capability_registry import registry


@dataclass
class GoalTree:
    id: str
    goal: str
    objectives: list[str] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    risks: list[str] = field(default_factory=list)
    success_criteria: list[str] = field(default_factory=list)
    steps: list[dict[str, Any]] = field(default_factory=list)
    required_capabilities: list[str] = field(default_factory=list)
    confidence: float = 0.5
    reflection: str | None = None


def build_goal_tree(uil: UILDocument, message: str) -> GoalTree:
    """Build goal tree from UIL action and dependencies."""
    tree_id = str(uuid4())
    action = uil.action
    deps = list(uil.dependencies or [])

    if action == "ledger_query":
        return GoalTree(
            id=tree_id,
            goal="Fetch accurate ledger balance from ERP",
            objectives=["Resolve party if named", "Return deterministic balance"],
            constraints=["Use ERP snapshot only", "No LLM for numbers"],
            risks=["Stale snapshot", "Party not found"],
            success_criteria=["Balance from cap.erp.ledger.balance", "Truth record attached"],
            steps=[
                {"id": "s1", "capability": "cap.erp.session_snapshot", "deps": []},
                {"id": "s2", "capability": "cap.erp.ledger.balance", "deps": ["s1"]},
            ],
            required_capabilities=["cap.erp.session_snapshot", "cap.erp.ledger.balance"],
            confidence=0.95,
        )

    if action == "tax_query":
        return GoalTree(
            id=tree_id,
            goal="Answer tax question with evidence",
            objectives=["Retrieve applicable law", "Use engine if numeric"],
            constraints=["No unsupported facts", "Nepal jurisdiction NP"],
            risks=["Outdated law version", "Ambiguous interpretation"],
            success_criteria=["Truth records present", "Citation or engine output"],
            steps=[
                {"id": "s1", "capability": "cap.knowledge.nepal.search", "deps": []},
                {"id": "s2", "capability": "cap.tax.vat.calculate", "deps": ["s1"], "optional": True},
            ],
            required_capabilities=["cap.knowledge.nepal.search"],
            confidence=0.85,
        )

    if action in ("sell", "purchase"):
        return GoalTree(
            id=tree_id,
            goal=f"Record {action} transaction",
            objectives=["Parse entry", "Validate journal", "Compute tax"],
            constraints=["Double-entry balanced", "User confirmation for post"],
            risks=["Wrong party", "Missing amount"],
            success_criteria=["Balanced journal proposed"],
            steps=[
                {"id": "s1", "capability": "cap.khata.entry.parse", "deps": []},
                {"id": "s2", "capability": "cap.tax.vat.calculate", "deps": ["s1"]},
            ],
            required_capabilities=["cap.khata.entry.parse", "cap.tax.vat.calculate"],
            confidence=uil.confidence,
        )

    # Default Q&A goal tree
    caps = registry.find_by_provides("knowledge_retrieval")
    cap_id = caps[0].id if caps else "cap.knowledge.nepal.search"
    tree = GoalTree(
        id=tree_id,
        goal="Answer user question accurately",
        objectives=["Understand intent", "Retrieve evidence", "Reason with citations"],
        constraints=["Domain guard applied", "No Wikipedia for accounting terms"],
        risks=["Low retrieval coverage"],
        success_criteria=["Confidence >= 0.7 or research plan emitted"],
        steps=[
            {"id": "s1", "capability": cap_id, "deps": []},
            {"id": "s2", "capability": "cap.chat.route", "deps": ["s1"]},
        ],
        required_capabilities=[cap_id, "cap.chat.route"],
        confidence=uil.confidence,
    )
    tree.reflection = "Learn() → emit observation for learning hierarchy"
    return tree
