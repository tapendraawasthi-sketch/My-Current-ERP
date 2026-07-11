"""Router commands."""

from __future__ import annotations

from ....application.commands import Command
from ....shared.ids import PlanId, RouteId
from ..domain.value_objects import RoutingPolicyName


class CreateRouteDecisionCommand(Command):
    command_type: str = "oip.command.router.create_route.v1"
    plan_id: PlanId
    routing_policy: RoutingPolicyName = RoutingPolicyName.BALANCED


class ApproveRouteCommand(Command):
    command_type: str = "oip.command.router.approve_route.v1"
    route_id: RouteId


class RejectRouteCommand(Command):
    command_type: str = "oip.command.router.reject_route.v1"
    route_id: RouteId
    reason: str = ""


class ExpireRouteCommand(Command):
    command_type: str = "oip.command.router.expire_route.v1"
    route_id: RouteId


class ArchiveRouteCommand(Command):
    command_type: str = "oip.command.router.archive_route.v1"
    route_id: RouteId
