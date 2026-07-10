"""Unit tests for delete, exists, list, move, folders, and URLs."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from backend.config.r2 import R2Config
from backend.storage._common import StorageConfigError, StorageNotFoundError
from backend.storage.delete import delete_file, delete_files
from backend.storage.exists import file_exists, get_object_metadata
from backend.storage.folders import folder_key, list_folder
from backend.storage.list_files import iter_objects, list_objects
from backend.storage.move import copy_file, move_file
from backend.storage.urls import generate_public_url


class TestDelete:
    def test_delete_file(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        delete_file("to-delete.txt", config=r2_config)
        mock_s3_client.delete_object.assert_called_once()

    def test_delete_files_batch(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        keys = [f"k{i}" for i in range(3)]
        batches = delete_files(keys, config=r2_config)
        assert batches == 1
        mock_s3_client.delete_objects.assert_called_once()


class TestExists:
    def test_file_exists_true(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        assert file_exists("present.txt", config=r2_config) is True

    def test_file_exists_false(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        mock_s3_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "not found"}},
            "HeadObject",
        )
        assert file_exists("missing.txt", config=r2_config) is False

    def test_get_object_metadata_not_found(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        mock_s3_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "x"}},
            "HeadObject",
        )
        with pytest.raises(StorageNotFoundError):
            get_object_metadata("nope", config=r2_config)


class TestList:
    def test_list_objects_page(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        mock_s3_client.list_objects_v2.return_value = {
            "Contents": [
                {
                    "Key": "a/1.txt",
                    "Size": 10,
                    "ETag": '"abc"',
                    "LastModified": datetime.now(timezone.utc),
                }
            ],
            "IsTruncated": False,
        }
        result = list_objects(prefix="a/", config=r2_config)
        assert len(result.objects) == 1
        assert result.objects[0].key == "a/1.txt"

    def test_iter_objects_multiple_pages(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        mock_s3_client.list_objects_v2.side_effect = [
            {
                "Contents": [{"Key": "k1", "Size": 1, "ETag": '"a"'}],
                "IsTruncated": True,
                "NextContinuationToken": "tok",
            },
            {
                "Contents": [{"Key": "k2", "Size": 2, "ETag": '"b"'}],
                "IsTruncated": False,
            },
        ]
        keys = [o.key for o in iter_objects(config=r2_config)]
        assert keys == ["k1", "k2"]


class TestMove:
    def test_move_file(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        dest = move_file("src.txt", "dst.txt", config=r2_config)
        assert dest == "dst.txt"
        mock_s3_client.copy_object.assert_called_once()
        mock_s3_client.delete_object.assert_called_once()

    def test_copy_file(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        dest = copy_file("a.txt", "b.txt", config=r2_config)
        assert dest == "b.txt"
        mock_s3_client.copy_object.assert_called_once()


class TestFolders:
    def test_folder_key(self) -> None:
        assert folder_key("invoices/2026", "inv.pdf") == "invoices/2026/inv.pdf"

    def test_list_folder_uses_delimiter(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        mock_s3_client.list_objects_v2.return_value = {
            "Contents": [],
            "CommonPrefixes": [{"Prefix": "docs/"}],
            "IsTruncated": False,
        }
        result = list_folder("docs", config=r2_config, recursive=False)
        assert result.prefixes == ("docs/",)


class TestUrls:
    def test_generate_public_url(self, r2_config: R2Config) -> None:
        url = generate_public_url("files/report.pdf", config=r2_config)
        assert url == "https://cdn.example.com/files/report.pdf"

    def test_generate_public_url_missing_base(self, r2_env: dict[str, str]) -> None:
        r2_env.pop("R2_PUBLIC_BASE_URL", None)
        cfg = R2Config.from_env(r2_env)
        with pytest.raises(StorageConfigError, match="R2_PUBLIC_BASE_URL"):
            generate_public_url("x", config=cfg)
