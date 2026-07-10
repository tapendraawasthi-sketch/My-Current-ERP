"""Business Consultant — meta-goal to workflow composition."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from ...marketplace.skills import marketplace


GOAL_PATTERNS: list[tuple[re.Pattern, list[str]]] = [
    (re.compile(r"\b(vat|tax)\s*(filing|return|file)\b", re.I), ["workflow.tax.monthly_vat"]),
    (re.compile(r"\b(bank|recon|ciliation)\b", re.I), ["workflow.bank.reconciliation"]),
    (re.compile(r"\b(payroll|salary|talab)\b", re.I), ["workflow.payroll.run"]),
    (re.compile(r"\b(scenario|plan|strategy|compare)\b", re.I), ["workflow.scenario.planning"]),
    (re.compile(r"\b(invoice|sales|bill)\b", re.I), ["workflow.erp.sales_invoice"]),
    (re.compile(r"\b(invest|nepse|portfolio|stock market)\b", re.I), ["workflow.investment.analysis"]),
    (re.compile(r"\b(legal|act|law|circular|compliance)\b", re.I), ["workflow.legal.research"]),
]


@dataclass
class ComposedPlan:
    goal: str
    workflows: list[dict[str, Any]]
    skills: list[str]
    capabilities: list[str]
    confidence: float
    steps: list[str] = field(default_factory=list)


class ConsultantComposer:
    def decompose_goal(self, message: str) -> list[str]:
        goals: list[str] = []
        lower = message.lower()
        if re.search(r"\b(grow|expand|increase)\b", lower):
            goals.append("growth")
        if re.search(r"\b(cost|reduce|save|cut)\b", lower):
            goals.append("cost_reduction")
        if re.search(r"\b(comply|filing|deadline|vat|tds)\b", lower):
            goals.append("compliance")
        if re.search(r"\b(invest|nepse|return|portfolio)\b", lower):
            goals.append("investment")
        if re.search(r"\b(cash|liquidity|runway)\b", lower):
            goals.append("cashflow")
        return goals or ["general_advisory"]

    def compose(self, message: str) -> ComposedPlan:
        workflow_ids: list[str] = []
        for pattern, wf_ids in GOAL_PATTERNS:
            if pattern.search(message):
                workflow_ids.extend(wf_ids)

        if not workflow_ids:
            subgoals = self.decompose_goal(message)
            if "compliance" in subgoals:
                workflow_ids.append("workflow.tax.monthly_vat")
            if "investment" in subgoals:
                workflow_ids.append("workflow.investment.analysis")
            if "cashflow" in subgoals:
                workflow_ids.append("workflow.scenario.planning")

        workflow_ids = list(dict.fromkeys(workflow_ids)) or ["workflow.scenario.planning"]

        workflows: list[dict] = []
        all_skills: list[str] = []
        all_caps: set[str] = set()

        for wf_id in workflow_ids:
            composed = marketplace.compose_workflow(wf_id)
            if composed:
                workflows.append(composed)
                all_skills.extend(composed.get("capabilities", []))
                for sk in composed.get("skills", []):
                    all_skills.append(sk.get("id", ""))
                    all_caps.update(sk.get("capabilities", []))

        steps = [
            f"1. Analyze goal: {message[:80]}",
            *[f"{i + 2}. Execute {w.get('name', w.get('workflow', '?'))}" for i, w in enumerate(workflows)],
            f"{len(workflows) + 2}. Verify and explain results",
        ]

        return ComposedPlan(
            goal=message,
            workflows=workflows,
            skills=list(dict.fromkeys(s for s in all_skills if s)),
            capabilities=sorted(all_caps),
            confidence=min(0.95, 0.6 + len(workflows) * 0.1),
            steps=steps,
        )


consultant_composer = ConsultantComposer()
