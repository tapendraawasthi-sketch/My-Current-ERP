"""Unit tests for R2 configuration."""

from __future__ import annotations

import pytest

from backend.config.r2 import R2Config, R2ConfigError, clear_r2_config_cache


class TestR2Config:
    def test_from_env_success(self, r2_env: dict[str, str]) -> None:
        cfg = R2Config.from_env(r2_env)
        assert cfg.account_id == "test-account-id"
        assert cfg.bucket == "test-bucket"
        assert cfg.endpoint.endswith("r2.cloudflarestorage.com")

    def test_missing_required_raises(self) -> None:
        with pytest.raises(R2ConfigError, match="R2_ACCOUNT_ID"):
            R2Config.from_env({})

    def test_auto_endpoint(self) -> None:
        cfg = R2Config.from_env(
            {
                "R2_ACCOUNT_ID": "abc123",
                "R2_BUCKET": "test-bucket",
                "R2_ACCESS_KEY_ID": "k",
                "R2_SECRET_ACCESS_KEY": "s",
            }
        )
        assert cfg.endpoint == "https://abc123.r2.cloudflarestorage.com"

    def test_invalid_bucket_name_raises(self, r2_env: dict[str, str]) -> None:
        r2_env["R2_BUCKET"] = "X"
        with pytest.raises(R2ConfigError, match="bucket name"):
            R2Config.from_env(r2_env)

    def test_resolve_bucket_default(self, r2_config: R2Config) -> None:
        assert r2_config.resolve_bucket(None) == "test-bucket"

    def test_resolve_bucket_extra(self, r2_env: dict[str, str]) -> None:
        r2_env["R2_EXTRA_BUCKETS"] = "archive,backup"
        cfg = R2Config.from_env(r2_env)
        assert cfg.resolve_bucket("archive") == "archive"

    def test_resolve_bucket_unknown_raises(self, r2_config: R2Config) -> None:
        r2_env = {
            "R2_ACCOUNT_ID": r2_config.account_id,
            "R2_BUCKET": r2_config.bucket,
            "R2_ACCESS_KEY_ID": r2_config.access_key_id,
            "R2_SECRET_ACCESS_KEY": r2_config.secret_access_key,
            "R2_ENDPOINT": r2_config.endpoint,
            "R2_EXTRA_BUCKETS": "allowed-only",
        }
        cfg = R2Config.from_env(r2_env)
        with pytest.raises(R2ConfigError, match="not registered"):
            cfg.resolve_bucket("forbidden-bucket")

    def test_invalid_endpoint_raises(self, r2_env: dict[str, str]) -> None:
        r2_env["R2_ENDPOINT"] = "not-a-url"
        with pytest.raises(R2ConfigError, match="R2_ENDPOINT"):
            R2Config.from_env(r2_env)

    def test_cache_clear(self, r2_env: dict[str, str], monkeypatch) -> None:
        for k, v in r2_env.items():
            monkeypatch.setenv(k, v)
        clear_r2_config_cache()
        from backend.config.r2 import load_r2_config

        cfg = load_r2_config()
        assert cfg.bucket == "test-bucket"
