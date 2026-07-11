"""OIP operations API — health, metrics, outbox, recovery."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Response

from ..infrastructure.di.container import get_container
from ..infrastructure.observability.metrics import get_metrics_registry
from ..modules.orchestrator.application.commands import RecoverWorkflowsCommand
from ..modules.oec_runtime.infrastructure.persistence.oec_sqlite import TENANT_A
from ..shared.ids import CorrelationId, TenantId, new_correlation_id

router = APIRouter(prefix="/ops", tags=["oip-ops"])


@router.get("/live")
async def liveness() -> dict[str, Any]:
    container = await get_container()
    return await container.readiness_service.liveness()


@router.get("/ready")
async def readiness() -> dict[str, Any]:
    container = await get_container()
    kernel_health = await container.kernel.health()
    return await container.readiness_service.readiness(kernel_health=kernel_health)


@router.get("/metrics")
async def prometheus_metrics() -> Response:
    container = await get_container()
    stats = await container.outbox.get_queue_stats()
    metrics = get_metrics_registry()
    metrics.set_gauge("oip_outbox_queue_depth", stats["unpublished"])
    metrics.set_gauge("oip_outbox_dlq_depth", stats["dead_letter"])
    body = metrics.render_prometheus()
    return Response(content=body, media_type="text/plain; version=0.0.4")


@router.get("/outbox/status")
async def outbox_status() -> dict[str, Any]:
    container = await get_container()
    return await container.outbox.get_queue_stats()


@router.post("/outbox/dispatch")
async def outbox_dispatch(limit: int = 100) -> dict[str, Any]:
    container = await get_container()
    published = await container.outbox_dispatcher.dispatch_pending(limit=limit)
    return {"published": published}


@router.post("/outbox/replay")
async def outbox_replay(limit: int = 50) -> dict[str, Any]:
    container = await get_container()
    replayed = await container.outbox_dispatcher.replay_dead_letter(limit=limit)
    return {"replayed": replayed}


@router.post("/workflows/recover")
async def recover_workflows(tenant_id: str = TENANT_A) -> dict[str, Any]:
    container = await get_container()
    recovered = await container.command_bus.dispatch(
        RecoverWorkflowsCommand(
            tenant_id=TenantId(tenant_id),
            correlation_id=CorrelationId(str(new_correlation_id())),
        )
    )
    return {"recovered": recovered, "count": len(recovered)}


@router.post("/alerts/evaluate")
async def evaluate_alerts() -> dict[str, Any]:
    container = await get_container()
    alerts = await container.alerting_service.evaluate()
    return {"alerts": alerts, "count": len(alerts)}
