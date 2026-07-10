"""NIOS Gateway — sole intelligence entry point (Phase 2 pipeline)."""

from __future__ import annotations

import logging
import re
import time
from dataclasses import asdict
from typing import Any

from ..agent.cascade_router import classify_cascade
from ..api.cache import get_response_cache
from ..bridges.session_data import set_session_context
from .agents.goal_tree import build_goal_tree
from .agents.society import build_society_opinions, consensus_merge
from .cognitive.cognitive_os import MetaDecision
from .cognitive.meta_reasoner import meta_reasoner
from .intelligence.contract_evaluator import evaluate_contract_trace
from .contracts.intelligence_contract import ExplanationEnvelope, TruthRecord, utc_now
from .intelligence.evidence_verify import (
    build_evidence_bundle,
    evidence_from_federation,
    explanation_with_evidence,
)
from .intelligence.domain_guard import domain_guard
from .intelligence.evaluator import (
    evaluate_retrieval,
    evaluate_truth,
    evaluate_uil_confidence,
    merge_evaluations,
)
from .intelligence.research_loop import autonomous_research
from .intelligence.truth_layer import validate_facts
from .kernel.context_manager import context_manager
from .kernel.kernel import KernelContext, get_kernel
from .kernel.resource_manager import resource_manager
from .knowledge.erp_retrieval import format_party_balance_answer
from .knowledge.policy_engine import PolicyContext, policies_pass
from .representations.uil_parser import parse_to_uil
from ..khata import khata_chat as khata_chat_fn
from .intelligence.explanation_engine import (
    envelope_to_dict,
    explanation_from_scenario,
    explanation_from_simulation,
)
from .execution.simulation.engine import parse_salary_simulation_from_message, simulate_salary_increase
from .execution.scenario.engine import compare_salary_scenarios, compare_branch_opening
from .gateway_scheduler import execute_goal_tree

logger = logging.getLogger(__name__)

_BALANCE = re.compile(r"\b(balance|bakaya|baki|शेष|kitna|kati)\b", re.I)
_SIMULATE = re.compile(
    r"\b(what\s*if|simulate|simulation|scenario|optimize|compare|what-if)\b",
    re.I,
)
_LEGAL = re.compile(r"\b(act|law|legal|circular|court|statute|labor act|vat act)\b", re.I)
_INVEST = re.compile(r"\b(nepse|dcf|npv|irr|portfolio|invest|stock market|hidcl|nabil)\b", re.I)
_CONSULT = re.compile(r"\b(consult|strategy|advisory|plan my|help me grow|business plan)\b", re.I)


class NiosGateway:
    """Kernel → Cognitive OS → Goal Tree → Resource Manager → Execute → Evaluate → Answer."""

    def __init__(self) -> None:
        self.kernel = get_kernel()

    async def chat(
        self,
        message: str,
        *,
        session_id: str,
        tenant_id: str | None = None,
        company_id: str | None = None,
        user_id: str | None = None,
        balance: dict | None = None,
        language: str | None = None,
        context: dict | None = None,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        ctx = KernelContext(
            session_id=session_id,
            tenant_id=tenant_id,
            company_id=company_id,
            user_id=user_id,
            balance=balance,
            language=language,
            metadata=context or {},
        )

        trace: dict[str, Any] = {"engine": "nios_v3", "stages": []}

        # ── Observe + Understand ──
        with self.kernel.telemetry.span("observe"):
            guard = domain_guard(message)
            uil = parse_to_uil(message)
            goal_tree = build_goal_tree(uil, message)
            trace["stages"].append({
                "stage": "observe",
                "uil_action": uil.action,
                "goal": goal_tree.goal,
                "domain_guard": guard,
            })

        if balance:
            set_session_context(session_id, balance)

        # ── World State + Federation (Phase 4) — before reasoning ──
        with self.kernel.telemetry.span("world_state"):
            ws_query = self.kernel.world_state.query(
                intent=uil.action,
                tenant_id=tenant_id,
                company_id=company_id,
                balance=balance,
            )
            fed_evidence = self.kernel.federation.query(
                uil.action,
                message,
                context={"balance": balance, "tenant_id": tenant_id, "company_id": company_id},
            )
            trace["stages"].append({
                "stage": "world_state",
                "domains": [d.value for d in ws_query.domains],
                "summary": ws_query.summary,
                "federation_sources": len(fed_evidence),
            })
            trace["world_state"] = ws_query.summary

        caps = [c.id for c in self.kernel.registry.list_all()]
        meta_ctx = {
            "message": message,
            "uil_confidence": uil.confidence,
            "uil_action": uil.action,
            "capabilities": caps,
            "evidence_coverage": min(1.0, len(fed_evidence) / 3) if fed_evidence else 0.5,
        }
        meta_best = meta_reasoner.best_action(meta_ctx)
        with self.kernel.telemetry.span("cognitive_meta"):
            decision = self.kernel.cognitive.meta_decide(message, uil.confidence, caps)
            trace["stages"].append({
                "stage": "meta_reason",
                "decision": asdict(decision),
                "meta_best": asdict(meta_best),
            })
            if meta_best.skip_llm and decision.action == "escalate_model":
                decision = MetaDecision("execute_capability", meta_best.reason, meta_best.confidence)

        eval_report = merge_evaluations(evaluate_uil_confidence(uil.confidence))

        cache = get_response_cache()
        resource = resource_manager.decide(
            meta_action=decision.action,
            uil_confidence=uil.confidence,
            cascade_model="4b",
            cache_available=True,
            is_complex_goal=len(goal_tree.steps) > 2 and uil.action == "tax_query",
        )
        trace["stages"].append({"stage": "resource", "decision": asdict(resource)})

        # ── Goal Tree via DynamicScheduler (multi-step DAG) ──
        if len(goal_tree.steps) >= 2 and uil.action in ("ledger_query", "sell", "purchase", "tax_query"):
            with self.kernel.telemetry.span("scheduler"):
                sched = await execute_goal_tree(goal_tree, ctx, message)
                trace["stages"].append({
                    "stage": "scheduler",
                    "ok": sched.get("ok"),
                    "steps_run": len(sched.get("step_results", {})),
                    "errors": sched.get("errors", []),
                })
                if sched.get("ok") and sched.get("answer"):
                    caps = sched.get("capabilities_used") or goal_tree.required_capabilities
                    resource_manager.record_tier(resource.tier, decision.action, engine="nios_scheduler")
                    resource_manager.record_latency((time.perf_counter() - t0) * 1000)
                    explanation = explanation_with_evidence(
                        sched["answer"],
                        caps,
                        confidence=goal_tree.confidence,
                        session_id=session_id,
                    )
                    return self._response(
                        sched["answer"],
                        session_id=session_id,
                        intent=uil.action,
                        confidence=goal_tree.confidence,
                        engine="nios_scheduler",
                        capabilities_used=caps,
                        trace=trace,
                        explanation=explanation,
                    )

        # ── Tier 1: Cache ──
        if resource.use_cache:
            with self.kernel.telemetry.span("cache_lookup"):
                cached = cache.get(message)
                if cached:
                    trace["stages"].append({"stage": "cache", "hit": True})
                    resource_manager.record_latency((time.perf_counter() - t0) * 1000)
                    return self._response(
                        cached["response"],
                        session_id=session_id,
                        intent="cached",
                        confidence=0.95,
                        engine="nios_cache",
                        capabilities_used=["cap.cache.semantic"],
                        trace=trace,
                    )
                trace["stages"].append({"stage": "cache", "hit": False})

        # ── Tier 0/2: Deterministic routes ──
        route_result = await self._route(message, ctx, decision, trace, uil)
        if route_result:
            cache.put(message, route_result["answer"], intent=route_result.get("intent"))
            resource_manager.record_latency((time.perf_counter() - t0) * 1000)
            return route_result

        # ── Tier 3+: Research + Multi-agent + Cascade ──
        research = await autonomous_research(message, intent="accounting_qa")
        eval_report = merge_evaluations(
            evaluate_uil_confidence(uil.confidence),
            evaluate_retrieval(research.chunks),
        )
        trace["stages"].append({
            "stage": "research",
            "iterations": research.iterations,
            "confidence": research.confidence,
            "chunks": len(research.chunks),
        })

        context_bundle = context_manager.build(
            message=message,
            uil_action=uil.action,
            session_id=session_id,
            balance=balance,
            retrieval_chunks=research.chunks,
            goal_tree_summary=goal_tree.goal,
            token_budget=resource.token_budget,
        )
        trace["stages"].append({
            "stage": "context",
            "slices": len(context_bundle.slices),
            "tokens_used": context_bundle.tokens_used,
        })

        # Multi-agent consensus for tax queries
        if uil.action == "tax_query" and research.chunks:
            evidence_text = "\n".join(c.get("text", "")[:200] for c in research.chunks[:3])
            opinions = build_society_opinions(message, evidence_text, None, uil.confidence, uil_action=uil.action)
            merged = consensus_merge(opinions)
            trace["stages"].append({"stage": "agent_society", "consensus": merged})

            policy_ok = policies_pass(
                PolicyContext(
                    capability_id="cap.knowledge.nepal.search",
                    has_engine_evidence=False,
                    has_legal_citation=bool(research.chunks),
                    amount_mentioned=bool(re.search(r"\d", message)),
                )
            )

            if merged["consensus"] and research.confidence >= 0.5:
                answer = self._format_knowledge_answer(research.chunks, merged)
                fed_evidence = evidence_from_federation(research.chunks)
                bundle = build_evidence_bundle(
                    answer,
                    ["cap.knowledge.nepal.search", "agent.society"],
                    session_id=session_id,
                    extra_evidence=fed_evidence,
                )
                validation = validate_facts(
                    [{"text": t.statement, "evidence": t.evidence, "source": t.source} for t in bundle["truth_records"]]
                )
                eval_report = merge_evaluations(
                    *eval_report.scores,
                    evaluate_truth(validation.ok, len(validation.unsupported)),
                )

                if policy_ok and validation.ok:
                    cache.put(message, answer, intent="accounting_qa")
                    resource_manager.record_latency((time.perf_counter() - t0) * 1000)
                    explanation = explanation_with_evidence(
                        answer,
                        ["cap.knowledge.nepal.search", "agent.society"],
                        confidence=merged["confidence"],
                        session_id=session_id,
                    )
                    return self._response(
                        answer,
                        session_id=session_id,
                        intent="accounting_qa",
                        confidence=merged["confidence"],
                        engine="nios_research_consensus",
                        capabilities_used=["cap.knowledge.nepal.search", "agent.society"],
                        trace=trace,
                        explanation=explanation,
                    )

        # Cascade fallback
        with self.kernel.telemetry.span("cascade_route"):
            cascade = await classify_cascade(message, rag_hit=len(research.chunks) > 0)
            resource = resource_manager.decide(
                meta_action=decision.action,
                uil_confidence=uil.confidence,
                cascade_model=cascade.model,
                cache_available=False,
            )
            trace["stages"].append({
                "stage": "cascade",
                "model": resource.tier,
                "intent": cascade.intent,
                "eval_min_score": eval_report.min_score,
            })

        if research.chunks and eval_report.should_research is False:
            answer = self._format_knowledge_answer(research.chunks, {"statement": "", "confidence": research.confidence})
            cache.put(message, answer, intent=cascade.intent)
            resource_manager.record_latency((time.perf_counter() - t0) * 1000)
            return self._response(
                answer,
                session_id=session_id,
                intent=cascade.intent,
                confidence=research.confidence,
                engine=f"nios_research_{resource.tier}",
                capabilities_used=["cap.knowledge.nepal.search"],
                trace=trace,
            )

        fallback = (
            f"I found limited evidence for your question. "
            f"Intent: {cascade.intent}. Try rephrasing or provide more context."
        )
        resource_manager.record_latency((time.perf_counter() - t0) * 1000)
        return self._response(
            fallback,
            session_id=session_id,
            intent=cascade.intent,
            confidence=cascade.confidence * 0.5,
            engine=f"nios_cascade_{resource.tier}",
            capabilities_used=["cap.chat.route"],
            trace=trace,
        )

    async def simulate(
        self,
        *,
        basic_salary: float,
        increase_percent: float,
        gross_salary: float | None = None,
        marital_status: str = "single",
        monthly_expenses: float = 0,
        cash_balance: float = 0,
        session_id: str = "sim",
    ) -> dict[str, Any]:
        sim = simulate_salary_increase(
            basic_salary,
            increase_percent,
            gross_salary=gross_salary,
            marital_status=marital_status,
            monthly_expenses=monthly_expenses,
            cash_balance=cash_balance,
        )
        explanation = explanation_from_simulation(sim)
        return {
            "simulation_id": sim.simulation_id,
            "scenario": sim.scenario,
            "baseline": sim.baseline,
            "projected": sim.projected,
            "deltas": sim.deltas,
            "impacts": sim.impacts,
            "confidence": sim.confidence,
            "explanation": envelope_to_dict(explanation),
            "capabilities_used": ["cap.engine.payroll", "cap.engine.simulation"],
        }

    async def scenario(
        self,
        *,
        scenario_type: str = "salary_compare",
        basic_salary: float = 50_000,
        increases: list[float] | None = None,
        gross_salary: float | None = None,
        cash_balance: float = 0,
        monthly_revenue: float = 0,
        monthly_cost: float = 0,
        setup_cost: float = 0,
    ) -> dict[str, Any]:
        if scenario_type == "branch_opening":
            comparison = compare_branch_opening(
                monthly_revenue or 200_000,
                monthly_cost or 150_000,
                setup_cost or 500_000,
            )
            caps = ["cap.engine.accounting", "cap.engine.simulation"]
        else:
            comparison = compare_salary_scenarios(
                basic_salary,
                increases,
                gross_salary=gross_salary,
                cash_balance=cash_balance,
            )
            caps = ["cap.engine.payroll", "cap.engine.simulation"]

        explanation = explanation_from_scenario(comparison)
        return {
            "scenario_id": comparison.scenario_id,
            "title": comparison.title,
            "recommendation": comparison.recommendation,
            "tradeoffs": comparison.tradeoffs,
            "branches": [
                {
                    "id": b.id,
                    "name": b.name,
                    "assumptions": b.assumptions,
                    "results": b.results,
                    "score": b.score,
                }
                for b in comparison.branches
            ],
            "explanation": envelope_to_dict(explanation),
            "capabilities_used": caps,
        }

    def _format_knowledge_answer(self, chunks: list[dict], merged: dict) -> str:
        if not chunks:
            return merged.get("statement") or "No relevant knowledge found."
        top = chunks[0]
        text = (top.get("text") or "").strip()
        source = top.get("metadata", {}).get("source", "Nepal knowledge base")
        section = top.get("metadata", {}).get("section", "")
        cite = f" [{section}]" if section else f" [{source}]"
        return f"{text[:800]}{cite}"

    async def _route(
        self,
        message: str,
        ctx: KernelContext,
        decision: MetaDecision,
        trace: dict[str, Any],
        uil,
    ) -> dict[str, Any] | None:
        # Legal Nepal (Phase 6)
        if _LEGAL.search(message) or uil.action == "legal_query":
            result = self.kernel.legal.search(message)
            answer = self.kernel.legal.format_answer(result)
            trace["stages"].append({"stage": "legal", "hits": len(result.acts) + len(result.circulars)})
            return self._response(
                answer,
                session_id=ctx.session_id,
                intent="legal_query",
                confidence=result.confidence,
                engine="nios_legal",
                capabilities_used=["cap.legal.act_search", "cap.legal.circular_lookup"],
                trace=trace,
            )

        # Investment / NEPSE (Phase 6)
        if _INVEST.search(message) or uil.action == "investment_query":
            sym_m = re.search(r"\b([A-Z]{3,6})\b", message)
            if sym_m:
                quote = self.kernel.investment.nepse_quote(sym_m.group(1))
                if quote:
                    answer = (
                        f"{sym_m.group(1)}: LTP Rs. {quote['ltp']:,.2f} | "
                        f"P/E {quote['pe']} | EPS {quote['eps']} | Sector: {quote['sector']}"
                    )
                    trace["stages"].append({"stage": "investment", "symbol": sym_m.group(1)})
                    return self._response(
                        answer,
                        session_id=ctx.session_id,
                        intent="investment_query",
                        confidence=1.0,
                        engine="nios_investment",
                        capabilities_used=["cap.investment.nepse_quote"],
                        trace=trace,
                    )
            dcf_m = re.search(r"invest(?:ment)?\s*(?:of\s*)?(?:rs\.?|npr)?\s*([\d,]+)", message, re.I)
            if dcf_m:
                initial = float(dcf_m.group(1).replace(",", ""))
                dcf = self.kernel.investment.dcf(initial, [initial * 0.25, initial * 0.3, initial * 0.35])
                answer = f"DCF NPV: Rs. {dcf.npv:,.2f}" + (f" | IRR: {dcf.irr}%" if dcf.irr else "")
                return self._response(
                    answer,
                    session_id=ctx.session_id,
                    intent="investment_query",
                    confidence=0.95,
                    engine="nios_investment_dcf",
                    capabilities_used=["cap.investment.dcf_run"],
                    trace=trace,
                )

        # Business Consultant (Phase 6)
        if _CONSULT.search(message) or uil.action == "consultant":
            plan = self.kernel.consultant.compose(message)
            answer = (
                f"**Advisory Plan** (confidence {plan.confidence:.0%})\n\n"
                + "\n".join(plan.steps)
                + f"\n\nWorkflows: {', '.join(w['name'] for w in plan.workflows if w.get('name'))}"
            )
            trace["stages"].append({"stage": "consultant", "workflows": len(plan.workflows)})
            return self._response(
                answer,
                session_id=ctx.session_id,
                intent="consultant",
                confidence=plan.confidence,
                engine="nios_consultant",
                capabilities_used=["cap.consultant.workflow_compose"],
                trace=trace,
            )

        # Simulation / what-if / optimize (Phase 3 + gap-4)
        if _SIMULATE.search(message) or uil.action in ("simulate", "scenario", "optimize"):
            if re.search(r"\boptimize\b", message, re.I):
                from .execution.optimization.engine import optimization_engine

                budget_m = re.search(r"(?:budget|salary|pay)\s*(?:rs\.?|npr)?\s*([\d,]+)", message, re.I)
                budget = float(budget_m.group(1).replace(",", "")) if budget_m else 80_000
                opt = optimization_engine.optimize_salary_structure(budget)
                rec = opt.recommended
                answer = (
                    f"**Payroll Optimization** — {rec.label if rec else 'n/a'}\n"
                    f"{rec.rationale if rec else 'No feasible option'}"
                )
                explanation = explanation_with_evidence(
                    answer,
                    ["cap.engine.optimization", "cap.engine.payroll"],
                    confidence=opt.confidence,
                    session_id=ctx.session_id,
                    formula_used=["cap.engine.optimization"],
                )
                trace["stages"].append({"stage": "optimization", "domain": opt.domain})
                return self._response(
                    answer,
                    session_id=ctx.session_id,
                    intent="optimize",
                    confidence=opt.confidence,
                    engine="nios_optimization",
                    capabilities_used=["cap.engine.optimization", "cap.engine.payroll"],
                    trace=trace,
                    explanation=explanation,
                )

            params = parse_salary_simulation_from_message(message)
            cash = float((ctx.balance or {}).get("cash", (ctx.balance or {}).get("cashBalance", 0)) or 0)
            if params:
                sim = simulate_salary_increase(
                    params["basic_salary"],
                    params["increase_percent"],
                    cash_balance=cash,
                )
                explanation = explanation_from_simulation(sim)
                answer = "\n".join(sim.impacts)
                trace["stages"].append({"stage": "simulation", "scenario": sim.scenario})
                return self._response(
                    answer,
                    session_id=ctx.session_id,
                    intent="simulation",
                    confidence=1.0,
                    engine="nios_simulation",
                    capabilities_used=["cap.engine.payroll", "cap.engine.simulation"],
                    trace=trace,
                    explanation=explanation,
                )
            if re.search(r"\bcompare\b", message, re.I):
                comparison = compare_salary_scenarios(
                    params["basic_salary"] if params else 50_000,
                    cash_balance=cash,
                )
                explanation = explanation_from_scenario(comparison)
                trace["stages"].append({"stage": "scenario", "branches": len(comparison.branches)})
                return self._response(
                    comparison.recommendation + "\n" + "\n".join(comparison.tradeoffs),
                    session_id=ctx.session_id,
                    intent="scenario",
                    confidence=0.95,
                    engine="nios_scenario",
                    capabilities_used=["cap.engine.payroll", "cap.engine.simulation"],
                    trace=trace,
                    explanation=explanation,
                )

        # Party-specific balance from ERP snapshot
        party_answer = format_party_balance_answer(ctx.session_id, message)
        if party_answer and _BALANCE.search(message):
            trace["stages"].append({"stage": "erp_party_balance", "ok": True})
            return self._response(
                party_answer,
                session_id=ctx.session_id,
                intent="ledger_query",
                confidence=1.0,
                engine="nios_erp_retrieval",
                capabilities_used=["cap.erp.ledger.balance", "cap.erp.session_snapshot"],
                trace=trace,
            )

        khata_hints = re.search(
            r"\b(\d{2,}|bikyo|becheko|kineko|aayo|gayo|diya|liyo|sale|purchase|बेच|किन)\b",
            message,
            re.I,
        )
        if khata_hints and decision.action in ("execute_capability", "escalate_model", "calculate"):
            with self.kernel.telemetry.span("khata_entry"):
                result = khata_chat_fn(
                    message, ctx.session_id, ctx.balance, ctx.language,
                )
                trace["stages"].append({"stage": "khata", "kind": result.get("kind")})
                if result.get("reply"):
                    return self._response(
                        result["reply"],
                        session_id=ctx.session_id,
                        intent="khata_entry",
                        confidence=0.85,
                        engine="nios_khata",
                        capabilities_used=["cap.khata.entry.parse"],
                        trace=trace,
                        card=result.get("card"),
                    )

        if _BALANCE.search(message) and ctx.balance:
            with self.kernel.telemetry.span("ledger_balance"):
                explanation = self._balance_from_snapshot(ctx.balance)
                trace["stages"].append({"stage": "ledger_balance", "ok": True})
                return self._response(
                    explanation.summary,
                    session_id=ctx.session_id,
                    intent="ledger_query",
                    confidence=1.0,
                    engine="nios_deterministic",
                    capabilities_used=["cap.erp.ledger.balance", "cap.erp.session_snapshot"],
                    trace=trace,
                    explanation=explanation,
                )

        return None

    def _balance_from_snapshot(self, balance: dict) -> ExplanationEnvelope:
        cash = balance.get("cash", balance.get("cashBalance", 0))
        bank = balance.get("bank", balance.get("bankBalance", 0))
        receivable = balance.get("receivable", balance.get("receivables", 0))
        payable = balance.get("payable", balance.get("payables", 0))

        truth = TruthRecord(
            statement=f"Cash: {cash}, Bank: {bank}, Receivable: {receivable}, Payable: {payable}",
            evidence=["erp.session_snapshot"],
            source="cap.erp.session_snapshot",
            confidence=1.0,
            timestamp=utc_now(),
            verification_status="verified_deterministic",
            jurisdiction="NP",
        )
        return explanation_with_evidence(
            (
                f"Cash: Rs. {float(cash):,.2f} | Bank: Rs. {float(bank):,.2f} | "
                f"Receivable: Rs. {float(receivable):,.2f} | Payable: Rs. {float(payable):,.2f}"
            ),
            ["cap.erp.ledger.balance", "cap.erp.session_snapshot"],
            confidence=1.0,
            formula_used=["cap.erp.ledger.balance"],
            extra_truth=[truth],
        )

    def _response(
        self,
        answer: str,
        *,
        session_id: str,
        intent: str,
        confidence: float,
        engine: str,
        capabilities_used: list[str],
        trace: dict[str, Any],
        explanation: ExplanationEnvelope | None = None,
        card: dict | None = None,
    ) -> dict[str, Any]:
        resource_manager.record_tier("none", "execute_capability", engine=engine)
        trace["spans"] = self.kernel.telemetry.flush()
        self.kernel.events.emit(
            "nios.chat.completed",
            {"intent": intent, "engine": engine, "capabilities": capabilities_used, "confidence": confidence},
            session_id=session_id,
        )
        improvement = self.kernel.self_improvement.record_chat_outcome(
            session_id=session_id,
            intent=intent,
            confidence=confidence,
            engine=engine,
        )
        payload: dict[str, Any] = {
            "answer": answer,
            "session_id": session_id,
            "intent": intent,
            "confidence": confidence,
            "engine": engine,
            "capabilities_used": capabilities_used,
            "trace": trace,
            "learning": self.kernel.self_improvement.to_dict(improvement),
        }
        if explanation:
            payload["explanation"] = envelope_to_dict(explanation)
        if session_id and capabilities_used:
            bundle = build_evidence_bundle(
                answer,
                capabilities_used,
                session_id=session_id,
            )
            payload["evidence"] = {
                "validation": bundle["validation"],
                "provenance_coverage": bundle.get("provenance_coverage"),
            }
        if card:
            payload["card"] = card
        return payload


_gateway: NiosGateway | None = None


def get_gateway() -> NiosGateway:
    global _gateway
    if _gateway is None:
        _gateway = NiosGateway()
    return _gateway
