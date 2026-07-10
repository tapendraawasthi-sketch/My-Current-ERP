"""Unit tests for download operations."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from backend.config.r2 import R2Config
from backend.storage.download import download_bytes, download_file, download_fileobj


class TestDownload:
    def test_download_bytes(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        def _fill_buffer(bucket, key, buffer, **kwargs):
            buffer.write(b"payload")

        mock_s3_client.download_fileobj.side_effect = _fill_buffer
        data = download_bytes("a/b.txt", config=r2_config)
        assert data == b"payload"

    def test_download_file(
        self,
        r2_config: R2Config,
        mock_s3_client: MagicMock,
        tmp_path: Path,
    ) -> None:
        dest = tmp_path / "out" / "file.bin"
        download_file("keys/file.bin", dest, config=r2_config)
        mock_s3_client.download_file.assert_called_once()
        assert dest.parent.exists()

    def test_download_fileobj(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        buf = BytesIO()
        download_fileobj("k", buf, config=r2_config)
        mock_s3_client.download_fileobj.assert_called_once()
