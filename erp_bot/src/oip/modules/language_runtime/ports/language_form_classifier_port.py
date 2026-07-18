"""Language form classifier port — provider-independent."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol, runtime_checkable

if TYPE_CHECKING:
    from ..infrastructure.compact_resource_repository import CompactResources


@runtime_checkable
class LanguageFormClassifierPort(Protocol):
    def classify_span(
        self,
        surface: str,
        *,
        context_forms: tuple[str, ...] = (),
        resources: CompactResources | None = None,
    ) -> Any:
        """Return LanguageFormDecision (application adapter)."""
        ...
