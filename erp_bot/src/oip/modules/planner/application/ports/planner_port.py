"""Planner inbound port."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..dto.planning_request import PlanningRequestDto
from ...domain.entities import ExecutionPlan


class PlannerPort(ABC):
    @abstractmethod
    async def create_plan(self, request: PlanningRequestDto) -> ExecutionPlan:
        """Transform intelligence request into immutable execution plan."""
