"""Strongly-typed identifiers for OIP (UUIDv7-style via uuid4 until native v7 helper)."""

from __future__ import annotations

import uuid
from typing import NewType

TenantId = NewType("TenantId", str)
SessionId = NewType("SessionId", str)
ConversationId = NewType("ConversationId", str)
PlanId = NewType("PlanId", str)
RouteId = NewType("RouteId", str)
ExecutionId = NewType("ExecutionId", str)
EvaluationId = NewType("EvaluationId", str)
RequestId = NewType("RequestId", str)
ActionId = NewType("ActionId", str)
EventId = NewType("EventId", str)
CorrelationId = NewType("CorrelationId", str)
SagaId = NewType("SagaId", str)
CompanyId = NewType("CompanyId", str)
UserId = NewType("UserId", str)


def _new_id() -> str:
    return str(uuid.uuid4())


def new_request_id() -> RequestId:
    return RequestId(_new_id())


def new_action_id() -> ActionId:
    return ActionId(_new_id())


def new_event_id() -> EventId:
    return EventId(_new_id())


def new_correlation_id() -> CorrelationId:
    return CorrelationId(_new_id())


def new_conversation_id() -> ConversationId:
    return ConversationId(_new_id())


def new_plan_id() -> PlanId:
    return PlanId(_new_id())


def new_route_id() -> RouteId:
    return RouteId(_new_id())


def new_execution_id() -> ExecutionId:
    return ExecutionId(_new_id())


def new_evaluation_id() -> EvaluationId:
    return EvaluationId(_new_id())


def new_saga_id() -> SagaId:
    return SagaId(_new_id())
