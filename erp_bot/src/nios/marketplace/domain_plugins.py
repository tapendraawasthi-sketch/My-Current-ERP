"""Domain plugins — Legal, Investment, Consultant workflows (Phase 6)."""

from __future__ import annotations

from ..marketplace.skills import LAUNCH_SKILLS, LAUNCH_WORKFLOWS, SkillDescriptor, WorkflowDescriptor

DOMAIN_SKILLS: list[SkillDescriptor] = [
    SkillDescriptor("skill.legal.act_search", "Legal Act Search", "1.0", "skill", ["cap.legal.act_search"]),
    SkillDescriptor("skill.legal.circular", "Circular Lookup", "1.0", "skill", ["cap.legal.circular_lookup"]),
    SkillDescriptor("skill.legal.court", "Court Decision Search", "1.0", "skill", ["cap.legal.court_decision"]),
    SkillDescriptor("skill.investment.nepse", "NEPSE Quote", "1.0", "skill", ["cap.investment.nepse_quote"]),
    SkillDescriptor("skill.investment.dcf", "DCF Analysis", "1.0", "skill", ["cap.investment.dcf_run"]),
    SkillDescriptor("skill.investment.portfolio", "Portfolio Analysis", "1.0", "skill", ["cap.investment.portfolio_analyze"]),
    SkillDescriptor("skill.consultant.compose", "Workflow Composition", "1.0", "skill", ["cap.consultant.workflow_compose"]),
    SkillDescriptor("skill.consultant.strategy", "Strategy Planning", "1.0", "skill", ["cap.consultant.strategy_plan"]),
    SkillDescriptor("skill.simulation.universal", "Universal Simulation", "1.0", "skill", ["cap.engine.simulation"]),
]

DOMAIN_WORKFLOWS: list[WorkflowDescriptor] = [
    WorkflowDescriptor(
        "workflow.legal.research",
        "Legal Research",
        "1.0",
        ["skill.legal.act_search", "skill.legal.circular", "skill.legal.court", "skill.compliance.check"],
    ),
    WorkflowDescriptor(
        "workflow.investment.analysis",
        "Investment Analysis",
        "1.0",
        ["skill.investment.nepse", "skill.investment.dcf", "skill.investment.portfolio", "skill.scenario.compare"],
    ),
    WorkflowDescriptor(
        "workflow.consultant.advisory",
        "Business Advisory",
        "1.0",
        ["skill.consultant.compose", "skill.consultant.strategy", "skill.cashflow.forecast", "skill.ratio.analysis"],
    ),
]


def register_domain_plugins(marketplace) -> dict[str, int]:
    counts = {"skills": 0, "workflows": 0}
    for skill in DOMAIN_SKILLS:
        if skill.id not in marketplace.skills:
            marketplace.skills[skill.id] = skill
            counts["skills"] += 1
    for wf in DOMAIN_WORKFLOWS:
        if wf.id not in marketplace.workflows:
            marketplace.workflows[wf.id] = wf
            counts["workflows"] += 1
    return counts
