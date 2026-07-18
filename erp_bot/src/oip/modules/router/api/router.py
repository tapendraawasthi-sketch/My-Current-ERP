"""Router HTTP API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ....infrastructure.di.container import get_container
from ....shared.ids import CorrelationId, PlanId, RouteId, TenantId, new_correlation_id
from ..application.commands import CreateRouteDecisionCommand
from ..application.queries import GetProviderHealthQuery, GetRouteDecisionQuery, GetRoutingMetricsQuery, SearchRoutesQuery
from ..domain.value_objects import RoutingPolicyName

router = APIRouter(prefix="/routes", tags=["router"])


class CreateRouteRequest(BaseModel):
    plan_id: str = Field(..., min_length=1)
    tenant_id: str = Field(default="default")
    routing_policy: RoutingPolicyName = RoutingPolicyName.BALANCED


@router.post("")
async def create_route(req: CreateRouteRequest) -> dict[str, Any]:
    container = await get_container()
    correlation_id = str(new_correlation_id())
    result = await container.command_bus.dispatch(
        CreateRouteDecisionCommand(
            tenant_id=TenantId(req.tenant_id),
            correlation_id=CorrelationId(correlation_id),
            plan_id=PlanId(req.plan_id),
            routing_policy=req.routing_policy,
        )
    )
    return {"route": result, "correlation_id": correlation_id}


@router.get("")
async def list_routes(
    tenant_id: str = "default",
    plan_id: str | None = None,
    request_id: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    container = await get_container()
    routes = await container.query_bus.dispatch(
        SearchRoutesQuery(
            tenant_id=TenantId(tenant_id),
            plan_id=PlanId(plan_id) if plan_id else None,
            request_id=None,
            limit=limit,
        )
    )
    return {"routes": routes}


@router.get("/metrics")
async def routing_metrics(tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    metrics = await container.query_bus.dispatch(
        GetRoutingMetricsQuery(tenant_id=TenantId(tenant_id))
    )
    return {"metrics": metrics}


@router.get("/{route_id}")
async def get_route(route_id: str, tenant_id: str = "default") -> dict[str, Any]:
    container = await get_container()
    route = await container.query_bus.dispatch(
        GetRouteDecisionQuery(tenant_id=TenantId(tenant_id), route_id=RouteId(route_id))
    )
    if route is None:
        raise HTTPException(status_code=404, detail="Route not found")
    return {"route": route}


providers_router = APIRouter(prefix="/providers", tags=["router"])


@providers_router.get("/health")
async def provider_health(tenant_id: str = "default", provider_id: str | None = None) -> dict[str, Any]:
    container = await get_container()
    return await container.query_bus.dispatch(
        GetProviderHealthQuery(tenant_id=TenantId(tenant_id), provider_id=provider_id)
    )
