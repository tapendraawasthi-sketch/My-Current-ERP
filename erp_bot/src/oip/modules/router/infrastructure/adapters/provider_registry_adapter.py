"""Provider registry port adapter."""

from __future__ import annotations

from ...application.ports.routing_ports import ProviderRegistryPort
from ...domain.provider_metadata import ProviderMetadata
from .provider_registry import ProviderRegistry


class ProviderRegistryAdapter(ProviderRegistryPort):
    def __init__(self, registry: ProviderRegistry) -> None:
        self._registry = registry

    def list_providers(self) -> tuple[ProviderMetadata, ...]:
        return self._registry.list_all()

    def get_provider(self, provider_id: str) -> ProviderMetadata | None:
        return self._registry.get(provider_id)
