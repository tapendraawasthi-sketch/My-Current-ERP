"""Session repository port."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ...domain.entities import IntelligenceSession


class SessionRepositoryPort(ABC):
    @abstractmethod
    async def get_by_id(self, *, tenant_id: str, session_id: str) -> IntelligenceSession | None:
        """Load session by id."""

    @abstractmethod
    async def save(self, session: IntelligenceSession) -> None:
        """Insert or update session."""
