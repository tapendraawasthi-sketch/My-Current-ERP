"""Provider adapter registry — production adapters with registry lookups only."""

from __future__ import annotations

import httpx
from dataclasses import replace

from ...application.ports.execution_ports import ProviderAdapterPort, ProviderAdapterRegistryPort
from .base_provider_adapter import BaseProviderAdapter
from .providers.anthropic_adapter import AnthropicProviderAdapter
from .providers.gemini_adapter import GeminiProviderAdapter
from .providers.groq_adapter import GroqProviderAdapter
from .providers.http_base import ProviderRuntimeConfig
from .providers.model_catalog import create_default_model_catalog
from .providers.ollama_adapter import OllamaProviderAdapter
from .providers.openai_adapter import OpenAIProviderAdapter


def _default_model_for(runtime_config: ProviderRuntimeConfig, provider_id: str, fallback: str) -> str:
    if runtime_config.default_model and runtime_config.default_provider == provider_id:
        return runtime_config.default_model
    return fallback


def create_default_provider_adapters(
    config: ProviderRuntimeConfig | None = None,
    *,
    http_client: httpx.AsyncClient | None = None,
) -> dict[str, ProviderAdapterPort]:
    runtime_config = config or ProviderRuntimeConfig.from_env()
    catalog = create_default_model_catalog()
    shared_kwargs = {"config": runtime_config, "model_catalog": catalog, "http_client": http_client}
    model_for = lambda provider_id, fallback: _default_model_for(runtime_config, provider_id, fallback)

    production: dict[str, ProviderAdapterPort] = {
        "openai": OpenAIProviderAdapter(
            provider_id="openai", default_model=model_for("openai", "gpt-4o-mini"), region="us-east-1", **shared_kwargs
        ),
        "anthropic": AnthropicProviderAdapter(
            provider_id="anthropic", default_model="claude-3-5-haiku-20241022", region="us-east-1", **shared_kwargs
        ),
        "google": GeminiProviderAdapter(
            provider_id="google", default_model="gemini-1.5-flash", region="us-central1", **shared_kwargs
        ),
        "vertex_ai": GeminiProviderAdapter(
            provider_id="vertex_ai", default_model="gemini-1.5-pro", region="us-central1", **shared_kwargs
        ),
        "groq": GroqProviderAdapter(
            provider_id="groq",
            default_model=model_for("groq", "llama-3.3-70b-versatile"),
            region="us-west-1",
            **shared_kwargs,
        ),
        "ollama": OllamaProviderAdapter(
            provider_id="ollama", default_model="llama3.2", region="local", **shared_kwargs
        ),
        "openrouter": OpenAIProviderAdapter(
            provider_id="openrouter",
            default_model="auto",
            region="global",
            config=replace(runtime_config, openai_base_url="https://openrouter.ai/api/v1"),
            model_catalog=catalog,
            http_client=http_client,
        ),
        "azure_openai": OpenAIProviderAdapter(
            provider_id="azure_openai", default_model="gpt-4o", region="eastus", **shared_kwargs
        ),
        "custom": OpenAIProviderAdapter(
            provider_id="custom", default_model="custom-model", region="custom", **shared_kwargs
        ),
        "local": OllamaProviderAdapter(
            provider_id="local", default_model="llama3.2", region="local", **shared_kwargs
        ),
        "offline": BaseProviderAdapter(provider_id="offline", default_model="offline-model", region="local"),
        "mock": BaseProviderAdapter(provider_id="mock", default_model="mock-model", region="test"),
    }
    return production


class ProviderAdapterRegistry(ProviderAdapterRegistryPort):
    def __init__(
        self,
        adapters: dict[str, ProviderAdapterPort] | None = None,
        *,
        config: ProviderRuntimeConfig | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._adapters = adapters or create_default_provider_adapters(config, http_client=http_client)

    def get_adapter(self, provider_id: str) -> ProviderAdapterPort | None:
        return self._adapters.get(provider_id)

    def list_provider_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._adapters.keys()))

    def register(self, provider_id: str, adapter: ProviderAdapterPort) -> None:
        self._adapters[provider_id] = adapter
