"""Dependency-injection container for the storage layer."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from backend.config.r2 import R2Config, R2ConfigError, get_r2_config
from backend.storage.internal.cdn import ConfigCdnUrlResolver
from backend.storage.internal.circuit_breaker import CircuitBreaker, CircuitBreakerConfig
from backend.storage.internal.client_pool import R2ClientPool
from backend.storage.internal.errors import StorageConfigError
from backend.storage.internal.lifecycle import InMemoryLifecycleRuleRegistry
from backend.storage.internal.metadata_cache import TtlLruMetadataCache
from backend.storage.internal.metrics import InMemoryMetrics
from backend.storage.internal.protocols import (
    CdnUrlResolver,
    LifecycleRuleRegistry,
    MetadataCache,
    MetricsCollector,
    S3ClientFactory,
)
from backend.storage.internal.transfer import TransferManager

if TYPE_CHECKING:
    from backend.storage.internal.service import R2StorageService

_container_lock = threading.Lock()
_container_override: StorageContainer | None = None
_default_container: StorageContainer | None = None


@dataclass
class StorageContainer:
    """Wires all storage dependencies for testability and composition.

    Attributes:
        config: R2 configuration.
        client_pool: S3 client factory/pool.
        metrics: Operational metrics collector.
        metadata_cache: HeadObject TTL cache.
        transfer_manager: Multipart transfer config cache.
        cdn_resolver: Public URL resolver.
        lifecycle_registry: Lifecycle rule registry.
    """

    config: R2Config
    client_pool: S3ClientFactory = field(default_factory=R2ClientPool)
    metrics: MetricsCollector = field(default_factory=InMemoryMetrics)
    metadata_cache: MetadataCache = field(default_factory=TtlLruMetadataCache)
    transfer_manager: TransferManager = field(default_factory=TransferManager)
    cdn_resolver: CdnUrlResolver | None = None
    lifecycle_registry: LifecycleRuleRegistry = field(
        default_factory=InMemoryLifecycleRuleRegistry
    )
    circuit_breaker: CircuitBreaker | None = None
    _service: R2StorageService | None = field(default=None, init=False, repr=False)

    @property
    def service(self) -> R2StorageService:
        """Lazy ``R2StorageService`` bound to this container."""
        if self._service is None:
            from backend.storage.internal.service import R2StorageService

            self._service = R2StorageService(self)
        return self._service

    def reset(self) -> None:
        """Clear pooled clients, caches, and metrics."""
        self.client_pool.clear()
        self.metadata_cache.clear()
        self.transfer_manager.clear_cache()
        if isinstance(self.metrics, InMemoryMetrics):
            self.metrics.reset()
        if isinstance(self.lifecycle_registry, InMemoryLifecycleRuleRegistry):
            self.lifecycle_registry.clear()
        if self.circuit_breaker is not None:
            self.circuit_breaker.reset()
        self._service = None


def build_container(config: R2Config | None = None) -> StorageContainer:
    """Construct a container for the given config."""
    try:
        cfg = config or get_r2_config()
    except R2ConfigError as exc:
        raise StorageConfigError(str(exc)) from exc
    return StorageContainer(
        config=cfg,
        metadata_cache=TtlLruMetadataCache(
            max_entries=cfg.metadata_cache_max_entries,
            ttl_seconds=float(cfg.metadata_cache_ttl_seconds),
        ),
        cdn_resolver=ConfigCdnUrlResolver(cfg),
        circuit_breaker=CircuitBreaker(
            CircuitBreakerConfig(
                failure_threshold=cfg.circuit_breaker_failure_threshold,
                recovery_timeout_sec=cfg.circuit_breaker_recovery_timeout_sec,
                half_open_max_calls=cfg.circuit_breaker_half_open_max_calls,
            )
        ),
    )


def get_storage_container(config: R2Config | None = None) -> StorageContainer:
    """Return the active container (override or config-scoped singleton)."""
    global _container_override, _default_container
    if _container_override is not None:
        if config is not None and config != _container_override.config:
            return build_container(config)
        return _container_override

    if config is not None:
        return build_container(config)

    with _container_lock:
        if _default_container is None:
            _default_container = build_container()
        return _default_container


def get_storage_service(config: R2Config | None = None):
    """Return the storage service from the active container."""
    return get_storage_container(config).service


def override_storage_container(container: StorageContainer | None) -> None:
    """Replace the global container (for tests)."""
    global _container_override
    with _container_lock:
        _container_override = container


def reset_storage_container() -> None:
    """Clear override, default singleton, and all pooled resources."""
    global _container_override, _default_container
    with _container_lock:
        if _container_override is not None:
            _container_override.reset()
        if _default_container is not None:
            _default_container.reset()
        _container_override = None
        _default_container = None
