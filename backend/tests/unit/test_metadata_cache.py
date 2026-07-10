"""Unit tests for metadata cache behaviour."""

from __future__ import annotations

from unittest.mock import MagicMock

from backend.config.r2 import R2Config
from backend.storage.internal.container import StorageContainer, override_storage_container
from backend.storage.exists import file_exists, get_object_metadata


class TestMetadataCache:
    def test_head_object_cached(self, r2_config: R2Config) -> None:
        client = MagicMock()
        client.head_object.return_value = {
            "ContentLength": 42,
            "ContentType": "text/plain",
            "ETag": '"abc"',
            "Metadata": {"source": "test"},
        }
        pool = MagicMock()
        pool.get_client.return_value = client
        container = StorageContainer(config=r2_config, client_pool=pool)
        override_storage_container(container)

        get_object_metadata("docs/a.txt", config=r2_config)
        get_object_metadata("docs/a.txt", config=r2_config)

        client.head_object.assert_called_once()

    def test_file_exists_uses_metadata_path(
        self, r2_config: R2Config, mock_s3_client: MagicMock
    ) -> None:
        mock_s3_client.head_object.return_value = {
            "ContentLength": 1,
            "ETag": '"x"',
        }
        assert file_exists("present.txt", config=r2_config) is True
