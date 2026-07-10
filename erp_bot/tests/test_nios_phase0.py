"""Tests for NIOS Platform Phase 0."""

from __future__ import annotations

import pytest

from src.nios.contracts.intelligence_contract import make_uil, make_observation, ObserveContext
from src.nios.kernel.capability_registry import registry
from src.nios.kernel.event_bus import event_bus
from src.nios.cognitive.cognitive_os import cognitive_os


def test_capability_registry_has_ten_capabilities():
    caps = registry.list_all()
    assert len(caps) >= 10
    assert registry.get("cap.tax.vat.calculate") is not None


def test_make_uil_from_text():
    uil = make_uil("Ram ko balance", action="ledger_query", confidence=0.8)
    assert uil.action == "ledger_query"
    assert uil.source_text == "Ram ko balance"
    assert uil.confidence == 0.8


def test_event_bus_emit():
    received = []

    def handler(event):
        received.append(event)

    event_bus.subscribe("voucher.posted", handler)
    event = event_bus.emit("voucher.posted", {"voucherId": "jnl-1"})
    assert event.type == "voucher.posted"
    assert len(received) == 1
    assert received[0].payload["voucherId"] == "jnl-1"


def test_cognitive_meta_decide_balance():
    decision = cognitive_os.meta_decide("Ram ko balance kati ho?", 0.7, ["cap.erp.ledger.balance"])
    assert decision.action == "execute_capability"
    assert decision.confidence >= 0.9


def test_observation_from_context():
    ctx = ObserveContext(session_id="sess-1", channel="chat", raw_input={"message": "hello"})
    obs = make_observation(ctx, "hello")
    assert obs.session_id == "sess-1"
    assert obs.raw_text == "hello"


def test_uil_parser_sell():
    from src.nios.representations.uil_parser import parse_to_uil

    uil = parse_to_uil("Ram le 500 ko saman becheko")
    assert uil.action == "sell"
    assert uil.confidence >= 0.75


def test_domain_guard_sampati():
    from src.nios.intelligence.domain_guard import domain_guard

    result = domain_guard("what is sampati")
    assert result["allow_web_search"] is False
    assert result["route_to"] == "accounting_lexicon"


# Phase 2 tests

def test_goal_tree_ledger():
    from src.nios.agents.goal_tree import build_goal_tree
    from src.nios.representations.uil_parser import parse_to_uil

    uil = parse_to_uil("Ram ko balance kati ho")
    tree = build_goal_tree(uil, "Ram ko balance kati ho")
    assert tree.goal
    assert "cap.erp.ledger.balance" in tree.required_capabilities


def test_resource_manager_deterministic():
    from src.nios.kernel.resource_manager import resource_manager

    d = resource_manager.decide(
        meta_action="execute_capability",
        uil_confidence=0.9,
        cascade_model="32b",
    )
    assert d.tier == "none"


def test_agent_consensus():
    from src.nios.agents.society import AgentOpinion, consensus_merge

    ops = [
        AgentOpinion(role="calculator", statement="VAT=13%", confidence=1.0, evidence=["engine"]),
        AgentOpinion(role="lawyer", statement="VAT Act applies", confidence=0.85, evidence=["law"]),
    ]
    merged = consensus_merge(ops)
    assert merged["confidence"] > 0
    assert "calculator" in merged["roles"] or "lawyer" in merged["roles"]


def test_evaluator_retrieval():
    from src.nios.intelligence.evaluator import evaluate_retrieval, merge_evaluations

    score = evaluate_retrieval([{"text": "vat"}])
    report = merge_evaluations(score)
    assert report.scores[0].passed


def test_erp_party_search():
    from src.nios.knowledge.erp_retrieval import search_parties
    from src.bridges.session_data import set_session_context

    set_session_context("test-sess", {
        "parties": [{"name": "Ram Traders", "balance": 5000}],
    })
    hits = search_parties("test-sess", "Ram")
    assert len(hits) == 1
    assert hits[0]["name"] == "Ram Traders"


# Phase 3 tests

def test_payroll_engine():
    from src.nios.execution.engines.tax_engine import compute_payroll

    result = compute_payroll(50_000, marital_status="single")
    assert result["net_pay"] > 0
    assert result["tds_monthly"] >= 0
    assert result["engine"] == "cap.engine.payroll"


def test_salary_simulation():
    from src.nios.execution.simulation.engine import simulate_salary_increase

    sim = simulate_salary_increase(50_000, 15.0, cash_balance=500_000)
    assert sim.deltas["net_pay"] > 0
    assert sim.deltas["employer_cost"] > 0
    assert len(sim.impacts) >= 3


def test_scenario_compare():
    from src.nios.execution.scenario.engine import compare_salary_scenarios

    comparison = compare_salary_scenarios(50_000, [5, 10, 15])
    assert len(comparison.branches) == 3
    assert comparison.recommendation


def test_tax_rule_dsl():
    from src.nios.dsl.tax_rule_dsl import BOOTSTRAP_TAX_RULES, execute_tax_rule

    assert len(BOOTSTRAP_TAX_RULES) >= 1
    result = execute_tax_rule(
        BOOTSTRAP_TAX_RULES[0],
        {"service_type": "standard", "taxable_amount": 1000},
    )
    assert result is not None
    assert result["vat_amount"] == 130.0


def test_workflow_dsl_dispatch():
    from src.nios.dsl.workflow_dsl import workflow_engine

    steps = workflow_engine.dispatch_sync("voucher.posted", {"voucherId": "v1"})
    assert len(steps) >= 2


def test_skill_marketplace():
    from src.nios.marketplace.skills import marketplace

    skills = marketplace.list_skills()
    assert len(skills) == 20
    assert marketplace.skills.get("skill.salary.simulate") is not None


def test_explanation_envelope():
    from src.nios.execution.simulation.engine import simulate_salary_increase
    from src.nios.intelligence.explanation_engine import explanation_from_simulation, envelope_to_dict

    sim = simulate_salary_increase(40_000, 10)
    env = explanation_from_simulation(sim)
    payload = envelope_to_dict(env)
    assert payload["summary"]
    assert payload["formula_used"]


# Phase 4 tests

def test_world_state_domains():
    from src.nios.representations.world_state.domains import ALL_DOMAINS

    assert len(ALL_DOMAINS) == 12


def test_world_state_event_sync():
    from src.nios.representations.world_state.engine import WorldStateEngine
    from src.nios.representations.world_state.store import WorldStateStore
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        store = WorldStateStore(Path(tmp) / "ws.sqlite3")
        engine = WorldStateEngine(store)
        updates = engine.on_event(
            "invoice.created",
            {"invoiceId": "inv-1", "partyName": "Ram", "grandTotal": 11300},
            company_id="co-1",
        )
        assert len(updates) >= 1
        ws = engine.query(intent="tax_query", company_id="co-1")
        assert ws.summary.get("filing_status") == "pending_review"


def test_knowledge_graph_temporal():
    from src.nios.knowledge.graph.store import KnowledgeGraphStore
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        store = KnowledgeGraphStore(Path(tmp) / "kg.sqlite3")
        nid = store.add_node("VAT Act", "LegalAuthority", valid_from="2020-01-01")
        nodes = store.find_nodes(node_type="LegalAuthority", as_of="2025-01-01")
        assert len(nodes) == 1
        assert nodes[0]["id"] == nid


def test_ontology_temporal_rules():
    from src.nios.representations.ontology.engine import OntologyEngine
    from src.nios.knowledge.graph.store import KnowledgeGraphStore
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        store = KnowledgeGraphStore(Path(tmp) / "kg.sqlite3")
        ont = OntologyEngine(store)
        assert ont.bootstrap() >= 10
        assert ont.is_subclass("Invoice", "FinancialDocument")
        rules = ont.applicable_rules("VATReturn")
        assert any(r["rule_id"] == "vat_standard" for r in rules)


def test_digital_twin():
    from src.nios.representations.digital_twin import DigitalTwinEngine
    from src.nios.representations.world_state.engine import WorldStateEngine
    from src.nios.representations.world_state.store import WorldStateStore
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        ws = WorldStateEngine(WorldStateStore(Path(tmp) / "ws.sqlite3"))
        twin_engine = DigitalTwinEngine(ws)
        twin = twin_engine.build(balance={"cash": 100000, "bank": 50000, "receivables": 20000, "payables": 10000})
        assert twin.health_score > 0
        assert "business" in twin_engine.to_dict(twin)


def test_prediction_cashflow():
    from src.nios.intelligence.prediction import prediction_engine

    result = prediction_engine.forecast_cashflow(balance={"cash": 200000, "bank": 100000}, horizon_months=3)
    assert len(result.points) == 3
    assert result.points[0].value > 0


def test_autonomous_vat_monitor():
    from src.nios.kernel.autonomous_tasks import AutonomousTaskEngine
    from src.nios.representations.world_state.engine import world_state_engine
    import tempfile
    from pathlib import Path
    from src.nios.representations.world_state.store import WorldStateStore

    with tempfile.TemporaryDirectory() as tmp:
        world_state_engine.store = WorldStateStore(Path(tmp) / "ws.sqlite3")
        world_state_engine.on_event("invoice.created", {"grandTotal": 5000}, company_id="c1")
        tasks = AutonomousTaskEngine()
        spawned = tasks.run_monitors({})
        assert any("VAT" in t.title for t in spawned)


def test_learning_hierarchy():
    from src.nios.learning.hierarchy import LearningHierarchy
    from src.nios.knowledge.graph.store import KnowledgeGraphStore
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        h = LearningHierarchy(KnowledgeGraphStore(Path(tmp) / "kg.sqlite3"))
        for i in range(3):
            h.observe("chat_outcome", {"intent": "tax_query", "confidence": 0.8})
        assert len(h._patterns) >= 1


def test_federation_query():
    from src.nios.knowledge.federation import FederatedKnowledge

    fed = FederatedKnowledge()
    evidence = fed.query("tax_query", "vat rate", context={"balance": {"cash": 50000}})
    assert len(evidence) >= 1
    assert evidence[0].authority > 0


# Phase 5 tests

def test_governance_audit():
    import tempfile
    from pathlib import Path
    from src.nios.governance.audit import AuditLog

    with tempfile.TemporaryDirectory() as tmp:
        log = AuditLog(Path(tmp) / "audit.sqlite3")
        eid = log.record("test.action", tenant_id="t1", payload={"x": 1})
        entries = log.list_entries(tenant_id="t1")
        assert len(entries) == 1
        assert entries[0]["id"] == eid


def test_governance_approval_gate():
    from src.nios.governance.engine import governance_engine

    result = governance_engine.gate_action("cap.ocr.invoice", confidence=0.5)
    assert result["allowed"] is False
    assert "approval_id" in result


def test_nightly_benchmarks():
    import tempfile
    from pathlib import Path
    from src.nios.benchmarks.nightly.runner import NightlyBenchmarkRunner

    with tempfile.TemporaryDirectory() as tmp:
        runner = NightlyBenchmarkRunner(Path(tmp))
        report = runner.run_all()
        assert report.total_passed >= 10
        assert len(report.suites) == 8


def test_ocr_pipeline():
    from src.nios.ocr.pipeline import ocr_pipeline

    sample = """
    Invoice No: INV-2024-001
    Date: 2024-07-15
    PAN: 123456789
    VAT: Rs. 1,300
    Grand Total: Rs. 11,300
  Item A    2    5000    10000
    """
    result = ocr_pipeline.process_text(sample)
    assert result["ok"] is True
    assert result["draft"]["grandTotal"] == 11300.0


def test_evolution_adapters():
    from src.nios.learning.evolution.reasoner_adapter import evolution_registry

    adapters = evolution_registry.list_adapters()
    assert len(adapters) >= 2
    assert any(a["id"] == "reasoner.cascade" for a in adapters)


def test_public_api_catalog():
    from src.nios.kernel.kernel import get_kernel

    k = get_kernel()
    assert hasattr(k, "governance")
    assert hasattr(k, "benchmarks")
    assert k.registry.get("cap.ocr.invoice") is not None


# Phase 6 tests

def test_capability_catalog_200_plus():
    from src.nios.marketplace.capability_catalog import generate_catalog_capabilities, DOMAIN_OPERATIONS
    from src.nios.kernel.capability_registry import registry
    from src.nios.marketplace.capability_catalog import register_catalog

    assert len(DOMAIN_OPERATIONS) == 10
    assert sum(len(v) for v in DOMAIN_OPERATIONS.values()) == 200
    caps = generate_catalog_capabilities()
    assert len(caps) == 200
    added = register_catalog(registry)
    assert len(registry.list_all()) >= 200


def test_legal_engine():
    from src.nios.domains.legal.engine import legal_engine

    result = legal_engine.search("VAT act Nepal")
    assert len(result.acts) >= 1
    answer = legal_engine.format_answer(result)
    assert "VAT" in answer


def test_investment_dcf():
    from src.nios.domains.investment.engine import investment_engine

    dcf = investment_engine.dcf(1_000_000, [300_000, 400_000, 500_000], discount_rate=12)
    assert dcf.npv != 0
    quote = investment_engine.nepse_quote("NABIL")
    assert quote and quote["ltp"] > 0


def test_investment_dsl():
    from src.nios.domains.investment.investment_dsl import BOOTSTRAP_INVESTMENT_RULES, execute_investment_rule

    assert len(BOOTSTRAP_INVESTMENT_RULES) >= 1
    result = execute_investment_rule(BOOTSTRAP_INVESTMENT_RULES[-1])
    assert "npv" in result


def test_consultant_compose():
    from src.nios.domains.consultant.composer import consultant_composer

    plan = consultant_composer.compose("Help me with VAT filing and bank reconciliation")
    assert len(plan.workflows) >= 1
    assert plan.confidence > 0


def test_universal_simulation_9_domains():
    from src.nios.execution.simulation.universal import universal_simulation, SIMULATION_DOMAINS

    assert len(SIMULATION_DOMAINS) == 9
    for domain in SIMULATION_DOMAINS:
        result = universal_simulation.run(domain, {"basic_salary": 50000, "increase_percent": 10, "liquidity": 100000})
        assert result.simulation_id


def test_learning_automation():
    from src.nios.learning.automation import LearningAutomation
    from src.nios.learning.hierarchy import LearningHierarchy
    import tempfile
    from pathlib import Path
    from src.nios.knowledge.graph.store import KnowledgeGraphStore

    with tempfile.TemporaryDirectory() as tmp:
        h = LearningHierarchy(KnowledgeGraphStore(Path(tmp) / "kg.sqlite3"))
        auto = LearningAutomation(h)
        for i in range(12):
            h.observe("chat_outcome", {"intent": "tax_query", "confidence": 0.8})
        results = auto.run_pending()
        assert len(results) >= 1
        assert any(r.capability_id for r in results)


def test_domain_plugins_registered():
    from src.nios.marketplace.skills import marketplace
    from src.nios.marketplace.domain_plugins import register_domain_plugins

    counts = register_domain_plugins(marketplace)
    assert marketplace.workflows.get("workflow.legal.research") is not None
    assert marketplace.workflows.get("workflow.investment.analysis") is not None

