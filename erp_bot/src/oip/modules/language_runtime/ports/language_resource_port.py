"""Language resource loading port."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol, runtime_checkable

if TYPE_CHECKING:
    from ..infrastructure.compact_resource_repository import CompactResources


@runtime_checkable
class LanguageResourcePort(Protocol):
    def load(self, *, force_reload: bool = False) -> CompactResources | Any:
        ...
