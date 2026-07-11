"""Edition capability filter adapter."""

from __future__ import annotations

from ...application.ports.routing_ports import EditionCapabilityPort
from ...domain.provider_metadata import ProviderMetadata


class DefaultEditionCapabilityAdapter(EditionCapabilityPort):
    def filter_providers(
        self,
        *,
        providers: tuple[ProviderMetadata, ...],
        edition: str,
        deployment_mode: str,
        offline_only: bool,
    ) -> tuple[ProviderMetadata, ...]:
        filtered: list[ProviderMetadata] = []
        for provider in providers:
            if edition not in provider.editions and edition != "cloud":
                if edition not in provider.editions:
                    continue
            if deployment_mode not in provider.deployment_modes:
                continue
            if offline_only and not (provider.supports_offline or provider.supports_local_models):
                continue
            filtered.append(provider)
        return tuple(filtered)
