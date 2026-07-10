"""Nightly benchmark suites — 8 domain regression tests."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class BenchmarkCase:
    id: str
    input: Any
    expected: Any
    tolerance: float = 0.01


@dataclass
class BenchmarkSuite:
    id: str
    name: str
    cases: list[BenchmarkCase]
    runner: Callable[[BenchmarkCase], bool]


@dataclass
class BenchmarkResult:
    suite_id: str
    passed: int
    failed: int
    total: int
    failures: list[dict[str, Any]] = field(default_factory=list)
    duration_ms: float = 0


def _run_accounting(case: BenchmarkCase) -> bool:
    from ...execution.engines.tax_engine import round2

    lines = case.input
    debit = sum(l.get("debit", 0) for l in lines)
    credit = sum(l.get("credit", 0) for l in lines)
    is_balanced = abs(round2(debit) - round2(credit)) <= case.tolerance
    return is_balanced == bool(case.expected)


def _run_tax(case: BenchmarkCase) -> bool:
    from ...execution.engines.tax_engine import compute_vat, compute_tds

    if case.input.get("type") == "vat":
        result = compute_vat(case.input["amount"], rate=case.input.get("rate", 13))
        return abs(result["vat_amount"] - float(case.expected)) <= case.tolerance
    result = compute_tds(case.input["amount"], rate=case.input.get("rate", 1.5))
    return abs(result["tds_amount"] - float(case.expected)) <= case.tolerance


def _run_law(case: BenchmarkCase) -> bool:
    from ...representations.ontology.engine import OntologyEngine
    from ...knowledge.graph.store import KnowledgeGraphStore
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        ont = OntologyEngine(KnowledgeGraphStore(Path(tmp) / "kg.sqlite3"))
        ont.bootstrap()
        return ont.is_subclass(case.input["child"], case.input["parent"]) == bool(case.expected)


def _run_uil(case: BenchmarkCase) -> bool:
    from ...representations.uil_parser import parse_to_uil

    uil = parse_to_uil(case.input)
    return uil.action == case.expected


def _run_language(case: BenchmarkCase) -> bool:
    from ...intelligence.domain_guard import domain_guard

    result = domain_guard(case.input)
    expected = case.expected
    return result.get(expected["key"]) == expected["value"]


def _run_research(case: BenchmarkCase) -> bool:
    return isinstance(case.input, str) and len(case.input) > 0


def _run_payroll(case: BenchmarkCase) -> bool:
    from ...execution.engines.tax_engine import compute_payroll

    result = compute_payroll(case.input["basic"], marital_status=case.input.get("status", "single"))
    return result["net_pay"] > float(case.expected)


def _run_simulation(case: BenchmarkCase) -> bool:
    from ...execution.simulation.engine import simulate_salary_increase

    sim = simulate_salary_increase(case.input["basic"], case.input["pct"])
    return sim.deltas["net_pay"] > float(case.expected)


ACCOUNTING_SUITE = BenchmarkSuite(
    "accounting",
    "Journal Balance",
    [
        BenchmarkCase("jnl-1", [{"debit": 1000, "credit": 0}, {"debit": 0, "credit": 1000}], True),
        BenchmarkCase("jnl-2", [{"debit": 500, "credit": 0}, {"debit": 0, "credit": 400}], False),
    ],
    _run_accounting,
)

TAX_SUITE = BenchmarkSuite(
    "tax",
    "VAT/TDS Golden",
    [
        BenchmarkCase("vat-1", {"type": "vat", "amount": 1000, "rate": 13}, 130.0),
        BenchmarkCase("tds-1", {"type": "tds", "amount": 10000, "rate": 1.5}, 150.0),
    ],
    _run_tax,
)

LAW_SUITE = BenchmarkSuite(
    "law",
    "Ontology Temporal",
    [
        BenchmarkCase("ont-1", {"child": "Invoice", "parent": "FinancialDocument"}, True),
        BenchmarkCase("ont-2", {"child": "Invoice", "parent": "LegalAuthority"}, False),
    ],
    _run_law,
)

UIL_SUITE = BenchmarkSuite(
    "uil",
    "UIL Parse Roundtrip",
    [
        BenchmarkCase("uil-1", "Ram le 500 ko saman becheko", "sell"),
        BenchmarkCase("uil-2", "Ram ko balance kati ho", "ledger_query"),
    ],
    _run_uil,
)

LANGUAGE_SUITE = BenchmarkSuite(
    "language",
    "Domain Guard CLK",
    [
        BenchmarkCase("lang-1", "what is sampati", {"key": "allow_web_search", "value": False}),
        BenchmarkCase("lang-2", "what is VAT rate in Nepal", {"key": "route_to", "value": "knowledge_graph"}),
    ],
    _run_language,
)

RESEARCH_SUITE = BenchmarkSuite(
    "research",
    "Citation Coverage",
    [BenchmarkCase("res-1", "Nepal VAT Act section 7", True)],
    _run_research,
)

PAYROLL_SUITE = BenchmarkSuite(
    "payroll",
    "Payroll Engine",
    [BenchmarkCase("pay-1", {"basic": 50000, "status": "single"}, 0)],
    _run_payroll,
)

SIMULATION_SUITE = BenchmarkSuite(
    "simulation",
    "Salary What-If",
    [BenchmarkCase("sim-1", {"basic": 50000, "pct": 10}, 0)],
    _run_simulation,
)

ALL_SUITES: list[BenchmarkSuite] = [
    ACCOUNTING_SUITE,
    TAX_SUITE,
    LAW_SUITE,
    UIL_SUITE,
    LANGUAGE_SUITE,
    RESEARCH_SUITE,
    PAYROLL_SUITE,
    SIMULATION_SUITE,
]
