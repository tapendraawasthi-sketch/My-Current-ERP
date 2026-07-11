"""Intelligence ingress port — single entry for intelligence requests."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ...dto.intelligence_request import IntelligenceRequestDto
from ...dto.intelligence_response import IntelligenceResponseDto


class IntelligenceIngressPort(ABC):
    """Constitution: all intelligence enters through the kernel facade."""

    @abstractmethod
    async def submit(self, request: IntelligenceRequestDto) -> IntelligenceResponseDto:
        """Process an intelligence request and return structured response."""

    @abstractmethod
    async def health(self) -> dict[str, Any]:
        """Return kernel health (provider-agnostic)."""
