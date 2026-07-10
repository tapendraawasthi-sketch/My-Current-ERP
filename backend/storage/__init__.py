"""Cloudflare R2 object storage — public API.

Usage::

    from backend.storage import upload_file, download_bytes, file_exists

    upload_file("/tmp/invoice.pdf", "invoices/2026/inv-001.pdf")
    data = download_bytes("invoices/2026/inv-001.pdf")
"""

from __future__ import annotations

from backend.storage.delete import delete_file, delete_file_async, delete_files
from backend.storage.download import (
    download_bytes,
    download_bytes_async,
    download_file,
    download_file_async,
    download_fileobj,
)
from backend.storage.exists import file_exists, file_exists_async, get_object_metadata
from backend.storage.folders import (
    delete_folder,
    ensure_folder_placeholder,
    folder_key,
    iter_folder,
    list_folder,
)
from backend.storage.list_files import (
    ListObjectsResult,
    StoredObject,
    iter_objects,
    list_objects,
    list_objects_async,
)
from backend.storage.move import copy_file, move_file, move_file_async
from backend.storage.r2_client import (
    clear_client_cache,
    create_r2_client,
    get_r2_client,
    get_transfer_config,
    startup_verify_r2,
    verify_r2_connection,
)
from backend.storage.upload import (
    upload_bytes,
    upload_bytes_async,
    upload_file,
    upload_file_async,
    upload_fileobj,
)
from backend.storage.urls import generate_public_url

__all__ = [
    # Client / startup
    "clear_client_cache",
    "create_r2_client",
    "get_r2_client",
    "get_transfer_config",
    "startup_verify_r2",
    "verify_r2_connection",
    # Upload
    "upload_file",
    "upload_bytes",
    "upload_fileobj",
    "upload_file_async",
    "upload_bytes_async",
    # Download
    "download_file",
    "download_bytes",
    "download_fileobj",
    "download_file_async",
    "download_bytes_async",
    # Delete
    "delete_file",
    "delete_files",
    "delete_file_async",
    # List
    "list_objects",
    "iter_objects",
    "list_objects_async",
    "ListObjectsResult",
    "StoredObject",
    # Exists
    "file_exists",
    "file_exists_async",
    "get_object_metadata",
    # Move / copy
    "move_file",
    "copy_file",
    "move_file_async",
    # Folders
    "folder_key",
    "list_folder",
    "iter_folder",
    "delete_folder",
    "ensure_folder_placeholder",
    # URLs
    "generate_public_url",
]
