"""Shared pytest fixtures for backend storage tests."""

from __future__ import annotations

import os
from collections.abc import Generator
from unittest.mock import MagicMock

import pytest

from backend.config.r2 import R2Config, clear_r2_config_cache
from backend.storage.internal.circuit_breaker import CircuitBreaker, CircuitBreakerConfig
from backend.storage.internal.container import (
    StorageContainer,
    override_storage_container,
    reset_storage_container,
)


@pytest.fixture
def r2_env() -> dict[str, str]:
    """Minimal valid R2 environment for unit tests."""
    return {
        "R2_ACCOUNT_ID": "test-account-id",
        "R2_BUCKET": "test-bucket",
        "R2_ACCESS_KEY_ID": "TESTACCESSKEY",
        "R2_SECRET_ACCESS_KEY": "TESTSECRETKEY",
        "R2_ENDPOINT": "https://test-account-id.r2.cloudflarestorage.com",
        "R2_PUBLIC_BASE_URL": "https://cdn.example.com",
    }


@pytest.fixture
def r2_config(r2_env: dict[str, str]) -> R2Config:
    """Build an ``R2Config`` from test env values."""
    return R2Config.from_env(r2_env)


@pytest.fixture(autouse=True)
def reset_storage_singletons() -> Generator[None, None, None]:
    """Clear cached config, DI container, and clients between tests."""
    clear_r2_config_cache()
    reset_storage_container()
    override_storage_container(None)
    yield
    clear_r2_config_cache()
    reset_storage_container()
    override_storage_container(None)


@pytest.fixture
def mock_s3_client(r2_config: R2Config) -> Generator[MagicMock, None, None]:
    """Inject a mock S3 client via the storage DI container."""
    client = MagicMock(name="s3_client")
    pool = MagicMock(name="client_pool")
    pool.get_client.return_value = client

    container = StorageContainer(
        config=r2_config,
        client_pool=pool,
        circuit_breaker=CircuitBreaker(CircuitBreakerConfig()),
    )
    override_storage_container(container)
    yield client


def integration_env_ready() -> bool:
    """Return True when live R2 integration tests can run."""
    required = (
        "R2_ACCOUNT_ID",
        "R2_BUCKET",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
    )
    return all(os.getenv(k, "").strip() for k in required)


@pytest.fixture
def integration_prefix() -> str:
    """Unique key prefix for integration test objects."""
    import uuid

    return f"integration-tests/{uuid.uuid4().hex}/"
