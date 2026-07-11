"""Registry-based provider catalog — metadata only."""

from __future__ import annotations

from ...domain.provider_metadata import ProviderMetadata
from ...domain.value_objects import CapabilityKind


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, ProviderMetadata] = {}

    def register(self, provider: ProviderMetadata) -> None:
        if provider.provider_id in self._providers:
            raise ValueError(f"Provider already registered: {provider.provider_id}")
        self._providers[provider.provider_id] = provider

    def get(self, provider_id: str) -> ProviderMetadata | None:
        return self._providers.get(provider_id)

    def list_all(self) -> tuple[ProviderMetadata, ...]:
        return tuple(self._providers.values())

    def list_ids(self) -> tuple[str, ...]:
        return tuple(self._providers.keys())


def create_default_provider_registry() -> ProviderRegistry:
    registry = ProviderRegistry()
    base_caps = (
        CapabilityKind.CHAT,
        CapabilityKind.STREAMING,
        CapabilityKind.JSON,
        CapabilityKind.FUNCTION_CALLING,
    )
    cloud_editions = ("developer", "smb", "cloud", "enterprise", "government")
    cloud_modes = ("developer", "smb", "cloud_saas", "enterprise", "government", "hybrid")

    providers = [
        ProviderMetadata(
            provider_id="openai",
            display_name="OpenAI",
            capabilities=base_caps + (CapabilityKind.EMBEDDING, CapabilityKind.VISION, CapabilityKind.LARGE_CONTEXT),
            editions=cloud_editions,
            deployment_modes=cloud_modes,
            jurisdictions=("global", "us", "eu"),
            languages=("en", "ne", "hi"),
            context_window=128_000,
            default_latency_ms=1800,
            default_cost_micros_per_1k=150,
            quality_score=0.92,
            accounting_certified=True,
        ),
        ProviderMetadata(
            provider_id="anthropic",
            display_name="Anthropic",
            capabilities=base_caps + (CapabilityKind.VISION, CapabilityKind.LARGE_CONTEXT),
            editions=cloud_editions,
            deployment_modes=cloud_modes,
            jurisdictions=("global", "us", "eu"),
            languages=("en", "ne"),
            context_window=200_000,
            default_latency_ms=2200,
            default_cost_micros_per_1k=180,
            quality_score=0.94,
            accounting_certified=True,
        ),
        ProviderMetadata(
            provider_id="groq",
            display_name="Groq",
            capabilities=base_caps + (CapabilityKind.LARGE_CONTEXT,),
            editions=cloud_editions,
            deployment_modes=cloud_modes,
            jurisdictions=("global", "us"),
            languages=("en", "ne"),
            context_window=32_768,
            default_latency_ms=600,
            default_cost_micros_per_1k=30,
            quality_score=0.85,
        ),
        ProviderMetadata(
            provider_id="ollama",
            display_name="Ollama",
            capabilities=base_caps
            + (
                CapabilityKind.OFFLINE,
                CapabilityKind.LOCAL_MODELS,
                CapabilityKind.EMBEDDING,
            ),
            editions=("developer", "smb", "cloud", "enterprise", "government", "offline"),
            deployment_modes=("developer", "smb", "offline", "hybrid", "enterprise"),
            jurisdictions=("global", "np"),
            languages=("en", "ne", "hi"),
            supports_offline=True,
            supports_local_models=True,
            context_window=8192,
            default_latency_ms=3500,
            default_cost_micros_per_1k=0,
            quality_score=0.78,
        ),
        ProviderMetadata(
            provider_id="openrouter",
            display_name="OpenRouter",
            capabilities=base_caps + (CapabilityKind.LARGE_CONTEXT,),
            editions=cloud_editions,
            deployment_modes=cloud_modes,
            jurisdictions=("global",),
            languages=("en", "ne"),
            context_window=128_000,
            default_latency_ms=2500,
            default_cost_micros_per_1k=80,
            quality_score=0.82,
        ),
        ProviderMetadata(
            provider_id="azure_openai",
            display_name="Azure OpenAI",
            capabilities=base_caps + (CapabilityKind.EMBEDDING, CapabilityKind.VISION, CapabilityKind.LARGE_CONTEXT),
            editions=("enterprise", "government", "cloud"),
            deployment_modes=("enterprise", "government", "hybrid"),
            jurisdictions=("global", "eu", "us"),
            languages=("en", "ne"),
            context_window=128_000,
            default_latency_ms=2000,
            default_cost_micros_per_1k=160,
            quality_score=0.91,
            accounting_certified=True,
            government_certified=True,
        ),
        ProviderMetadata(
            provider_id="vertex_ai",
            display_name="Vertex AI",
            capabilities=base_caps + (CapabilityKind.VISION, CapabilityKind.OCR, CapabilityKind.SPEECH, CapabilityKind.LARGE_CONTEXT),
            editions=("enterprise", "government", "cloud"),
            deployment_modes=("enterprise", "government", "cloud_saas", "hybrid"),
            jurisdictions=("global", "eu", "us"),
            languages=("en", "ne", "hi"),
            context_window=1_000_000,
            default_latency_ms=2400,
            default_cost_micros_per_1k=120,
            quality_score=0.90,
            government_certified=True,
        ),
        ProviderMetadata(
            provider_id="custom",
            display_name="Custom Provider",
            capabilities=base_caps + (CapabilityKind.OFFLINE, CapabilityKind.LOCAL_MODELS),
            editions=("developer", "smb", "cloud", "enterprise", "government", "offline"),
            deployment_modes=("developer", "smb", "cloud_saas", "enterprise", "government", "offline", "hybrid"),
            jurisdictions=("global", "np"),
            languages=("en", "ne"),
            supports_offline=True,
            supports_local_models=True,
            context_window=8192,
            default_latency_ms=3000,
            default_cost_micros_per_1k=40,
            quality_score=0.75,
        ),
    ]
    for provider in providers:
        registry.register(provider)
    return registry
