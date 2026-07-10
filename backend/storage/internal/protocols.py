"""Dependency-injection protocols for the storage layer."""

from __future__ import annotations

from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any, BinaryIO, Protocol, runtime_checkable

from botocore.client import BaseClient

from backend.config.r2 import R2Config


@runtime_checkable
class S3ClientFactory(Protocol):
    """Creates or returns boto3 S3 clients."""

    def get_client(self, config: R2Config) -> BaseClient: ...

    def clear(self) -> None: ...


@runtime_checkable
class MetricsCollector(Protocol):
    """Records operational metrics (Prometheus-ready interface)."""

    def increment(self, name: str, *, tags: Mapping[str, str] | None = None) -> None: ...

    def timing(
        self, name: str, duration_ms: float, *, tags: Mapping[str, str] | None = None
    ) -> None: ...

    def snapshot(self) -> dict[str, Any]: ...


@runtime_checkable
class MetadataCache(Protocol):
    """TTL cache for HeadObject responses."""

    def get(self, bucket: str, key: str, version_id: str | None) -> dict | None: ...

    def set(
        self, bucket: str, key: str, version_id: str | None, metadata: dict
    ) -> None: ...

    def invalidate(self, bucket: str, key: str) -> None: ...

    def invalidate_prefix(self, bucket: str, prefix: str) -> None: ...

    def clear(self) -> None: ...


@runtime_checkable
class CdnUrlResolver(Protocol):
    """Resolves public/CDN URLs for objects."""

    def public_url(
        self,
        key: str,
        *,
        bucket: str,
        version_id: str | None = None,
    ) -> str: ...


@runtime_checkable
class LifecycleRuleRegistry(Protocol):
    """Registry for object lifecycle policies (future R2 lifecycle API)."""

    def rules_for_prefix(self, prefix: str) -> tuple["LifecycleRule", ...]: ...

    def register(self, rule: "LifecycleRule") -> None: ...


@dataclass(frozen=True, slots=True)
class LifecycleRule:
    """Declarative lifecycle rule (applied via future automation hooks)."""

    id: str
    prefix: str
    expire_after_days: int | None = None
    transition_to_cold_after_days: int | None = None
    enabled: bool = True


@dataclass(frozen=True, slots=True)
class ObjectMetadata:
    """Normalized object metadata."""

    content_length: int | None
    content_type: str | None
    etag: str | None
    last_modified: datetime | None
    user_metadata: dict[str, str]
    version_id: str | None

    def to_dict(self) -> dict:
        """Convert to the legacy public dict shape."""
        return {
            "content_length": self.content_length,
            "content_type": self.content_type,
            "etag": self.etag,
            "last_modified": self.last_modified,
            "metadata": self.user_metadata,
            "version_id": self.version_id,
        }


TransferConfigFactory = Callable[[R2Config], Any]
ExecutorFactory = Callable[[], Any]
