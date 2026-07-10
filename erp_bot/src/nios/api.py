"""FastAPI router for NIOS Platform v3."""

from __future__ import annotations

import json

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .gateway import get_gateway
from .kernel.kernel import get_kernel, KernelContext

router = APIRouter(prefix="/nios/v1", tags=["nios-v3"])


class NiosChatRequest(BaseModel):
    message: str = Field(..., max_length=4000, min_length=1)
    session_id: str = Field(..., min_length=1)
    tenant_id: str | None = None
    company_id: str | None = None
    user_id: str | None = None
    balance: dict | None = None
    language: str | None = None
    context: dict | None = None


class NiosSimulateRequest(BaseModel):
    basic_salary: float = Field(..., gt=0)
    increase_percent: float = Field(..., ge=0, le=100)
    gross_salary: float | None = None
    marital_status: str = "single"
    monthly_expenses: float = 0
    cash_balance: float = 0
    session_id: str = "sim"


class NiosScenarioRequest(BaseModel):
    scenario_type: str = "salary_compare"
    basic_salary: float = 50_000
    increases: list[float] | None = None
    gross_salary: float | None = None
    cash_balance: float = 0
    monthly_revenue: float = 0
    monthly_cost: float = 0
    setup_cost: float = 0


@router.get("/status")
async def status() -> dict:
    kernel = get_kernel()
    return {
        "status": "ok",
        "platform": "nios_v3",
        "kernel_enabled": kernel.enabled,
        "capabilities_registered": len(kernel.registry.list_all()),
        "contract_version": "1.0",
    }


@router.get("/capabilities")
async def capabilities() -> dict:
    kernel = get_kernel()
    return {
        "count": len(kernel.registry.list_all()),
        "capabilities": kernel.list_capabilities(),
    }


@router.post("/chat")
async def chat(req: NiosChatRequest) -> dict:
    gateway = get_gateway()
    return await gateway.chat(
        req.message,
        session_id=req.session_id,
        tenant_id=req.tenant_id,
        company_id=req.company_id,
        user_id=req.user_id,
        balance=req.balance,
        language=req.language,
        context=req.context,
    )


@router.post("/chat/stream")
async def chat_stream(req: NiosChatRequest):
    async def event_gen():
        try:
            gateway = get_gateway()
            result = await gateway.chat(
                req.message,
                session_id=req.session_id,
                tenant_id=req.tenant_id,
                company_id=req.company_id,
                user_id=req.user_id,
                balance=req.balance,
                language=req.language,
                context=req.context,
            )
            yield _sse("answer", result)
            yield _sse("done", {"ok": True})
        except Exception as exc:
            yield _sse("error", {"message": str(exc)})

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/simulate")
async def simulate(req: NiosSimulateRequest) -> dict:
    gateway = get_gateway()
    return await gateway.simulate(
        basic_salary=req.basic_salary,
        increase_percent=req.increase_percent,
        gross_salary=req.gross_salary,
        marital_status=req.marital_status,
        monthly_expenses=req.monthly_expenses,
        cash_balance=req.cash_balance,
        session_id=req.session_id,
    )


@router.post("/scenario")
async def scenario(req: NiosScenarioRequest) -> dict:
    gateway = get_gateway()
    return await gateway.scenario(
        scenario_type=req.scenario_type,
        basic_salary=req.basic_salary,
        increases=req.increases,
        gross_salary=req.gross_salary,
        cash_balance=req.cash_balance,
        monthly_revenue=req.monthly_revenue,
        monthly_cost=req.monthly_cost,
        setup_cost=req.setup_cost,
    )


@router.get("/skills")
async def skills() -> dict:
    from .marketplace.skills import marketplace

    return {
        "skills": [s.__dict__ for s in marketplace.list_skills()],
        "workflows": [w.__dict__ for w in marketplace.list_workflows()],
        "count": len(marketplace.list_skills()),
    }


@router.get("/world-state/domains")
async def world_state_domains() -> dict:
    kernel = get_kernel()
    return {"domains": kernel.world_state.list_domains()}


@router.post("/world-state/query")
async def world_state_query(payload: dict) -> dict:
    kernel = get_kernel()
    ws = kernel.world_state.query(
        intent=payload.get("intent", "general"),
        tenant_id=payload.get("tenant_id"),
        company_id=payload.get("company_id"),
        balance=payload.get("balance"),
    )
    return {
        "domains": [d.value for d in ws.domains],
        "slices": ws.slices,
        "summary": ws.summary,
    }


@router.post("/digital-twin")
async def digital_twin(payload: dict) -> dict:
    kernel = get_kernel()
    twin = kernel.digital_twin.build(
        tenant_id=payload.get("tenant_id"),
        company_id=payload.get("company_id"),
        balance=payload.get("balance"),
    )
    return kernel.digital_twin.to_dict(twin)


@router.post("/predict")
async def predict(payload: dict) -> dict:
    from .intelligence.prediction import prediction_engine

    metric = payload.get("metric", "cashflow")
    horizon = int(payload.get("horizon_months", 6))
    if metric == "tax_liability":
        result = prediction_engine.forecast_tax_liability(
            tenant_id=payload.get("tenant_id"),
            company_id=payload.get("company_id"),
            balance=payload.get("balance"),
            horizon_months=horizon,
        )
    else:
        result = prediction_engine.forecast_cashflow(
            tenant_id=payload.get("tenant_id"),
            company_id=payload.get("company_id"),
            balance=payload.get("balance"),
            horizon_months=horizon,
            monthly_burn=float(payload.get("monthly_burn", 0)),
            monthly_inflow=float(payload.get("monthly_inflow", 0)),
        )
    return prediction_engine.to_dict(result)


@router.post("/ontology/query")
async def ontology_query(payload: dict) -> dict:
    from .representations.ontology.engine import ontology_engine

    concept = payload.get("concept", "TaxDecision")
    ontology_engine.bootstrap()
    return {
        "ontology": ontology_engine.query_temporal(
            concept,
            as_of=payload.get("as_of"),
            jurisdiction=payload.get("jurisdiction", "NP"),
            fiscal_year=payload.get("fiscal_year"),
        ),
        "rules": ontology_engine.applicable_rules(
            concept,
            as_of=payload.get("as_of"),
            jurisdiction=payload.get("jurisdiction", "NP"),
        ),
    }


@router.post("/federation/query")
async def federation_query(payload: dict) -> dict:
    kernel = get_kernel()
    evidence = kernel.federation.query(
        payload.get("intent", "general"),
        payload.get("query", ""),
        context=payload.get("context") or {},
    )
    return {
        "count": len(evidence),
        "evidence": [
            {"source": e.source, "authority": e.authority, "text": e.text, "metadata": e.metadata}
            for e in evidence
        ],
    }


@router.get("/tasks")
async def list_tasks() -> dict:
    kernel = get_kernel()
    tasks = kernel.autonomous_tasks.list_tasks()
    return {
        "count": len(tasks),
        "tasks": [
            {
                "id": t.id,
                "type": t.task_type,
                "title": t.title,
                "status": t.status.value,
                "priority": t.priority,
                "due_at": t.due_at,
            }
            for t in tasks
        ],
    }


@router.post("/tasks/monitor")
async def run_task_monitors(payload: dict) -> dict:
    kernel = get_kernel()
    spawned = kernel.autonomous_tasks.run_monitors(payload)
    return {
        "spawned": len(spawned),
        "tasks": [{"id": t.id, "title": t.title, "status": t.status.value} for t in spawned],
    }


@router.post("/events/invoice-created")
async def invoice_created_event(payload: dict) -> dict:
    """Receive invoice.created events from ERP frontend."""
    kernel = get_kernel()
    event = kernel.events.emit(
        "invoice.created",
        payload,
        tenant_id=payload.get("tenantId"),
        company_id=payload.get("companyId"),
        session_id=payload.get("sessionId"),
    )
    return {"ok": True, "event_id": event.id}


@router.post("/events/voucher-posted")
async def voucher_posted_event(payload: dict) -> dict:
    """Receive voucher.posted events from ERP frontend."""
    kernel = get_kernel()
    event = kernel.events.emit(
        "voucher.posted",
        payload,
        tenant_id=payload.get("tenantId"),
        company_id=payload.get("companyId"),
        session_id=payload.get("sessionId"),
    )
    return {"ok": True, "event_id": event.id}


# ── Phase 5: Governance + Evolution + OCR + Public API ──


@router.get("/governance/status")
async def governance_status() -> dict:
    kernel = get_kernel()
    return kernel.governance.status()


@router.get("/governance/audit")
async def governance_audit(tenant_id: str | None = None, limit: int = 50) -> dict:
    kernel = get_kernel()
    entries = kernel.governance.audit.list_entries(tenant_id=tenant_id, limit=limit)
    return {"count": len(entries), "entries": entries}


@router.get("/governance/approvals")
async def governance_approvals(tenant_id: str | None = None) -> dict:
    kernel = get_kernel()
    pending = kernel.governance.approvals.list_pending(tenant_id=tenant_id)
    return {
        "count": len(pending),
        "approvals": [
            {
                "id": r.id,
                "action_type": r.action_type,
                "title": r.title,
                "status": r.status.value,
                "created_at": r.created_at,
            }
            for r in pending
        ],
    }


@router.post("/governance/approvals/{request_id}/decide")
async def governance_decide(request_id: str, payload: dict) -> dict:
    kernel = get_kernel()
    req = kernel.governance.approvals.decide(
        request_id,
        approved=bool(payload.get("approved")),
        decided_by=payload.get("decided_by", "admin"),
        reason=payload.get("reason"),
    )
    if not req:
        return {"ok": False, "error": "Request not found or already decided"}
    return {"ok": True, "status": req.status.value}


@router.get("/evolution/adapters")
async def evolution_adapters() -> dict:
    kernel = get_kernel()
    return {"adapters": kernel.evolution.list_adapters()}


@router.post("/benchmarks/nightly/run")
async def benchmarks_run() -> dict:
    kernel = get_kernel()
    report = kernel.benchmarks.run_all()
    return {
        "ok": report.ok,
        "run_id": report.run_id,
        "total_passed": report.total_passed,
        "total_failed": report.total_failed,
        "regression": report.regression,
        "suites": [
            {"id": s.suite_id, "passed": s.passed, "failed": s.failed, "duration_ms": s.duration_ms}
            for s in report.suites
        ],
    }


@router.get("/benchmarks/nightly/latest")
async def benchmarks_latest() -> dict:
    kernel = get_kernel()
    latest = kernel.benchmarks.latest()
    return latest or {"ok": False, "message": "No benchmark run yet"}


@router.get("/quality-gates")
async def quality_gates(session_id: str | None = None) -> dict:
    from .governance.quality_gates import quality_gate_engine

    report = quality_gate_engine.compute(session_id=session_id)
    return quality_gate_engine.to_dict(report)


@router.get("/architecture/score")
async def architecture_score() -> dict:
    from .governance.architecture_rubric import architecture_rubric

    return architecture_rubric.evaluate().to_dict()


@router.post("/feeds/refresh")
async def feeds_refresh(live: bool = True) -> dict:
    from .knowledge.feeds import refresh_feeds, load_feeds

    result = refresh_feeds(live=live)
    return {"ok": True, "feeds": load_feeds(), "source": result.get("source")}


@router.get("/feeds/export/nepse")
async def feeds_export_nepse() -> dict:
    from .knowledge.feeds import NEPSE_FEED

    return NEPSE_FEED


@router.get("/feeds/export/gov")
async def feeds_export_gov() -> list:
    from .knowledge.feeds import GOV_FEED

    return GOV_FEED


@router.get("/telemetry/stats")
async def telemetry_stats() -> dict:
    from .kernel.telemetry_store import telemetry_store

    return telemetry_store.stats()


@router.post("/compile/uil")
async def compile_uil(payload: dict) -> dict:
    from .dsl.compilers.uil_compiler import compile_uil_pipeline

    text = payload.get("text", "")
    return compile_uil_pipeline(text, service_type=payload.get("service_type", "standard"))


@router.post("/capabilities/{cap_id}/run")
async def run_capability(cap_id: str, payload: dict) -> dict:
    kernel = get_kernel()
    ctx = KernelContext(
        session_id=payload.get("session_id", "api"),
        tenant_id=payload.get("tenant_id"),
        company_id=payload.get("company_id"),
        user_id=payload.get("user_id"),
        balance=payload.get("balance"),
        metadata={"payload": payload.get("payload", {})},
    )
    return kernel.run_capability(cap_id, payload.get("message", ""), ctx)


@router.get("/memory/stats")
async def memory_stats() -> dict:
    kernel = get_kernel()
    backend = getattr(kernel.memory_bus, "backend", "sqlite")
    return {"backend": backend, "levels": kernel.memory_bus.stats()}


@router.get("/plugins")
async def list_plugins() -> dict:
    kernel = get_kernel()
    return {"plugins": kernel.plugins.list_plugins(), "contract_capabilities": len(kernel.plugins.list_plugins())}


class OcrTextRequest(BaseModel):
    text: str = Field(..., min_length=1)
    actor_id: str | None = None


@router.post("/optimize")
async def optimize(payload: dict) -> dict:
    from .execution.optimization.engine import optimization_engine

    domain = payload.get("domain", "payroll")
    if domain == "vat":
        result = optimization_engine.optimize_vat_inclusive_pricing(float(payload.get("target_revenue", 100000)))
    elif domain == "tax":
        result = optimization_engine.optimize_tax_savings(
            float(payload.get("annual_income", 1200000)),
            marital_status=payload.get("marital_status", "single"),
        )
    elif domain == "inventory":
        result = optimization_engine.optimize_inventory_eoq(
            float(payload.get("annual_demand", 1200)),
            float(payload.get("order_cost", 500)),
            float(payload.get("holding_cost", 50)),
        )
    elif domain == "pricing":
        result = optimization_engine.optimize_pricing(
            float(payload.get("unit_cost", 100)),
            float(payload.get("demand_elasticity", 1.2)),
        )
    elif domain == "supplier":
        result = optimization_engine.optimize_supplier(payload.get("suppliers", []))
    else:
        result = optimization_engine.optimize_salary_structure(
            float(payload.get("budget", 80000)),
            marital_status=payload.get("marital_status", "single"),
        )
    return optimization_engine.to_dict(result)


@router.get("/evidence/session/{session_id}")
async def evidence_session(session_id: str) -> dict:
    from .intelligence.provenance_graph import provenance_graph

    return provenance_graph.coverage_for_session(session_id)


@router.post("/ocr/invoice")
async def ocr_invoice(req: OcrTextRequest) -> dict:
    from .ocr.pipeline import ocr_pipeline

    return ocr_pipeline.process_text(req.text, actor_id=req.actor_id)


@router.post("/ocr/invoice/image")
async def ocr_invoice_image(
    file: UploadFile = File(...),
    actor_id: str | None = None,
) -> dict:
    from .ocr.pipeline import ocr_pipeline

    content = await file.read()
    return ocr_pipeline.process_image(content, actor_id=actor_id, filename=file.filename)


@router.get("/public/v1")
async def public_api_surface() -> dict:
    """Public API v1 — full platform surface catalog."""
    kernel = get_kernel()
    return {
        "version": "1.0",
        "platform": "nios_v3",
        "base_path": "/nios/v1",
        "endpoints": {
            "intelligence": ["/chat", "/chat/stream", "/simulate", "/scenario", "/optimize"],
            "world_state": ["/world-state/domains", "/world-state/query", "/digital-twin", "/predict"],
            "knowledge": ["/ontology/query", "/federation/query", "/capabilities", "/skills"],
            "autonomy": ["/tasks", "/tasks/monitor"],
            "governance": ["/governance/status", "/governance/audit", "/governance/approvals"],
            "evolution": ["/evolution/adapters"],
            "benchmarks": ["/benchmarks/nightly/run", "/benchmarks/nightly/latest", "/quality-gates"],
            "compile": ["/compile/uil"],
            "capabilities": ["/capabilities/{cap_id}/run"],
            "memory": ["/memory/stats"],
            "plugins": ["/plugins"],
            "evidence": ["/evidence/session/{session_id}"],
            "ocr": ["/ocr/invoice", "/ocr/invoice/image"],
            "domains": ["/legal/search", "/investment/dcf", "/investment/nepse", "/consultant/compose"],
            "simulation": ["/simulation/domains", "/simulation/universal"],
            "learning": ["/learning/automate"],
            "marketplace": ["/marketplace/catalog"],
            "events": ["/events/invoice-created", "/events/voucher-posted"],
        },
        "capabilities_registered": len(kernel.registry.list_all()),
        "contract_version": "1.0",
    }


# ── Phase 6: Domain Scale ──


@router.post("/legal/search")
async def legal_search(payload: dict) -> dict:
    kernel = get_kernel()
    result = kernel.legal.search(payload.get("query", ""))
    return {
        "confidence": result.confidence,
        "acts": result.acts,
        "circulars": result.circulars,
        "court_decisions": result.court_decisions,
        "summary": kernel.legal.format_answer(result),
    }


@router.post("/investment/dcf")
async def investment_dcf(payload: dict) -> dict:
    kernel = get_kernel()
    result = kernel.investment.dcf(
        float(payload.get("initial_investment", 0)),
        [float(x) for x in payload.get("cashflows", [])],
        discount_rate=float(payload.get("discount_rate", 12)),
    )
    return {
        "npv": result.npv,
        "irr": result.irr,
        "payback_years": result.payback_years,
        "assumptions": result.assumptions,
    }


@router.get("/investment/nepse")
async def investment_nepse(sector: str | None = None) -> dict:
    kernel = get_kernel()
    return {"quotes": kernel.investment.list_nepse(sector)}


@router.post("/consultant/compose")
async def consultant_compose(payload: dict) -> dict:
    kernel = get_kernel()
    plan = kernel.consultant.compose(payload.get("goal", ""))
    return {
        "goal": plan.goal,
        "confidence": plan.confidence,
        "steps": plan.steps,
        "workflows": plan.workflows,
        "skills": plan.skills,
        "capabilities": plan.capabilities,
    }


@router.get("/simulation/domains")
async def simulation_domains() -> dict:
    kernel = get_kernel()
    return {"domains": kernel.universal_sim.list_domains()}


@router.post("/simulation/universal")
async def simulation_universal(payload: dict) -> dict:
    kernel = get_kernel()
    domain = payload.get("domain", "salary")
    result = kernel.universal_sim.run(domain, payload.get("params", {}))
    return {
        "simulation_id": result.simulation_id,
        "domain": result.domain,
        "baseline": result.baseline,
        "projected": result.projected,
        "deltas": result.deltas,
        "impacts": result.impacts,
        "confidence": result.confidence,
    }


@router.post("/learning/automate")
async def learning_automate() -> dict:
    kernel = get_kernel()
    results = kernel.learning_automation.run_pending()
    return {
        "processed": len(results),
        "results": [
            {
                "cluster_key": r.cluster_key,
                "promoted_levels": r.promoted_levels,
                "skill_id": r.skill_id,
                "capability_id": r.capability_id,
                "actions": r.actions,
            }
            for r in results
        ],
    }


@router.get("/marketplace/catalog")
async def marketplace_catalog() -> dict:
    kernel = get_kernel()
    from .marketplace.capability_catalog import DOMAIN_OPERATIONS, SIMULATION_DOMAINS

    return {
        "capabilities_total": len(kernel.registry.list_all()),
        "domains": list(DOMAIN_OPERATIONS.keys()),
        "operations_per_domain": {k: len(v) for k, v in DOMAIN_OPERATIONS.items()},
        "simulation_domains": SIMULATION_DOMAINS,
        "target_year1": 200,
        "target_year2_3": 800,
    }


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
