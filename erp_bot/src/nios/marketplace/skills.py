"""Skill Marketplace — Capability → Skill → Workflow (Phase 3)."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..kernel.capability_registry import CapabilityDescriptor, registry


@dataclass
class SkillDescriptor:
    id: str
    name: str
    version: str
    tier: str  # "skill" | "workflow"
    capabilities: list[str]
    description: str = ""


@dataclass
class WorkflowDescriptor:
    id: str
    name: str
    version: str
    skills: list[str]
    description: str = ""
    trigger_events: list[str] = field(default_factory=list)


LAUNCH_SKILLS: list[SkillDescriptor] = [
    SkillDescriptor("skill.vat.calculate", "VAT Calculation", "1.0", "skill", ["cap.tax.vat.calculate"]),
    SkillDescriptor("skill.tds.calculate", "TDS Calculation", "1.0", "skill", ["cap.tax.tds.calculate"]),
    SkillDescriptor("skill.ledger.balance", "Party Balance", "1.0", "skill", ["cap.erp.ledger.balance"]),
    SkillDescriptor("skill.khata.entry", "Khata Entry Parse", "1.0", "skill", ["cap.khata.entry.parse"]),
    SkillDescriptor("skill.tax.faq", "Nepal Tax FAQ", "1.0", "skill", ["cap.knowledge.nepal.search"]),
    SkillDescriptor("skill.nav.erp", "ERP Navigation", "1.0", "skill", ["cap.nav.erp.find"]),
    SkillDescriptor("skill.bank.recon", "Bank Reconciliation", "1.0", "skill", ["cap.erp.session_snapshot"]),
    SkillDescriptor("skill.depreciation.run", "Depreciation Run", "1.0", "skill", ["cap.engine.depreciation"]),
    SkillDescriptor("skill.vat.filing", "VAT Return Prep", "1.0", "skill", ["cap.tax.vat.calculate", "cap.knowledge.nepal.search"]),
    SkillDescriptor("skill.tds.filing", "TDS Return Prep", "1.0", "skill", ["cap.tax.tds.calculate"]),
    SkillDescriptor("skill.payroll.simulate", "Payroll Simulation", "1.0", "skill", ["cap.engine.payroll"]),
    SkillDescriptor("skill.cashflow.forecast", "Cashflow Forecast", "1.0", "skill", ["cap.engine.accounting"]),
    SkillDescriptor("skill.ratio.analysis", "Ratio Analysis", "1.0", "skill", ["cap.engine.accounting"]),
    SkillDescriptor("skill.invoice.draft", "Invoice Draft from OCR", "1.0", "skill", ["cap.ocr.invoice"]),
    SkillDescriptor("skill.party.statement", "Party Statement", "1.0", "skill", ["cap.erp.ledger.balance"]),
    SkillDescriptor("skill.journal.validate", "Journal Validation", "1.0", "skill", ["cap.engine.journal"]),
    SkillDescriptor("skill.compliance.check", "Compliance Check", "1.0", "skill", ["cap.knowledge.nepal.search"]),
    SkillDescriptor("skill.scenario.compare", "Scenario Compare", "1.0", "skill", ["cap.engine.simulation"]),
    SkillDescriptor("skill.salary.simulate", "Salary What-If", "1.0", "skill", ["cap.engine.payroll", "cap.engine.simulation"]),
    SkillDescriptor("skill.audit.trail", "Audit Trail Query", "1.0", "skill", ["cap.erp.session_snapshot"]),
]

LAUNCH_WORKFLOWS: list[WorkflowDescriptor] = [
    WorkflowDescriptor(
        "workflow.tax.monthly_vat",
        "Monthly VAT Filing",
        "1.0",
        ["skill.vat.filing", "skill.vat.calculate", "skill.compliance.check"],
        trigger_events=[],
    ),
    WorkflowDescriptor(
        "workflow.erp.sales_invoice",
        "Sales Invoice Post",
        "1.0",
        ["skill.vat.calculate", "skill.journal.validate", "skill.ledger.balance"],
        trigger_events=["voucher.posted", "invoice.created"],
    ),
    WorkflowDescriptor(
        "workflow.payroll.run",
        "Payroll Run",
        "1.0",
        ["skill.payroll.simulate", "skill.tds.calculate"],
        trigger_events=["payroll.run"],
    ),
    WorkflowDescriptor(
        "workflow.bank.reconciliation",
        "Bank Reconciliation",
        "1.0",
        ["skill.bank.recon", "skill.party.statement"],
    ),
    WorkflowDescriptor(
        "workflow.scenario.planning",
        "Business Scenario Planning",
        "1.0",
        ["skill.scenario.compare", "skill.cashflow.forecast", "skill.ratio.analysis"],
    ),
]


class SkillMarketplace:
    def __init__(self) -> None:
        self.skills = {s.id: s for s in LAUNCH_SKILLS}
        self.workflows = {w.id: w for w in LAUNCH_WORKFLOWS}

    def list_skills(self) -> list[SkillDescriptor]:
        return list(self.skills.values())

    def list_workflows(self) -> list[WorkflowDescriptor]:
        return list(self.workflows.values())

    def resolve_skill_capabilities(self, skill_id: str) -> list[CapabilityDescriptor]:
        skill = self.skills.get(skill_id)
        if not skill:
            return []
        return [c for cap_id in skill.capabilities if (c := registry.get(cap_id))]

    def compose_workflow(self, workflow_id: str) -> dict:
        wf = self.workflows.get(workflow_id)
        if not wf:
            return {}
        return {
            "workflow": wf.id,
            "name": wf.name,
            "skills": [self.skills[sid].__dict__ for sid in wf.skills if sid in self.skills],
            "capabilities": list({cap for sid in wf.skills for cap in self.skills[sid].capabilities if sid in self.skills}),
        }


marketplace = SkillMarketplace()
