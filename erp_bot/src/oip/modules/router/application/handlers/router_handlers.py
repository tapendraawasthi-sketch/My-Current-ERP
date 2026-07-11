"""Router command and query handlers."""

from __future__ import annotations

from typing import Any

from ..commands import (
    ApproveRouteCommand,
    ArchiveRouteCommand,
    CreateRouteDecisionCommand,
    ExpireRouteCommand,
    RejectRouteCommand,
)
from ..projectors.routing_projectors import RouteDecisionProjector
from ..queries import (
    GetProviderHealthQuery,
    GetRouteDecisionQuery,
    GetRoutesQuery,
    GetRoutingMetricsQuery,
    SearchRoutesQuery,
)
from ..services.router_service import RouterService


class CreateRouteDecisionHandler:
    def __init__(self, router: RouterService) -> None:
        self._router = router

    async def __call__(self, command: CreateRouteDecisionCommand) -> dict[str, Any]:
        decision = await self._router.create_route_decision(
            plan_id=str(command.plan_id),
            tenant_id=str(command.tenant_id),
            routing_policy=command.routing_policy,
        )
        read_model = RouteDecisionProjector().project(decision)
        return read_model.model_dump(mode="json") if read_model else {}


class ApproveRouteHandler:
    def __init__(self, router: RouterService) -> None:
        self._router = router

    async def __call__(self, command: ApproveRouteCommand) -> dict[str, Any]:
        decision = await self._router.approve_route(tenant_id=str(command.tenant_id), route_id=str(command.route_id))
        read_model = RouteDecisionProjector().project(decision)
        return read_model.model_dump(mode="json") if read_model else {}


class RejectRouteHandler:
    def __init__(self, router: RouterService) -> None:
        self._router = router

    async def __call__(self, command: RejectRouteCommand) -> dict[str, Any]:
        decision = await self._router.reject_route(
            tenant_id=str(command.tenant_id),
            route_id=str(command.route_id),
            reason=command.reason,
        )
        read_model = RouteDecisionProjector().project(decision)
        return read_model.model_dump(mode="json") if read_model else {}


class ExpireRouteHandler:
    def __init__(self, router: RouterService) -> None:
        self._router = router

    async def __call__(self, command: ExpireRouteCommand) -> dict[str, Any]:
        decision = await self._router.expire_route(tenant_id=str(command.tenant_id), route_id=str(command.route_id))
        read_model = RouteDecisionProjector().project(decision)
        return read_model.model_dump(mode="json") if read_model else {}


class ArchiveRouteHandler:
    def __init__(self, router: RouterService) -> None:
        self._router = router

    async def __call__(self, command: ArchiveRouteCommand) -> dict[str, Any]:
        decision = await self._router.archive_route(tenant_id=str(command.tenant_id), route_id=str(command.route_id))
        read_model = RouteDecisionProjector().project(decision)
        return read_model.model_dump(mode="json") if read_model else {}


class GetRouteDecisionHandler:
    def __init__(self, router: RouterService) -> None:
        self._router = router

    async def __call__(self, query: GetRouteDecisionQuery) -> dict[str, Any] | None:
        read_model = await self._router.get_read_model(tenant_id=str(query.tenant_id), route_id=str(query.route_id))
        return read_model.model_dump(mode="json") if read_model else None


class GetRoutesHandler:
    def __init__(self, repository) -> None:
        self._repository = repository
        self._projector = RouteDecisionProjector()

    async def __call__(self, query: GetRoutesQuery) -> list[dict[str, Any]]:
        routes = await self._repository.search(
            tenant_id=str(query.tenant_id),
            plan_id=str(query.plan_id) if query.plan_id else None,
            request_id=str(query.request_id) if query.request_id else None,
            limit=query.limit,
        )
        return [self._projector.project(r).model_dump(mode="json") for r in routes if self._projector.project(r)]


class SearchRoutesHandler:
    def __init__(self, repository) -> None:
        self._repository = repository
        self._projector = RouteDecisionProjector()

    async def __call__(self, query: SearchRoutesQuery) -> list[dict[str, Any]]:
        routes = await self._repository.search(
            tenant_id=str(query.tenant_id),
            company_id=query.company_id,
            conversation_id=query.conversation_id,
            request_id=str(query.request_id) if query.request_id else None,
            plan_id=str(query.plan_id) if query.plan_id else None,
            provider_id=query.provider_id,
            status=query.status,
            limit=query.limit,
        )
        return [self._projector.project(r).model_dump(mode="json") for r in routes if self._projector.project(r)]


class GetProviderHealthHandler:
    def __init__(self, health_port, repository) -> None:
        self._health = health_port
        self._repository = repository

    async def __call__(self, query: GetProviderHealthQuery) -> dict[str, Any]:
        if query.provider_id:
            health = await self._health.get_health(provider_id=query.provider_id, tenant_id=str(query.tenant_id))
            return {"provider_id": query.provider_id, "health": health.model_dump(mode="json")}
        records = await self._repository.list_provider_health(tenant_id=str(query.tenant_id))
        return {"providers": [r.model_dump(mode="json") for r in records]}


class GetRoutingMetricsHandler:
    def __init__(self, repository) -> None:
        self._repository = repository

    async def __call__(self, query: GetRoutingMetricsQuery) -> dict[str, Any]:
        metrics = await self._repository.get_metrics(
            tenant_id=str(query.tenant_id),
            metric_date=query.metric_date,
        )
        return metrics.model_dump(mode="json")
