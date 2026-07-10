"""Integration tests against live Cloudflare R2.

Skipped automatically when R2 credentials are not present in the environment.
Set variables from backend/.env.example before running:

    pytest backend/tests/integration -m integration
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from backend.config.r2 import R2Config, clear_r2_config_cache
from backend.storage import (
    delete_file,
    download_bytes,
    file_exists,
    list_objects,
    move_file,
    upload_bytes,
    upload_file,
    verify_r2_connection,
)
from backend.tests.conftest import integration_env_ready

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def live_config() -> R2Config:
    """Load live R2 config from environment."""
    if not integration_env_ready():
        pytest.skip("R2 credentials not configured for integration tests")
    clear_r2_config_cache()
    return R2Config.from_env(os.environ)


@pytest.fixture(scope="module", autouse=True)
def verify_live_connection(live_config: R2Config) -> None:
    """Fail fast if credentials are invalid."""
    verify_r2_connection(live_config)


class TestR2Integration:
    def test_upload_download_roundtrip(
        self, live_config: R2Config, integration_prefix: str, tmp_path: Path
    ) -> None:
        key = f"{integration_prefix}roundtrip.txt"
        payload = b"integration-test-payload"

        try:
            upload_bytes(payload, key, config=live_config)
            assert file_exists(key, config=live_config)
            assert download_bytes(key, config=live_config) == payload
        finally:
            if file_exists(key, config=live_config):
                delete_file(key, config=live_config)

    def test_upload_file_streaming(
        self, live_config: R2Config, integration_prefix: str, tmp_path: Path
    ) -> None:
        key = f"{integration_prefix}streamed.bin"
        local = tmp_path / "streamed.bin"
        local.write_bytes(b"x" * (1024 * 1024))  # 1 MiB

        try:
            upload_file(local, key, config=live_config)
            assert file_exists(key, config=live_config)
        finally:
            if file_exists(key, config=live_config):
                delete_file(key, config=live_config)

    def test_move_and_list(
        self, live_config: R2Config, integration_prefix: str
    ) -> None:
        src = f"{integration_prefix}move-src.txt"
        dst = f"{integration_prefix}move-dst.txt"

        try:
            upload_bytes(b"move-me", src, config=live_config)
            move_file(src, dst, config=live_config)
            assert not file_exists(src, config=live_config)
            assert file_exists(dst, config=live_config)

            page = list_objects(prefix=integration_prefix, config=live_config)
            keys = {o.key for o in page.objects}
            assert dst in keys
        finally:
            for k in (src, dst):
                if file_exists(k, config=live_config):
                    delete_file(k, config=live_config)
