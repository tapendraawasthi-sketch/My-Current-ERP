"""Capability registry port."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class CapabilityRegistryPort(ABC):
    @abstractmethod
    def analyze(
        self,
        *,
        intent: str,
        module: str,
        message: str,
    ) -> dict[str, Any]:
        """Return capability analysis for planning."""
