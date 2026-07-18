"""OIP configuration — environment-driven settings."""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic import BaseModel, Field

from ..shared.edition import DeploymentMode, OipEdition


class OipSettings(BaseModel):
    enabled: bool = Field(default_factory=lambda: os.getenv("OIP_ENABLED", "true").lower() == "true")
    facade_routes_legacy: bool = Field(
        default_factory=lambda: os.getenv("OIP_FACADE_LEGACY", "false").lower() == "true"
    )
    shadow_audit: bool = Field(
        default_factory=lambda: os.getenv("OIP_SHADOW_AUDIT", "true").lower() == "true"
    )
    shadow_lineage: bool = Field(
        default_factory=lambda: os.getenv("OIP_SHADOW_LINEAGE", "true").lower() == "true"
    )
    conversation_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_CONVERSATION_ENABLED", "true").lower() == "true"
    )
    shadow_conversation: bool = Field(
        default_factory=lambda: os.getenv("OIP_SHADOW_CONVERSATION", "true").lower() == "true"
    )
    session_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_SESSION_ENABLED", "true").lower() == "true"
    )
    shadow_session: bool = Field(
        default_factory=lambda: os.getenv("OIP_SHADOW_SESSION", "true").lower() == "true"
    )
    planner_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_PLANNER_ENABLED", "true").lower() == "true"
    )
    shadow_planner: bool = Field(
        default_factory=lambda: os.getenv("OIP_SHADOW_PLANNER", "true").lower() == "true"
    )
    router_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_ROUTER_ENABLED", "true").lower() == "true"
    )
    shadow_router: bool = Field(
        default_factory=lambda: os.getenv("OIP_SHADOW_ROUTER", "true").lower() == "true"
    )
    router_policy: str = Field(
        default_factory=lambda: os.getenv("OIP_ROUTER_POLICY", "balanced")
    )
    provider_runtime_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_PROVIDER_RUNTIME_ENABLED", "true").lower() == "true"
    )
    shadow_provider_runtime: bool = Field(
        default_factory=lambda: os.getenv("OIP_SHADOW_PROVIDER_RUNTIME", "true").lower() == "true"
    )
    streaming_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_STREAMING_ENABLED", "true").lower() == "true"
    )
    provider_policy: str = Field(
        default_factory=lambda: os.getenv("OIP_PROVIDER_POLICY", "balanced")
    )
    default_provider: str = Field(default_factory=lambda: os.getenv("OIP_PROVIDER", ""))
    default_model: str = Field(default_factory=lambda: os.getenv("OIP_DEFAULT_MODEL", ""))
    force_stub_providers: bool = Field(
        default_factory=lambda: os.getenv("OIP_FORCE_STUB_PROVIDERS", "true").lower() == "true"
    )
    provider_offline_mode: bool = Field(
        default_factory=lambda: os.getenv("OIP_PROVIDER_OFFLINE_MODE", "false").lower() == "true"
    )
    provider_timeout_seconds: float = Field(
        default_factory=lambda: float(os.getenv("OIP_PROVIDER_TIMEOUT_SECONDS", "60"))
    )
    openai_api_key: str = Field(default_factory=lambda: os.getenv("OIP_OPENAI_API_KEY", ""))
    anthropic_api_key: str = Field(default_factory=lambda: os.getenv("OIP_ANTHROPIC_API_KEY", ""))
    google_api_key: str = Field(default_factory=lambda: os.getenv("OIP_GOOGLE_API_KEY", ""))
    groq_api_key: str = Field(default_factory=lambda: os.getenv("OIP_GROQ_API_KEY", ""))
    ollama_base_url: str = Field(
        default_factory=lambda: os.getenv("OIP_OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    )
    quality_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_QUALITY_ENABLED", "true").lower() == "true"
    )
    shadow_quality: bool = Field(
        default_factory=lambda: os.getenv("OIP_SHADOW_QUALITY", "true").lower() == "true"
    )
    l3_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_L3_ENABLED", "true").lower() == "true"
    )
    minimum_gate: str = Field(
        default_factory=lambda: os.getenv("OIP_MINIMUM_GATE", "L2")
    )
    action_runtime_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_ACTION_RUNTIME_ENABLED", "true").lower() == "true"
    )
    shadow_action_runtime: bool = Field(
        default_factory=lambda: os.getenv("OIP_SHADOW_ACTION_RUNTIME", "true").lower() == "true"
    )
    require_approval: bool = Field(
        default_factory=lambda: os.getenv("OIP_REQUIRE_APPROVAL", "false").lower() == "true"
    )
    compensation_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_COMPENSATION_ENABLED", "true").lower() == "true"
    )
    stream_runtime_mode: str = Field(
        default_factory=lambda: os.getenv("OIP_STREAM_RUNTIME_MODE", "native").lower()
    )
    stream_protocol: str = Field(
        default_factory=lambda: os.getenv("OIP_STREAM_PROTOCOL", "sse")
    )
    stream_heartbeat: int = Field(
        default_factory=lambda: int(os.getenv("OIP_STREAM_HEARTBEAT", "30"))
    )
    stream_replay_buffer: int = Field(
        default_factory=lambda: int(os.getenv("OIP_STREAM_REPLAY_BUFFER", "1000"))
    )
    stream_transport: str = Field(
        default_factory=lambda: os.getenv("OIP_STREAM_TRANSPORT", "auto")
    )
    orchestrator_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_ORCHESTRATOR_ENABLED", "true").lower() == "true"
    )
    knowledge_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_KNOWLEDGE_ENABLED", "true").lower() == "true"
    )
    knowledge_retrieval_mode: str = Field(
        default_factory=lambda: os.getenv("OIP_KNOWLEDGE_RETRIEVAL_MODE", "hybrid")
    )
    hybrid_retrieval: bool = Field(
        default_factory=lambda: os.getenv("OIP_HYBRID_RETRIEVAL", "true").lower() == "true"
    )
    poison_detection: bool = Field(
        default_factory=lambda: os.getenv("OIP_POISON_DETECTION", "true").lower() == "true"
    )
    authority_enforcement: bool = Field(
        default_factory=lambda: os.getenv("OIP_AUTHORITY_ENFORCEMENT", "true").lower() == "true"
    )
    knowledge_embedding_version: str = Field(
        default_factory=lambda: os.getenv("OIP_KNOWLEDGE_EMBEDDING_VERSION", "hash-v1")
    )
    knowledge_embedding_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_KNOWLEDGE_EMBEDDING_ENABLED", "true").lower() == "true"
    )
    memory_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_MEMORY_ENABLED", "true").lower() == "true"
    )
    memory_recall_mode: str = Field(
        default_factory=lambda: os.getenv("OIP_MEMORY_RECALL_MODE", "Hybrid")
    )
    memory_cache_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_MEMORY_CACHE_ENABLED", "true").lower() == "true"
    )
    oec_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_OEC_ENABLED", "true").lower() == "true"
    )
    oec_circuit_threshold: int = Field(
        default_factory=lambda: int(os.getenv("OIP_OEC_CIRCUIT_THRESHOLD", "5"))
    )
    execution_mode: str = Field(
        default_factory=lambda: os.getenv("OIP_EXECUTION_MODE", "native")
    )
    max_retries: int = Field(
        default_factory=lambda: int(os.getenv("OIP_MAX_RETRIES", "3"))
    )
    retry_backoff: float = Field(
        default_factory=lambda: float(os.getenv("OIP_RETRY_BACKOFF", "1.0"))
    )
    database_url: str = Field(
        default_factory=lambda: os.getenv("OIP_DATABASE_URL", "sqlite+aiosqlite:///./data/oip/oip.db")
    )
    edition: OipEdition = OipEdition.CLOUD
    deployment_mode: DeploymentMode = DeploymentMode.CLOUD_SAAS
    snapshot_max_age_seconds: float = 300.0
    erp_contract_version: str = "1.0.0"
    auth_required: bool = Field(
        default_factory=lambda: os.getenv("OIP_AUTH_REQUIRED", "false").lower() == "true"
    )
    tenant_enforcement: bool = Field(
        default_factory=lambda: os.getenv("OIP_TENANT_ENFORCEMENT", "true").lower() == "true"
    )
    jwt_secret: str = Field(
        default_factory=lambda: os.getenv("OIP_JWT_SECRET", os.getenv("API_SECRET_KEY", os.getenv("JWT_SECRET", "")))
    )
    jwt_issuer: str = Field(default_factory=lambda: os.getenv("OIP_JWT_ISSUER", "sutra-oip"))
    jwt_audience: str = Field(default_factory=lambda: os.getenv("OIP_JWT_AUDIENCE", "sutra-oip"))
    jwt_access_ttl_minutes: int = Field(
        default_factory=lambda: int(os.getenv("OIP_JWT_ACCESS_TTL_MINUTES", "60"))
    )
    jwt_refresh_ttl_days: int = Field(
        default_factory=lambda: int(os.getenv("OIP_JWT_REFRESH_TTL_DAYS", "30"))
    )
    api_keys: str = Field(default_factory=lambda: os.getenv("OIP_API_KEYS", ""))
    default_service_tenant_id: str = Field(
        default_factory=lambda: os.getenv("OIP_DEFAULT_SERVICE_TENANT_ID", "")
    )
    default_service_company_id: str = Field(
        default_factory=lambda: os.getenv("OIP_DEFAULT_SERVICE_COMPANY_ID", "")
    )
    rate_limit_max_requests: int = Field(
        default_factory=lambda: int(os.getenv("OIP_RATE_LIMIT_MAX", "120"))
    )
    rate_limit_window_seconds: float = Field(
        default_factory=lambda: float(os.getenv("OIP_RATE_LIMIT_WINDOW_SECONDS", "60"))
    )
    cors_allowed_origins: tuple[str, ...] = Field(
        default_factory=lambda: tuple(
            item.strip()
            for item in os.getenv("OIP_CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8765").split(",")
            if item.strip()
        )
    )
    cors_allow_credentials: bool = Field(
        default_factory=lambda: os.getenv("OIP_CORS_ALLOW_CREDENTIALS", "true").lower() == "true"
    )
    csrf_protection: bool = Field(
        default_factory=lambda: os.getenv("OIP_CSRF_PROTECTION", "false").lower() == "true"
    )
    credential_encryption_key: str = Field(
        default_factory=lambda: os.getenv("OIP_CREDENTIAL_ENCRYPTION_KEY", "")
    )
    outbox_max_attempts: int = Field(
        default_factory=lambda: int(os.getenv("OIP_OUTBOX_MAX_ATTEMPTS", "5"))
    )
    outbox_poller_enabled: bool = Field(
        default_factory=lambda: os.getenv("OIP_OUTBOX_POLLER_ENABLED", "false").lower() == "true"
    )
    outbox_poller_interval_seconds: float = Field(
        default_factory=lambda: float(os.getenv("OIP_OUTBOX_POLLER_INTERVAL_SECONDS", "5"))
    )
    ops_alert_dlq_threshold: int = Field(
        default_factory=lambda: int(os.getenv("OIP_OPS_ALERT_DLQ_THRESHOLD", "10"))
    )
    ops_alert_queue_threshold: int = Field(
        default_factory=lambda: int(os.getenv("OIP_OPS_ALERT_QUEUE_THRESHOLD", "500"))
    )


@lru_cache(maxsize=1)
def get_oip_settings() -> OipSettings:
    edition_raw = os.getenv("OIP_EDITION", "cloud").lower()
    try:
        edition = OipEdition(edition_raw)
    except ValueError:
        edition = OipEdition.CLOUD
    mode_raw = os.getenv("OIP_DEPLOYMENT_MODE", "cloud_saas").lower()
    try:
        mode = DeploymentMode(mode_raw)
    except ValueError:
        mode = DeploymentMode.CLOUD_SAAS
    settings = OipSettings(edition=edition, deployment_mode=mode)
    # Fail closed for production insecurity (MAI-01). Secrets are never printed.
    from ..domain.constitution.config_guard import (
        ConfigValidationError,
        validate_production_security_config,
    )

    try:
        validate_production_security_config(
            auth_required=settings.auth_required,
            jwt_secret=settings.jwt_secret,
            default_tenant_id=settings.default_service_tenant_id,
            default_company_id=settings.default_service_company_id,
        )
    except ConfigValidationError as exc:
        # Clear cache would not help; raise so process cannot start insecurely.
        raise RuntimeError(str(exc)) from exc
    return settings


def clear_oip_settings_cache() -> None:
    get_oip_settings.cache_clear()


class FeatureFlags:
    """Runtime feature flags for strangler migration."""

    def __init__(self, settings: OipSettings | None = None) -> None:
        self._settings = settings or get_oip_settings()

    @property
    def oip_enabled(self) -> bool:
        return self._settings.enabled

    @property
    def use_kernel_facade(self) -> bool:
        return self._settings.enabled

    @property
    def legacy_delegation(self) -> bool:
        return self._settings.facade_routes_legacy

    @property
    def shadow_audit_writes(self) -> bool:
        return self._settings.shadow_audit

    @property
    def shadow_lineage_writes(self) -> bool:
        return self._settings.shadow_lineage

    @property
    def conversation_module_enabled(self) -> bool:
        return self._settings.conversation_enabled

    @property
    def shadow_conversation_writes(self) -> bool:
        return self._settings.shadow_conversation

    @property
    def session_module_enabled(self) -> bool:
        return self._settings.session_enabled

    @property
    def shadow_session_writes(self) -> bool:
        return self._settings.shadow_session

    @property
    def planner_module_enabled(self) -> bool:
        return self._settings.planner_enabled

    @property
    def shadow_planner_writes(self) -> bool:
        return self._settings.shadow_planner

    @property
    def router_module_enabled(self) -> bool:
        return self._settings.router_enabled

    @property
    def shadow_router_writes(self) -> bool:
        return self._settings.shadow_router

    @property
    def provider_runtime_module_enabled(self) -> bool:
        return self._settings.provider_runtime_enabled

    @property
    def shadow_provider_runtime_writes(self) -> bool:
        return self._settings.shadow_provider_runtime

    @property
    def streaming_enabled(self) -> bool:
        return self._settings.streaming_enabled

    @property
    def quality_gate_module_enabled(self) -> bool:
        return self._settings.quality_enabled

    @property
    def shadow_quality_writes(self) -> bool:
        return self._settings.shadow_quality

    @property
    def l3_quality_enabled(self) -> bool:
        return self._settings.l3_enabled

    @property
    def action_runtime_module_enabled(self) -> bool:
        return self._settings.action_runtime_enabled

    @property
    def shadow_action_runtime_writes(self) -> bool:
        return self._settings.shadow_action_runtime

    @property
    def streaming_runtime_module_enabled(self) -> bool:
        return self._settings.stream_runtime_mode != "disabled"

    @property
    def shadow_streaming_runtime_writes(self) -> bool:
        return self._settings.stream_runtime_mode == "shadow"

    @property
    def orchestrator_module_enabled(self) -> bool:
        return self._settings.orchestrator_enabled

    @property
    def knowledge_module_enabled(self) -> bool:
        return self._settings.knowledge_enabled

    @property
    def memory_module_enabled(self) -> bool:
        return self._settings.memory_enabled

    @property
    def oec_module_enabled(self) -> bool:
        return self._settings.oec_enabled

    @property
    def execution_mode(self) -> str:
        return self._settings.execution_mode
