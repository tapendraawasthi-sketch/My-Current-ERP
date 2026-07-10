"""NIOS Capability Catalog — programmatic 200+ capability registration (Phase 6)."""

from __future__ import annotations

from ..contracts.intelligence_contract import CapabilityDescriptor

# 10 domains × 20 operations = 200 Year-1 capabilities
DOMAIN_OPERATIONS: dict[str, list[str]] = {
    "erp": [
        "ledger.balance", "party.statement", "invoice.create", "voucher.post",
        "journal.validate", "nav.find", "session.snapshot", "stock.movement",
        "bank.reconcile", "aging.report", "trial.balance", "profit.loss",
        "balance.sheet", "cashflow.statement", "ratio.analysis", "budget.compare",
        "cost.center", "multi.currency", "opening.balance", "year.end",
    ],
    "tax": [
        "vat.calculate", "tds.calculate", "vat.filing", "tds.filing",
        "income.tax", "excise.calc", "customs.duty", "withholding.calc",
        "tax.credit", "penalty.calc", "refund.claim", "advance.tax",
        "tax.exemption", "fiscal.year", "ird.form", "cbms.submit",
        "tax.audit", "compliance.check", "rate.lookup", "slab.progressive",
    ],
    "legal": [
        "act.search", "circular.lookup", "court.decision", "penalty.calc",
        "contract.review", "labor.law", "company.law", "tax.law.ref",
        "property.law", "constitutional.ref", "admin.rule", "deadline.track",
        "compliance.map", "jurisdiction.check", "precedent.search",
        "statute.version", "amendment.track", "legal.opinion", "risk.flag",
        "filing.guide",
    ],
    "investment": [
        "nepse.quote", "dcf.run", "npv.calc", "irr.calc", "portfolio.analyze",
        "dividend.track", "pe.ratio", "eps.calc", "beta.calc", "risk.score",
        "bond.yield", "mutual.fund", "ipo.analysis", "rights.issue",
        "bonus.share", "market.cap", "sector.compare", "technical.signal",
        "fundamental.score", "watchlist.alert",
    ],
    "consultant": [
        "goal.decompose", "workflow.compose", "strategy.plan", "swot.analyze",
        "market.research", "competitor.scan", "pricing.optimize", "cost.reduce",
        "growth.forecast", "kpi.dashboard", "benchmark.peer", "risk.assess",
        "opportunity.find", "roadmap.build", "resource.plan", "scenario.model",
        "decision.matrix", "stakeholder.map", "change.manage", "advisory.memo",
    ],
    "compliance": [
        "vat.deadline", "tds.deadline", "audit.trail", "policy.check",
        "license.track", "regulatory.alert", "filing.status", "penalty.risk",
        "document.retain", "gdpr.check", "aml.screen", "kyc.verify",
        "sebon.rule", "nrb.circular", "ird.notice", "labor.compliance",
        "env.compliance", "insurance.renew", "contract.expiry", "cert.renew",
    ],
    "payroll": [
        "salary.calc", "epf.calc", "ssf.calc", "cit.calc", "tds.calc",
        "bonus.calc", "overtime.calc", "leave.balance", "gratuity.calc",
        "payroll.run", "payslip.gen", "bank.transfer", "attendance.sync",
        "increment.simulate", "headcount.plan", "cost.center.alloc",
        "contractor.pay", "advance.salary", "loan.deduction", "annual.return",
    ],
    "banking": [
        "reconcile.auto", "statement.import", "cheque.track", "pdc.manage",
        "loan.schedule", "interest.calc", "emi.calc", "overdraft.alert",
        "payment.advice", "swift.parse", "nepal.pay", "wallet.sync",
        "fx.rate", "treasury.forecast", "cash.pool", "bank.charge",
        "deposit.maturity", "lc.track", "guarantee.track", "credit.limit",
    ],
    "inventory": [
        "stock.level", "reorder.alert", "valuation.fifo", "valuation.weighted",
        "batch.track", "serial.track", "expiry.alert", "transfer.inter",
        "damage.writeoff", "physical.count", "bom.explode", "mrp.plan",
        "lead.time", "supplier.score", "abc.analysis", "slow.moving",
        "fast.moving", "stock.aging", "warehouse.util", "unit.convert",
    ],
    "reporting": [
        "dashboard.kpi", "report.schedule", "export.pdf", "export.excel",
        "chart.trend", "variance.analysis", "drill.down", "pivot.table",
        "consolidation", "segment.report", "management.pack", "board.deck",
        "regulatory.filing", "custom.query", "alert.threshold", "data.quality",
        "lineage.track", "version.compare", "narrative.gen", "benchmark.vs",
    ],
}

# Year 2–3 expansion: 30 domains × 20 operations = 600 additional capabilities (800 total)
_Y2_STANDARD_OPS = [
    "record.create", "record.update", "record.validate", "record.archive",
    "query.search", "query.filter", "query.aggregate", "query.export",
    "workflow.start", "workflow.approve", "workflow.reject", "workflow.notify",
    "report.generate", "report.schedule", "report.compare", "report.drill",
    "policy.check", "policy.enforce", "policy.audit", "policy.remediate",
]

DOMAIN_OPERATIONS_Y2: dict[str, list[str]] = {
    domain: list(_Y2_STANDARD_OPS)
    for domain in (
        "audit", "crm", "manufacturing", "retail", "hospitality",
        "agriculture", "healthcare", "education", "ngo", "import_export",
        "treasury", "fixed_assets", "projects", "contracts", "insurance_ops",
        "logistics", "fleet", "real_estate", "franchise", "ecommerce",
        "bi", "ml_ops", "iot", "blockchain", "esg",
        "hr", "recruitment", "training", "warranty", "subscription",
    )
}

SIMULATION_DOMAINS = [
    "salary",
    "tax",
    "cashflow",
    "inventory",
    "branch",
    "loan",
    "investment",
    "payroll_headcount",
    "vat_filing",
]


def _cap_id(domain: str, operation: str) -> str:
    return f"cap.{domain}.{operation.replace('.', '_')}"


def generate_catalog_capabilities(*, include_y2: bool = True) -> list[CapabilityDescriptor]:
    caps: list[CapabilityDescriptor] = []
    domains = dict(DOMAIN_OPERATIONS)
    if include_y2:
        domains.update(DOMAIN_OPERATIONS_Y2)
    for domain, operations in domains.items():
        for i, op in enumerate(operations):
            cap_id = _cap_id(domain, op)
            provides = [domain, op.split(".")[0]]
            if domain in ("tax", "payroll", "investment"):
                provides.append("deterministic")
            caps.append(
                CapabilityDescriptor(
                    id=cap_id,
                    version="1.0.0",
                    contract_version="1.0",
                    tier="capability",
                    inputs=[{"name": "payload"}],
                    outputs=[{"name": "result"}],
                    provides=list(dict.fromkeys(provides)),
                    requires=[],
                    latency_p50_ms=10 + (i % 5) * 5,
                    cost_tier=min(3, i % 4),
                    confidence_floor=0.85 if domain == "legal" else 0.9,
                    description=f"{domain.title()} — {op.replace('.', ' ')}",
                )
            )
    return caps


def catalog_stats() -> dict[str, int]:
    y1 = sum(len(v) for v in DOMAIN_OPERATIONS.values())
    y2 = sum(len(v) for v in DOMAIN_OPERATIONS_Y2.values())
    return {"y1_capabilities": y1, "y2_capabilities": y2, "total": y1 + y2}


def register_catalog(registry) -> int:
    """Register catalog capabilities; skip IDs already present."""
    count = 0
    existing = {c.id for c in registry.list_all()}
    for cap in generate_catalog_capabilities():
        if cap.id not in existing:
            registry.register(cap)
            count += 1
    return count
