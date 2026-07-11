"""Planner commands."""

from __future__ import annotations

from pydantic import Field

from ....application.commands import Command
from ....shared.ids import PlanId, RequestId
from ..domain.value_objects import PlanningPolicyName


class CreateExecutionPlanCommand(Command):
    command_type: str = "oip.command.planner.create_plan.v1"
    request_id: RequestId
    session_id: str
    user_id: str
    company_id: str | None = None
    branch_id: str | None = None
    conversation_id: str | None = None
    module: str
    language: str | None = None
    message: str
    policy_name: PlanningPolicyName = PlanningPolicyName.BALANCED


class ValidateExecutionPlanCommand(Command):
    command_type: str = "oip.command.planner.validate_plan.v1"
    plan_id: PlanId


class CancelExecutionPlanCommand(Command):
    command_type: str = "oip.command.planner.cancel_plan.v1"
    plan_id: PlanId
    reason: str = ""


class ExpireExecutionPlanCommand(Command):
    command_type: str = "oip.command.planner.expire_plan.v1"
    plan_id: PlanId


class ArchiveExecutionPlanCommand(Command):
    command_type: str = "oip.command.planner.archive_plan.v1"
    plan_id: PlanId
