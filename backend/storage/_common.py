"""Shared utilities for the R2 storage layer (public re-exports)."""

from __future__ import annotations

from backend.config.r2 import R2Config, R2ConfigError, get_r2_config
from backend.storage.internal.concurrency import run_sync_in_executor
from backend.storage.internal.errors import (
    StorageAuthError,
    StorageCircuitOpenError,
    StorageConfigError,
    StorageConflictError,
    StorageConnectionError,
    StorageError,
    StorageNotFoundError,
    StoragePermissionError,
)
from backend.storage.internal.keys import normalize_key, normalize_prefix
from backend.storage.internal.pagination import paginate_list_objects_v2
from backend.storage.internal.retry import (
    map_boto_error,
    map_client_error,
    with_storage_error_handling,
)

__all__ = [
    "R2Config",
    "R2ConfigError",
    "StorageAuthError",
    "StorageCircuitOpenError",
    "StorageConfigError",
    "StorageConflictError",
    "StorageConnectionError",
    "StorageError",
    "StorageNotFoundError",
    "StoragePermissionError",
    "get_r2_config",
    "map_boto_error",
    "map_client_error",
    "normalize_key",
    "normalize_prefix",
    "paginate_list_objects_v2",
    "resolve_config_and_bucket",
    "run_sync_in_executor",
    "with_storage_error_handling",
]


def resolve_config_and_bucket(
    bucket: str | None,
    config: R2Config | None = None,
) -> tuple[R2Config, str]:
    """Resolve configuration and bucket name."""
    try:
        cfg = config or get_r2_config()
        resolved = cfg.resolve_bucket(bucket)
        return cfg, resolved
    except R2ConfigError as exc:
        raise StorageConfigError(str(exc)) from exc
