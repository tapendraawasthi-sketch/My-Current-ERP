"""Unit tests for storage enhancements: circuit breaker, multipart, streaming."""

from __future__ import annotations

import time
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import BotoCoreError, ClientError

from backend.config.r2 import R2Config
from backend.storage._common import (
    StorageAuthError,
    StorageCircuitOpenError,
    StorageConnectionError,
    StorageNotFoundError,
    StoragePermissionError,
    map_boto_error,
)
from backend.storage.internal.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitState,
)
from backend.storage.internal.client_pool import build_botocore_config
from backend.storage.internal.container import StorageContainer
from backend.storage.internal.lifecycle_paths import is_temp_key, permanent_key, temp_key
from backend.storage.internal.retry import is_retryable
from backend.storage.internal.transfer import TransferManager
from backend.storage.r2_client import verify_r2_connection
from backend.storage.upload import upload_file


class TestCircuitBreaker:
    def test_opens_after_threshold(self) -> None:
        breaker = CircuitBreaker(CircuitBreakerConfig(failure_threshold=3))
        for _ in range(3):
            breaker.before_call()
            breaker.record_failure()
        assert breaker.state == CircuitState.OPEN
        with pytest.raises(StorageCircuitOpenError):
            breaker.before_call()

    def test_half_open_then_closes_on_success(self) -> None:
        breaker = CircuitBreaker(
            CircuitBreakerConfig(
                failure_threshold=1,
                recovery_timeout_sec=0.01,
                half_open_max_calls=2,
            )
        )
        breaker.before_call()
        breaker.record_failure()
        assert breaker.state == CircuitState.OPEN
        time.sleep(0.02)
        assert breaker.state == CircuitState.HALF_OPEN
        breaker.before_call()
        breaker.record_success()
        breaker.before_call()
        breaker.record_success()
        assert breaker.state == CircuitState.CLOSED

    def test_blocks_service_calls_when_open(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        container = StorageContainer(
            config=r2_config,
            client_pool=MagicMock(get_client=MagicMock(return_value=mock_s3_client)),
            circuit_breaker=CircuitBreaker(CircuitBreakerConfig(failure_threshold=1)),
        )
        mock_s3_client.upload_fileobj.side_effect = BotoCoreError()
        with pytest.raises(Exception):
            container.service.upload_fileobj(BytesIO(b"x"), "k", config=r2_config)
        with pytest.raises(StorageCircuitOpenError):
            container.service.upload_fileobj(BytesIO(b"x"), "k2", config=r2_config)


class TestMultipartAndStreaming:
    def test_upload_file_uses_transfer_config(
        self,
        r2_config: R2Config,
        mock_s3_client: MagicMock,
        tmp_path: Path,
    ) -> None:
        path = tmp_path / "big.bin"
        path.write_bytes(b"x" * (9 * 1024 * 1024))
        upload_file(path, "large/big.bin", config=r2_config)
        call_kwargs = mock_s3_client.upload_file.call_args.kwargs
        assert call_kwargs["Config"] is not None
        assert TransferManager.multipart_threshold_bytes(r2_config) == 8 * 1024 * 1024

    def test_download_streams_via_transfer_manager(
        self, r2_config: R2Config, mock_s3_client: MagicMock, tmp_path: Path
    ) -> None:
        from backend.storage.download import download_file

        dest = tmp_path / "out.bin"
        download_file("keys/obj.bin", dest, config=r2_config)
        call_kwargs = mock_s3_client.download_file.call_args.kwargs
        assert call_kwargs["Config"] is not None
        mock_s3_client.get_object.assert_not_called()

    def test_upload_fileobj_does_not_buffer_entire_payload(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        from backend.storage.upload import upload_fileobj

        stream = BytesIO(b"chunked-data")
        upload_fileobj(stream, "stream.bin", config=r2_config)
        mock_s3_client.upload_fileobj.assert_called_once()
        assert mock_s3_client.put_object.call_count == 0


class TestErrorMapping:
    def test_invalid_credentials(self) -> None:
        exc = ClientError(
            {"Error": {"Code": "InvalidAccessKeyId", "Message": "bad"}},
            "HeadBucket",
        )
        mapped = map_boto_error(exc)
        assert isinstance(mapped, StorageAuthError)

    def test_access_denied_is_permission_error(self) -> None:
        exc = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "denied"}},
            "HeadBucket",
        )
        mapped = map_boto_error(exc)
        assert isinstance(mapped, StoragePermissionError)

    def test_bucket_not_found(self) -> None:
        exc = ClientError(
            {"Error": {"Code": "NoSuchBucket", "Message": "missing"}},
            "HeadBucket",
        )
        mapped = map_boto_error(exc)
        assert isinstance(mapped, StorageNotFoundError)

    def test_network_failure(self) -> None:
        mapped = map_boto_error(BotoCoreError())
        assert isinstance(mapped, StorageConnectionError)

    def test_circuit_open_not_retryable(self) -> None:
        assert is_retryable(StorageCircuitOpenError("open")) is False


class TestHealthDiagnostics:
    def test_diagnose_invalid_credentials(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        mock_s3_client.head_bucket.side_effect = ClientError(
            {"Error": {"Code": "InvalidAccessKeyId", "Message": "bad"}},
            "HeadBucket",
        )
        from backend.storage.internal.container import get_storage_container

        with patch(
            "backend.storage.internal.container.get_storage_container"
        ) as mock_get:
            container = StorageContainer(
                config=r2_config,
                client_pool=MagicMock(
                    get_client=MagicMock(return_value=mock_s3_client)
                ),
                circuit_breaker=CircuitBreaker(CircuitBreakerConfig()),
            )
            mock_get.return_value = container
            with pytest.raises(StorageAuthError, match="invalid"):
                verify_r2_connection(r2_config)

    def test_diagnose_bucket_not_found(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        mock_s3_client.head_bucket.side_effect = ClientError(
            {"Error": {"Code": "NoSuchBucket", "Message": "missing"}},
            "HeadBucket",
        )
        container = StorageContainer(
            config=r2_config,
            client_pool=MagicMock(get_client=MagicMock(return_value=mock_s3_client)),
            circuit_breaker=CircuitBreaker(CircuitBreakerConfig()),
        )
        diagnosis = container.service.diagnose_health(r2_config)
        assert diagnosis["checks"]["bucket"] == "not_found"
        assert diagnosis["status"] == "unhealthy"


class TestLifecyclePaths:
    def test_temp_and_permanent_prefixes(self) -> None:
        assert temp_key("uploads/doc.pdf").startswith("_tmp/")
        assert is_temp_key("_tmp/uploads/doc.pdf") is True
        assert is_temp_key("uploads/doc.pdf") is False
        assert permanent_key("_tmp/uploads/doc.pdf") == "uploads/doc.pdf"


class TestConnectionPooling:
    def test_botocore_config_has_pool_and_keepalive(self, r2_config: R2Config) -> None:
        cfg = build_botocore_config(r2_config)
        assert cfg.max_pool_connections == r2_config.max_pool_connections
        assert cfg.connect_timeout == r2_config.connect_timeout
        assert cfg.read_timeout == r2_config.read_timeout
        assert cfg.tcp_keepalive is True

    @patch("backend.storage.internal.retry.time.sleep")
    def test_retry_on_transient_error(
        self, mock_sleep, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        from backend.storage.exists import file_exists

        mock_s3_client.head_object.side_effect = [
            ClientError(
                {"Error": {"Code": "SlowDown", "Message": "slow"}},
                "HeadObject",
            ),
            {},
        ]
        assert file_exists("present.txt", config=r2_config) is True
        assert mock_s3_client.head_object.call_count == 2
