"""Thread-safe boto3 client pool."""

from __future__ import annotations

import logging
import threading
from typing import Any

import boto3
from botocore.client import BaseClient
from botocore.config import Config

from backend.config.r2 import R2Config, R2ConfigError
from backend.storage.internal.errors import StorageConfigError
from backend.storage.internal.protocols import S3ClientFactory

logger = logging.getLogger(__name__)


def redact_for_logs(value: str | None) -> str:
    """Return a log-safe representation that never exposes secrets."""
    if not value:
        return "<empty>"
    if len(value) <= 4:
        return "****"
    return f"{value[:2]}****{value[-2:]}"


def build_botocore_config(config: R2Config) -> Config:
    """Build botocore retry and timeout configuration."""
    return Config(
        region_name=config.region,
        signature_version="s3v4",
        retries={
            "max_attempts": config.max_retry_attempts,
            "mode": "adaptive",
        },
        max_pool_connections=config.max_pool_connections,
        connect_timeout=config.connect_timeout,
        read_timeout=config.read_timeout,
        s3={"addressing_style": "path"},
        tcp_keepalive=True,
    )


class R2ClientPool(S3ClientFactory):
    """Thread-safe pooled S3 clients keyed by endpoint + credentials."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._clients: dict[str, BaseClient] = {}

    def get_client(self, config: R2Config) -> BaseClient:
        cache_key = f"{config.build_endpoint()}:{config.access_key_id}"
        with self._lock:
            client = self._clients.get(cache_key)
            if client is None:
                client = self._create_client(config)
                self._clients[cache_key] = client
            return client

    def clear(self) -> None:
        with self._lock:
            self._clients.clear()

    def _create_client(self, config: R2Config) -> BaseClient:
        endpoint = config.build_endpoint()
        logger.debug(
            "Creating R2 client endpoint=%s bucket=%s access_key=%s",
            endpoint,
            config.bucket,
            redact_for_logs(config.access_key_id),
        )
        return boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=config.access_key_id,
            aws_secret_access_key=config.secret_access_key,
            config=build_botocore_config(config),
        )


def create_r2_client(config: R2Config) -> BaseClient:
    """Create a fresh boto3 client (non-pooled)."""
    try:
        return R2ClientPool()._create_client(config)
    except R2ConfigError as exc:
        raise StorageConfigError(str(exc)) from exc
