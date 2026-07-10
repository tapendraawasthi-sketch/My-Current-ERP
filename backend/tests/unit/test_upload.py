"""Unit tests for upload operations."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from backend.config.r2 import R2Config
from backend.storage._common import StorageError
from backend.storage.upload import upload_bytes, upload_file, upload_fileobj


class TestUpload:
    def test_upload_bytes(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        key = upload_bytes(
            b"hello",
            "docs/hello.txt",
            content_type="text/plain",
            config=r2_config,
        )
        assert key == "docs/hello.txt"
        mock_s3_client.upload_fileobj.assert_called_once()

    def test_upload_file_streams_from_disk(
        self,
        r2_config: R2Config,
        mock_s3_client: MagicMock,
        tmp_path,
    ) -> None:
        file_path = tmp_path / "large.pdf"
        file_path.write_bytes(b"%PDF-1.4 fake content")

        key = upload_file(file_path, "invoices/large.pdf", config=r2_config)

        assert key == "invoices/large.pdf"
        mock_s3_client.upload_file.assert_called_once()
        call_kwargs = mock_s3_client.upload_file.call_args.kwargs
        assert call_kwargs["Filename"] == str(file_path)
        assert call_kwargs["Bucket"] == "test-bucket"

    def test_upload_file_not_found(self, r2_config: R2Config) -> None:
        with pytest.raises(FileNotFoundError):
            upload_file("/nonexistent/file.pdf", "x.pdf", config=r2_config)

    def test_upload_fileobj(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        key = upload_fileobj(BytesIO(b"stream"), "stream.bin", config=r2_config)
        assert key == "stream.bin"
        mock_s3_client.upload_fileobj.assert_called_once()

    def test_upload_rejects_invalid_key(self, r2_config: R2Config) -> None:
        with pytest.raises(StorageError, match="\\.\\."):
            upload_bytes(b"x", "../escape", config=r2_config)
