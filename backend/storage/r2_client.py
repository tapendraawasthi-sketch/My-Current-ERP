"""Boto3 S3 client factory and connection verification for Cloudflare R2."""

from __future__ import annotations

from typing import Any

from botocore.client import BaseClient

from backend.config.r2 import R2Config
from backend.storage.internal.client_pool import create_r2_client as _create_r2_client
from backend.storage.internal.container import (
    get_storage_container,
    reset_storage_container,
)
from backend.storage.internal.transfer import TransferManager

_transfer_manager = TransferManager()


def create_r2_client(config: R2Config | None = None) -> BaseClient:
    """Create a new boto3 S3 client pointed at Cloudflare R2."""
    container = get_storage_container(config)
    if config is not None:
        return _create_r2_client(config)
    return container.client_pool.get_client(container.config)


def get_r2_client(config: R2Config | None = None) -> BaseClient:
    """Return a cached boto3 client (one per endpoint + access key)."""
    container = get_storage_container(config)
    cfg = config or container.config
    return container.client_pool.get_client(cfg)


def clear_client_cache() -> None:
    """Clear cached clients (for tests)."""
    reset_storage_container()


def get_transfer_config(config: R2Config | None = None) -> Any:
    """Return multipart transfer settings for large streamed uploads."""
    container = get_storage_container(config)
    cfg = config or container.config
    return _transfer_manager.get_config(cfg)


def verify_r2_connection(
    config: R2Config | None = None,
    *,
    bucket: str | None = None,
) -> dict[str, str | bool]:
    """Verify R2 credentials and bucket access at startup."""
    container = get_storage_container(config)
    return container.service.verify_connection(config, bucket=bucket)


def startup_verify_r2() -> None:
    """Run configuration validation and connection verification at startup."""
    from backend.config.r2 import get_r2_config, validate_r2_config

    cfg = get_r2_config()
    validate_r2_config(cfg)
    verify_r2_connection(cfg)
