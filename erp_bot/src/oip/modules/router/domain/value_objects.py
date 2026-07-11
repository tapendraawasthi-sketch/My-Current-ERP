"""Router domain value objects."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RouteStatus(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    ARCHIVED = "archived"


class RoutingPolicyName(str, Enum):
    FAST = "fast"
    BALANCED = "balanced"
    QUALITY = "quality"
    OFFLINE = "offline"
    ACCOUNTING = "accounting"
    GOVERNMENT = "government"
    LOW_COST = "low_cost"
    HYBRID = "hybrid"


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CapabilityKind(str, Enum):
    CHAT = "chat"
    EMBEDDING = "embedding"
    VISION = "vision"
    OCR = "ocr"
    SPEECH = "speech"
    JSON = "json"
    FUNCTION_CALLING = "function_calling"
    STREAMING = "streaming"
    LARGE_CONTEXT = "large_context"
    OFFLINE = "offline"
    LOCAL_MODELS = "local_models"


class RouteReason(str, Enum):
    BEST_SCORE = "best_score"
    POLICY_MATCH = "policy_match"
    EDITION_ALLOWED = "edition_allowed"
    HEALTHY = "healthy"
    LOWEST_COST = "lowest_cost"
    LOWEST_LATENCY = "lowest_latency"
    HIGHEST_QUALITY = "highest_quality"
    OFFLINE_REQUIRED = "offline_required"
    FALLBACK = "fallback"
    ACCOUNTING_POLICY = "accounting_policy"


class RoutingScore(BaseModel):
    model_config = ConfigDict(frozen=True)

    total: float = 0.0
    capability: float = 0.0
    latency: float = 0.0
    cost: float = 0.0
    quality: float = 0.0
    health: float = 0.0


class CapabilityMatch(BaseModel):
    model_config = ConfigDict(frozen=True)

    required: tuple[str, ...] = Field(default_factory=tuple)
    matched: tuple[str, ...] = Field(default_factory=tuple)
    missing: tuple[str, ...] = Field(default_factory=tuple)
    score: float = 0.0


class LatencyEstimate(BaseModel):
    model_config = ConfigDict(frozen=True)

    estimated_ms: int = 0
    p95_ms: int = 0


class CostEstimate(BaseModel):
    model_config = ConfigDict(frozen=True)

    estimated_micros: int = 0
    currency: str = "USD"


class QualityEstimate(BaseModel):
    model_config = ConfigDict(frozen=True)

    score: float = 0.0
    confidence: float = 0.0


class HealthScore(BaseModel):
    model_config = ConfigDict(frozen=True)

    availability: float = 1.0
    circuit_state: CircuitState = CircuitState.CLOSED
    rolling_latency_ms: float = 0.0
    rolling_failure_rate: float = 0.0
    score: float = 1.0


class RoutingPolicy(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: RoutingPolicyName
    prefer_latency: float = 0.33
    prefer_cost: float = 0.33
    prefer_quality: float = 0.34
    require_health: bool = True
    min_quality: float = 0.5
    offline_only: bool = False


class ProviderSelection(BaseModel):
    model_config = ConfigDict(frozen=True)

    provider_id: str
    model_hint: str | None = None
    capabilities: tuple[str, ...] = Field(default_factory=tuple)
    score: RoutingScore = Field(default_factory=RoutingScore)


class ToolSelection(BaseModel):
    model_config = ConfigDict(frozen=True)

    tool_id: str
    category: str
    required: bool = True
    routed_to: str = "runtime"


class FallbackChain(BaseModel):
    model_config = ConfigDict(frozen=True)

    providers: tuple[str, ...] = Field(default_factory=tuple)
    max_retries: int = 2
    retry_policy: str = "exponential_backoff"
