"""Unit tests for R2 client and connection verification."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from backend.config.r2 import R2Config
from backend.storage._common import StorageAuthError, StoragePermissionError
from backend.storage.internal.client_pool import create_r2_client
from backend.storage.internal.container import StorageContainer
from backend.storage.r2_client import verify_r2_connection


class TestR2Client:
    def test_create_r2_client_uses_endpoint(self, r2_config: R2Config) -> None:
        with patch("backend.storage.internal.client_pool.boto3.client") as mock_boto:
            mock_boto.return_value = MagicMock()
            create_r2_client(r2_config)
            _, kwargs = mock_boto.call_args
            assert kwargs["endpoint_url"] == r2_config.build_endpoint()
            assert kwargs["aws_access_key_id"] == r2_config.access_key_id

    def test_verify_connection_success(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        result = verify_r2_connection(r2_config)
        assert result["ok"] is True
        mock_s3_client.head_bucket.assert_called_once_with(Bucket="test-bucket")

    def test_verify_connection_invalid_credentials(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        error = ClientError(
            {"Error": {"Code": "InvalidAccessKeyId", "Message": "bad key"}},
            "HeadBucket",
        )
        mock_s3_client.head_bucket.side_effect = error
        with pytest.raises(StorageAuthError, match="invalid"):
            verify_r2_connection(r2_config)

    def test_verify_connection_access_denied(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        error = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "denied"}},
            "HeadBucket",
        )
        mock_s3_client.head_bucket.side_effect = error
        with pytest.raises(StoragePermissionError, match="access denied"):
            verify_r2_connection(r2_config)
