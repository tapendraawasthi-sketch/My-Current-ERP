"""NIOS OS Kernel — central orchestrator."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field

from ..cognitive.cognitive_os import cognitive_os
from ..cognitive.meta_reasoner import meta_reasoner
from ..knowledge.federation import federated_knowledge
from ..learning.self_improvement import self_improvement_loop
from ..governance.engine import governance_engine
from ..learning.evolution.reasoner_adapter import evolution_registry
from ..benchmarks.nightly.runner import nightly_runner
from ..marketplace.capability_catalog import register_catalog
from ..marketplace.domain_plugins import register_domain_plugins
from ..marketplace.skills import marketplace
from ..domains.legal.engine import legal_engine
from ..domains.investment.engine import investment_engine
from ..domains.consultant.composer import consultant_composer
from ..execution.simulation.universal import universal_simulation
from ..learning.automation import learning_automation
from ..representations.digital_twin import digital_twin_engine
from ..representations.world_state.engine import world_state_engine
from .autonomous_tasks import autonomous_task_engine
from .capability_registry import registry
from .event_bus import event_bus
from .memory_bus import memory_bus
from .plugin_loader import plugin_loader
from .security_manager import security_manager
from ..dsl.workflow_dsl import workflow_engine
from .scheduler import scheduler
from .telemetry import Telemetry

logger = logging.getLogger(__name__)

NIOS_PLATFORM_ENABLED = os.getenv("NIOS_PLATFORM_V3", "true").lower() in ("1", "true", "yes")


@dataclass
class KernelContext:
    session_id: str
    tenant_id: str | None = None
    company_id: str | None = None
    user_id: str | None = None
    balance: dict | None = None
    language: str | None = None
    metadata: dict = field(default_factory=dict)


class NiosKernel:
    """Layer 1 kernel — all requests flow through here."""

    def __init__(self) -> None:
        self.registry = registry
        self.events = event_bus
        self.cognitive = cognitive_os
        self.meta_reasoner = meta_reasoner
        self.scheduler = scheduler
        self.telemetry = Telemetry()
        self.memory_bus = memory_bus
        self.security = security_manager
        self.plugins = plugin_loader
        self.world_state = world_state_engine
        self.federation = federated_knowledge
        self.digital_twin = digital_twin_engine
        self.autonomous_tasks = autonomous_task_engine
        self.self_improvement = self_improvement_loop
        self.governance = governance_engine
        self.evolution = evolution_registry
        self.benchmarks = nightly_runner
        self.legal = legal_engine
        self.investment = investment_engine
        self.consultant = consultant_composer
        self.universal_sim = universal_simulation
        self.learning_automation = learning_automation
        self._bootstrap_platform_scale()
        self._register_default_event_handlers()
        plugin_loader.load_builtin(self.registry)

    def run_capability(self, cap_id: str, message: str, ctx: KernelContext) -> dict:
        """Execute contract-complete capability through kernel security gate."""
        from ..contracts.intelligence_contract import ObserveContext
        from ..capabilities.runtime import capability_runtime

        sec = self.security.authorize_capability(
            cap_id,
            type("SC", (), {"tenant_id": ctx.tenant_id, "company_id": ctx.company_id, "user_id": ctx.user_id, "roles": ["accountant"]})(),
            payload=ctx.metadata.get("payload"),
        )
        if not sec.allowed:
            return {"ok": False, "error": sec.reason}

        observe_ctx = ObserveContext(
            session_id=ctx.session_id,
            channel="api",
            raw_input={"message": message},
            tenant_id=ctx.tenant_id,
            company_id=ctx.company_id,
            user_id=ctx.user_id,
            metadata={"balance": ctx.balance, "payload": ctx.metadata.get("payload", {})},
        )
        import asyncio

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                explanation, trace = pool.submit(
                    asyncio.run,
                    capability_runtime.run(cap_id, observe_ctx, message),
                ).result()
        else:
            explanation, trace = asyncio.run(capability_runtime.run(cap_id, observe_ctx, message))
        self.memory_bus.write("episodic", f"cap:{cap_id}", {"message": message, "summary": explanation.summary}, session_id=ctx.session_id, tenant_id=ctx.tenant_id)
        return {"ok": True, "summary": explanation.summary, "confidence": explanation.confidence, "trace": trace, "security": {"requires_approval": sec.requires_approval}}

    def _bootstrap_platform_scale(self) -> None:
        added = register_catalog(self.registry)
        plugin_counts = register_domain_plugins(marketplace)
        logger.info(
            "[NIOS] Platform scale bootstrap: +%d capabilities, +%d skills, +%d workflows",
            added,
            plugin_counts["skills"],
            plugin_counts["workflows"],
        )

    def _register_default_event_handlers(self) -> None:
        def on_voucher_posted(event) -> None:
            logger.info(
                "[NIOS] voucher.posted tenant=%s company=%s voucher=%s",
                event.tenant_id,
                event.company_id,
                event.payload.get("voucherId"),
            )

        def run_voucher_workflow(event) -> None:
            steps = workflow_engine.dispatch_sync("voucher.posted", event.payload or {})
            logger.info("[NIOS] voucher.posted workflow steps=%d", len(steps))
            self.world_state.on_event(
                "voucher.posted",
                event.payload or {},
                tenant_id=event.tenant_id,
                company_id=event.company_id,
            )

        def run_invoice_workflow(event) -> None:
            steps = workflow_engine.dispatch_sync("invoice.created", event.payload or {})
            logger.info("[NIOS] invoice.created workflow steps=%d", len(steps))
            self.world_state.on_event(
                "invoice.created",
                event.payload or {},
                tenant_id=event.tenant_id,
                company_id=event.company_id,
            )
            self.autonomous_tasks.on_event("invoice.created", event.payload or {})

        self.events.subscribe("voucher.posted", on_voucher_posted)
        self.events.subscribe("voucher.posted", run_voucher_workflow)
        self.events.subscribe("invoice.created", run_invoice_workflow)

    @property
    def enabled(self) -> bool:
        return NIOS_PLATFORM_ENABLED

    def list_capabilities(self) -> list[dict]:
        return [
            {
                "id": c.id,
                "version": c.version,
                "tier": c.tier,
                "provides": c.provides,
                "requires": c.requires,
                "latency_p50_ms": c.latency_p50_ms,
                "cost_tier": c.cost_tier,
                "description": c.description,
            }
            for c in self.registry.list_all()
        ]


_kernel: NiosKernel | None = None


def get_kernel() -> NiosKernel:
    global _kernel
    if _kernel is None:
        _kernel = NiosKernel()
    return _kernel
