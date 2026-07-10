"""Cloudflare R2 configuration loaded from environment variables.

Never hardcode credentials. All secrets are read at runtime from the process
environment (or a local ``.env`` file during development).
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Mapping
from urllib.parse import urlparse

from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_PROJECT_ROOT = _BACKEND_ROOT.parent

# Load backend-local .env first, then project root .env (root wins for duplicates).
load_dotenv(dotenv_path=_BACKEND_ROOT / ".env", override=False)
load_dotenv(dotenv_path=_PROJECT_ROOT / ".env", override=False)


class R2ConfigError(ValueError):
    """Raised when required R2 configuration is missing or invalid."""


_BUCKET_NAME_RE = re.compile(r"^[a-z0-9]([a-z0-9.-]{0,61}[a-z0-9])?$")


def validate_bucket_name(name: str) -> None:
    """Validate an S3-compatible bucket name.

    Args:
        name: Bucket name to validate.

    Raises:
        R2ConfigError: When the name violates S3 naming rules.
    """
    if not name or len(name) < 3 or len(name) > 63:
        raise R2ConfigError(
            f"R2 bucket name must be 3–63 characters, got {len(name)}: {name!r}"
        )
    if ".." in name or name.startswith("-") or name.endswith("-"):
        raise R2ConfigError(f"Invalid R2 bucket name: {name!r}")
    if not _BUCKET_NAME_RE.match(name):
        raise R2ConfigError(
            f"R2 bucket name must be lowercase alphanumeric with dots/hyphens: {name!r}"
        )


def validate_r2_config(config: R2Config) -> None:
    """Validate a loaded ``R2Config`` and raise clear startup errors.

    Args:
        config: Configuration to validate.

    Raises:
        R2ConfigError: When any setting is invalid for production use.
    """
    validate_bucket_name(config.bucket)
    for extra in config.extra_buckets:
        validate_bucket_name(extra)

    parsed = urlparse(config.endpoint)
    if config.require_https and parsed.scheme != "https":
        raise R2ConfigError(
            f"R2_ENDPOINT must use HTTPS (set R2_ALLOW_INSECURE=true to override): "
            f"{config.endpoint!r}"
        )

    if config.circuit_breaker_failure_threshold < 1:
        raise R2ConfigError("R2_CIRCUIT_BREAKER_FAILURE_THRESHOLD must be >= 1")
    if config.circuit_breaker_recovery_timeout_sec <= 0:
        raise R2ConfigError("R2_CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SEC must be > 0")


@dataclass(frozen=True, slots=True)
class R2Config:
    """Immutable R2 connection settings.

    Designed for future multi-bucket support: callers may pass an explicit
    ``bucket`` to storage helpers; when omitted the default ``bucket`` here is
    used.

    Attributes:
        account_id: Cloudflare account identifier.
        bucket: Default object storage bucket name.
        access_key_id: R2 S3-compatible access key ID.
        secret_access_key: R2 S3-compatible secret access key.
        endpoint: Full S3 API endpoint URL for the account.
        public_base_url: Optional CDN or custom domain for public object URLs.
        region: S3 API region (R2 uses ``auto``).
        max_pool_connections: HTTP connection pool size for boto3.
        connect_timeout: Socket connect timeout in seconds.
        read_timeout: Socket read timeout in seconds.
        multipart_threshold_mb: File size above which multipart upload is used.
        multipart_chunk_size_mb: Part size for multipart transfers.
        max_retry_attempts: Maximum boto3 adaptive retry attempts.
        upload_max_concurrency: Parallel multipart upload/download threads.
        metadata_cache_ttl_seconds: TTL for HeadObject metadata cache.
        metadata_cache_max_entries: Max cached metadata entries.
        app_retry_max_attempts: Application-level retry attempts.
        delete_parallel_batches: Parallel delete batch workers for bulk ops.
        circuit_breaker_failure_threshold: Failures before circuit opens.
        circuit_breaker_recovery_timeout_sec: Seconds before half-open probe.
        circuit_breaker_half_open_max_calls: Successes needed to close circuit.
        require_https: Reject non-HTTPS endpoints unless explicitly allowed.
    """

    account_id: str
    bucket: str
    access_key_id: str
    secret_access_key: str
    endpoint: str
    public_base_url: str | None = None
    region: str = "auto"
    max_pool_connections: int = 50
    connect_timeout: int = 10
    read_timeout: int = 300
    multipart_threshold_mb: int = 8
    multipart_chunk_size_mb: int = 8
    max_retry_attempts: int = 5
    upload_max_concurrency: int = 10
    metadata_cache_ttl_seconds: int = 60
    metadata_cache_max_entries: int = 10_000
    app_retry_max_attempts: int = 3
    delete_parallel_batches: int = 4
    circuit_breaker_failure_threshold: int = 5
    circuit_breaker_recovery_timeout_sec: float = 30.0
    circuit_breaker_half_open_max_calls: int = 3
    require_https: bool = True
    extra_buckets: tuple[str, ...] = field(default_factory=tuple)

    @property
    def default_bucket(self) -> str:
        """Alias for the primary bucket (multi-bucket ready)."""
        return self.bucket

    def resolve_bucket(self, bucket: str | None) -> str:
        """Return the bucket to use, validating against known buckets when set.

        Args:
            bucket: Explicit bucket override, or ``None`` for the default.

        Returns:
            Resolved bucket name.

        Raises:
            R2ConfigError: If the bucket name is empty or not permitted.
        """
        resolved = (bucket or self.bucket).strip()
        if not resolved:
            raise R2ConfigError(
                "Bucket name is required. Set R2_BUCKET or pass bucket= explicitly."
            )
        if self.extra_buckets and resolved not in {self.bucket, *self.extra_buckets}:
            raise R2ConfigError(
                f"Bucket '{resolved}' is not registered. "
                f"Allowed: {self.bucket}, {', '.join(self.extra_buckets)}"
            )
        return resolved

    def build_endpoint(self) -> str:
        """Return the normalized S3 endpoint URL."""
        return self.endpoint.rstrip("/")

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> R2Config:
        """Build configuration from environment variables.

        Required:
            R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

        Optional:
            R2_ENDPOINT — auto-derived from account ID when omitted.
            R2_PUBLIC_BASE_URL — base URL for ``generate_public_url``.
            R2_EXTRA_BUCKETS — comma-separated list of additional bucket names.
            R2_REGION, R2_MAX_POOL_CONNECTIONS, R2_CONNECT_TIMEOUT,
            R2_READ_TIMEOUT, R2_MULTIPART_THRESHOLD_MB,
            R2_MULTIPART_CHUNK_SIZE_MB, R2_MAX_RETRY_ATTEMPTS,
            R2_UPLOAD_MAX_CONCURRENCY, R2_METADATA_CACHE_TTL_SECONDS,
            R2_METADATA_CACHE_MAX_ENTRIES, R2_APP_RETRY_MAX_ATTEMPTS,
            R2_DELETE_PARALLEL_BATCHES, R2_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
            R2_CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SEC,
            R2_CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS, R2_REQUIRE_HTTPS,
            R2_ALLOW_INSECURE

        Args:
            environ: Environment mapping; defaults to ``os.environ``.

        Returns:
            Validated ``R2Config`` instance.

        Raises:
            R2ConfigError: When required variables are missing or invalid.
        """
        env = environ if environ is not None else os.environ

        account_id = env.get("R2_ACCOUNT_ID", "").strip()
        bucket = env.get("R2_BUCKET", "").strip()
        access_key_id = env.get("R2_ACCESS_KEY_ID", "").strip()
        secret_access_key = env.get("R2_SECRET_ACCESS_KEY", "").strip()
        endpoint = env.get("R2_ENDPOINT", "").strip()

        missing = [
            name
            for name, value in (
                ("R2_ACCOUNT_ID", account_id),
                ("R2_BUCKET", bucket),
                ("R2_ACCESS_KEY_ID", access_key_id),
                ("R2_SECRET_ACCESS_KEY", secret_access_key),
            )
            if not value
        ]
        if missing:
            raise R2ConfigError(
                "Missing required R2 environment variables: "
                + ", ".join(missing)
                + ". Copy backend/.env.example to backend/.env and fill in values."
            )

        if not endpoint:
            endpoint = f"https://{account_id}.r2.cloudflarestorage.com"

        parsed = urlparse(endpoint)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise R2ConfigError(
                f"R2_ENDPOINT must be a valid HTTP(S) URL, got: {endpoint!r}"
            )

        extra_raw = env.get("R2_EXTRA_BUCKETS", "").strip()
        extra_buckets = tuple(
            b.strip() for b in extra_raw.split(",") if b.strip()
        ) if extra_raw else ()

        public_base = env.get("R2_PUBLIC_BASE_URL", "").strip() or None

        allow_insecure = env.get("R2_ALLOW_INSECURE", "").strip().lower() in {
            "1",
            "true",
            "yes",
        }
        require_https_raw = env.get("R2_REQUIRE_HTTPS", "true").strip().lower()
        require_https = require_https_raw not in {"0", "false", "no"} and not allow_insecure

        cfg = cls(
            account_id=account_id,
            bucket=bucket,
            access_key_id=access_key_id,
            secret_access_key=secret_access_key,
            endpoint=endpoint,
            public_base_url=public_base,
            region=env.get("R2_REGION", "auto").strip() or "auto",
            max_pool_connections=int(env.get("R2_MAX_POOL_CONNECTIONS", "50")),
            connect_timeout=int(env.get("R2_CONNECT_TIMEOUT", "10")),
            read_timeout=int(env.get("R2_READ_TIMEOUT", "300")),
            multipart_threshold_mb=int(env.get("R2_MULTIPART_THRESHOLD_MB", "8")),
            multipart_chunk_size_mb=int(
                env.get("R2_MULTIPART_CHUNK_SIZE_MB", "8")
            ),
            max_retry_attempts=int(env.get("R2_MAX_RETRY_ATTEMPTS", "5")),
            upload_max_concurrency=int(env.get("R2_UPLOAD_MAX_CONCURRENCY", "10")),
            metadata_cache_ttl_seconds=int(
                env.get("R2_METADATA_CACHE_TTL_SECONDS", "60")
            ),
            metadata_cache_max_entries=int(
                env.get("R2_METADATA_CACHE_MAX_ENTRIES", "10000")
            ),
            app_retry_max_attempts=int(env.get("R2_APP_RETRY_MAX_ATTEMPTS", "3")),
            delete_parallel_batches=int(env.get("R2_DELETE_PARALLEL_BATCHES", "4")),
            circuit_breaker_failure_threshold=int(
                env.get("R2_CIRCUIT_BREAKER_FAILURE_THRESHOLD", "5")
            ),
            circuit_breaker_recovery_timeout_sec=float(
                env.get("R2_CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SEC", "30")
            ),
            circuit_breaker_half_open_max_calls=int(
                env.get("R2_CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS", "3")
            ),
            require_https=require_https,
            extra_buckets=extra_buckets,
        )
        validate_r2_config(cfg)
        return cfg


@lru_cache(maxsize=1)
def load_r2_config() -> R2Config:
    """Load and cache R2 configuration (singleton per process).

    Returns:
        Cached ``R2Config`` instance.

    Raises:
        R2ConfigError: When configuration is invalid.
    """
    return R2Config.from_env()


def get_r2_config() -> R2Config:
    """Return the cached R2 configuration.

    Returns:
        ``R2Config`` singleton.
    """
    return load_r2_config()


def clear_r2_config_cache() -> None:
    """Clear the cached config (for tests only)."""
    load_r2_config.cache_clear()
