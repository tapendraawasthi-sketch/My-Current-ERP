"""Provider metadata — no SDK imports."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from .value_objects import CapabilityKind


class ProviderMetadata(BaseModel):
    model_config = ConfigDict(frozen=True)

    provider_id: str
    display_name: str
    capabilities: tuple[CapabilityKind, ...] = Field(default_factory=tuple)
    editions: tuple[str, ...] = Field(default_factory=tuple)
    deployment_modes: tuple[str, ...] = Field(default_factory=tuple)
    jurisdictions: tuple[str, ...] = Field(default_factory=tuple)
    languages: tuple[str, ...] = Field(default_factory=tuple)
    supports_offline: bool = False
    supports_local_models: bool = False
    context_window: int = 8192
    default_latency_ms: int = 2000
    default_cost_micros_per_1k: int = 50
    quality_score: float = 0.8
    accounting_certified: bool = False
    government_certified: bool = False
