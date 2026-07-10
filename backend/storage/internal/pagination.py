"""High-scale list_objects_v2 pagination."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from backend.storage.internal.retry import retry_with_backoff


@retry_with_backoff(max_attempts=3)
def _list_page(client: Any, params: dict) -> dict:
    return client.list_objects_v2(**params)


def paginate_list_objects_v2(
    client: Any,
    *,
    bucket: str,
    prefix: str = "",
    delimiter: str | None = None,
    page_size: int = 1000,
    max_keys: int | None = None,
) -> Iterator[dict[str, Any]]:
    """Yield raw list_objects_v2 pages with continuation support."""
    continuation: str | None = None
    yielded = 0
    effective_page = min(max(page_size, 1), 1000)

    while True:
        params: dict[str, Any] = {
            "Bucket": bucket,
            "Prefix": prefix,
            "MaxKeys": effective_page,
        }
        if delimiter is not None:
            params["Delimiter"] = delimiter
        if continuation:
            params["ContinuationToken"] = continuation

        page = _list_page(client, params)
        yield page

        contents = page.get("Contents") or []
        yielded += len(contents)
        if max_keys is not None and yielded >= max_keys:
            break

        if not page.get("IsTruncated"):
            break
        continuation = page.get("NextContinuationToken")
        if not continuation:
            break
