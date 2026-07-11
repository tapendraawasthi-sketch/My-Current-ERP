"""Production provider adapters — HTTP-backed, no SDK leakage."""

from .anthropic_adapter import AnthropicProviderAdapter
from .errors import ProviderAuthError, ProviderError, ProviderModelError, ProviderRateLimitError, ProviderTimeoutError
from .gemini_adapter import GeminiProviderAdapter
from .groq_adapter import GroqProviderAdapter
from .http_base import HttpProviderAdapter, ProviderRuntimeConfig
from .model_catalog import ModelCatalog, ModelMetadata
from .ollama_adapter import OllamaProviderAdapter
from .openai_adapter import OpenAIProviderAdapter

__all__ = [
    "AnthropicProviderAdapter",
    "GeminiProviderAdapter",
    "GroqProviderAdapter",
    "HttpProviderAdapter",
    "ModelCatalog",
    "ModelMetadata",
    "OllamaProviderAdapter",
    "OpenAIProviderAdapter",
    "ProviderAuthError",
    "ProviderError",
    "ProviderModelError",
    "ProviderRateLimitError",
    "ProviderRuntimeConfig",
    "ProviderTimeoutError",
]
