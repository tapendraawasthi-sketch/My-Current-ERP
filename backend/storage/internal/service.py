"""Core R2 storage service — all operation logic lives here."""

from __future__ import annotations

import mimetypes
from collections.abc import Iterator, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING, BinaryIO

from botocore.exceptions import ClientError

from backend.config.r2 import R2Config, R2ConfigError
from backend.storage.internal.errors import (
    StorageAuthError,
    StorageConfigError,
    StorageConnectionError,
    StorageNotFoundError,
    StoragePermissionError,
)
from backend.storage.internal.circuit_breaker import with_circuit_breaker
from backend.storage.internal.keys import normalize_key, normalize_prefix
from backend.storage.internal.metadata import (
    build_upload_extra_args,
    parse_head_object_response,
)
from backend.storage.internal.metrics import record_operation
from backend.storage.internal.pagination import paginate_list_objects_v2
from backend.storage.internal.retry import map_boto_error, retry_with_backoff
from backend.storage.internal.structured_logging import OperationTimer, log_storage_event
from backend.storage.list_files import ListObjectsResult, StoredObject

if TYPE_CHECKING:
    from backend.storage.internal.container import StorageContainer

_DELETE_BATCH_SIZE = 1000


class R2StorageService:
    """Enterprise storage service with DI, metrics, caching, and retries."""

    def __init__(self, container: StorageContainer) -> None:
        self._c = container

    def _resolve(
        self, bucket: str | None, config: R2Config | None
    ) -> tuple[R2Config, str]:
        try:
            cfg = config or self._c.config
            return cfg, cfg.resolve_bucket(bucket)
        except R2ConfigError as exc:
            raise StorageConfigError(str(exc)) from exc

    def _client(self, config: R2Config):
        return self._c.client_pool.get_client(config)

    def _transfer(self, config: R2Config):
        return self._c.transfer_manager.get_config(config)

    # ── Connection ──────────────────────────────────────────────────────────

    def verify_connection(
        self,
        config: R2Config | None = None,
        *,
        bucket: str | None = None,
    ) -> dict[str, str | bool]:
        """Verify R2 credentials and bucket access (backward-compatible API)."""
        diagnosis = self.diagnose_health(config=config, bucket=bucket)
        if diagnosis["status"] != "healthy":
            check = diagnosis["checks"]
            if check.get("credentials") == "invalid":
                raise StorageAuthError(diagnosis["message"])
            if check.get("permissions") == "denied":
                raise StoragePermissionError(diagnosis["message"])
            if check.get("bucket") == "not_found":
                raise StorageNotFoundError(diagnosis["message"])
            raise StorageConnectionError(diagnosis["message"])
        cfg, resolved_bucket = self._resolve(bucket, config)
        return {
            "ok": True,
            "bucket": resolved_bucket,
            "endpoint": cfg.build_endpoint(),
            "message": diagnosis["message"],
        }

    def diagnose_health(
        self,
        config: R2Config | None = None,
        *,
        bucket: str | None = None,
    ) -> dict:
        """Run comprehensive R2 health checks for startup and monitoring.

        Returns:
            Dict with ``status``, ``checks``, ``message``, and ``circuit_breaker``.
        """
        cfg, resolved_bucket = self._resolve(bucket, config)
        client = self._client(cfg)
        checks: dict[str, str] = {
            "configuration": "ok",
            "credentials": "unknown",
            "bucket": "unknown",
            "connectivity": "unknown",
            "permissions": "unknown",
        }
        message = "R2 connection verified"
        status = "healthy"

        with OperationTimer(
            "diagnose_health", bucket=resolved_bucket, key=None
        ):
            try:
                if self._c.circuit_breaker is not None:
                    self._c.circuit_breaker.before_call()
                client.head_bucket(Bucket=resolved_bucket)
                if self._c.circuit_breaker:
                    self._c.circuit_breaker.record_success()
                checks["credentials"] = "ok"
                checks["bucket"] = "ok"
                checks["connectivity"] = "ok"
                checks["permissions"] = "ok"
            except ClientError as exc:
                if self._c.circuit_breaker:
                    self._c.circuit_breaker.record_failure()
                code = exc.response.get("Error", {}).get("Code", "")
                err_msg = exc.response.get("Error", {}).get("Message", str(exc))
                checks["connectivity"] = "ok"
                if code in {"InvalidAccessKeyId", "SignatureDoesNotMatch"}:
                    checks["credentials"] = "invalid"
                    status = "unhealthy"
                    message = (
                        "R2 credentials are invalid. Check R2_ACCESS_KEY_ID and "
                        "R2_SECRET_ACCESS_KEY."
                    )
                elif code in {"NoSuchBucket"}:
                    checks["bucket"] = "not_found"
                    checks["credentials"] = "ok"
                    status = "unhealthy"
                    message = f"R2 bucket not found: {resolved_bucket}"
                elif code in {"AccessDenied", "403"}:
                    checks["permissions"] = "denied"
                    checks["credentials"] = "ok"
                    status = "unhealthy"
                    message = (
                        f"R2 access denied for bucket '{resolved_bucket}'. "
                        "Verify API token permissions."
                    )
                else:
                    status = "unhealthy"
                    message = f"R2 health check failed [{code}]: {err_msg}"
            except Exception as exc:
                if self._c.circuit_breaker:
                    self._c.circuit_breaker.record_failure()
                checks["connectivity"] = "failed"
                status = "unhealthy"
                message = f"R2 connectivity error: {exc}"

        result = {
            "status": status,
            "checks": checks,
            "message": message,
        }
        if self._c.circuit_breaker is not None:
            result["circuit_breaker"] = self._c.circuit_breaker.snapshot()
        return result

    def health_snapshot(self) -> dict:
        """Extended health payload for internal monitoring (not public API)."""
        diagnosis = self.diagnose_health()
        return {
            "status": diagnosis["status"],
            "checks": diagnosis["checks"],
            "metrics": self._c.metrics.snapshot(),
            "circuit_breaker": diagnosis.get("circuit_breaker"),
            "config": {
                "upload_max_concurrency": self._c.config.upload_max_concurrency,
                "multipart_threshold_mb": self._c.config.multipart_threshold_mb,
            },
        }

    # ── Upload ──────────────────────────────────────────────────────────────

    @with_circuit_breaker
    @retry_with_backoff()
    def upload_file(
        self,
        local_path: str | Path,
        key: str,
        *,
        bucket: str | None = None,
        content_type: str | None = None,
        metadata: Mapping[str, str] | None = None,
        config: R2Config | None = None,
        version_id: str | None = None,
    ) -> str:
        path = Path(local_path)
        if not path.is_file():
            raise FileNotFoundError(f"Local file not found: {path}")

        cfg, resolved_bucket = self._resolve(bucket, config)
        normalized_key = normalize_key(key)
        client = self._client(cfg)
        guessed = content_type or mimetypes.guess_type(path.name)[0]
        extra = build_upload_extra_args(
            content_type=guessed, metadata=metadata, version_id=version_id
        )
        tags = {
            "operation": "upload_file",
            "bucket": resolved_bucket,
        }

        with record_operation(self._c.metrics, "upload_file", tags=tags):
            with OperationTimer(
                "upload_file",
                bucket=resolved_bucket,
                key=normalized_key,
            ):
                client.upload_file(
                Filename=str(path),
                Bucket=resolved_bucket,
                Key=normalized_key,
                ExtraArgs=extra or None,
                Config=self._transfer(cfg),
            )
        self._c.metadata_cache.invalidate(resolved_bucket, normalized_key)
        self._c.metadata_cache.invalidate_prefix(
            resolved_bucket, normalized_key.rsplit("/", 1)[0] + "/"
            if "/" in normalized_key
            else ""
        )
        return normalized_key

    @with_circuit_breaker
    @retry_with_backoff()
    def upload_bytes(
        self,
        data: bytes,
        key: str,
        *,
        bucket: str | None = None,
        content_type: str | None = "application/octet-stream",
        metadata: Mapping[str, str] | None = None,
        config: R2Config | None = None,
        version_id: str | None = None,
    ) -> str:
        return self.upload_fileobj(
            BytesIO(data),
            key,
            bucket=bucket,
            content_type=content_type,
            metadata=metadata,
            config=config,
            version_id=version_id,
        )

    @with_circuit_breaker
    @retry_with_backoff()
    def upload_fileobj(
        self,
        fileobj: BinaryIO,
        key: str,
        *,
        bucket: str | None = None,
        content_type: str | None = "application/octet-stream",
        metadata: Mapping[str, str] | None = None,
        config: R2Config | None = None,
        version_id: str | None = None,
    ) -> str:
        cfg, resolved_bucket = self._resolve(bucket, config)
        normalized_key = normalize_key(key)
        client = self._client(cfg)
        extra = build_upload_extra_args(
            content_type=content_type, metadata=metadata, version_id=version_id
        )
        tags = {"operation": "upload_fileobj", "bucket": resolved_bucket}

        with record_operation(self._c.metrics, "upload_fileobj", tags=tags):
            with OperationTimer(
                "upload_fileobj",
                bucket=resolved_bucket,
                key=normalized_key,
            ):
                client.upload_fileobj(
                fileobj,
                resolved_bucket,
                normalized_key,
                ExtraArgs=extra or None,
                Config=self._transfer(cfg),
            )
        self._c.metadata_cache.invalidate(resolved_bucket, normalized_key)
        return normalized_key

    # ── Download ────────────────────────────────────────────────────────────

    @with_circuit_breaker
    @retry_with_backoff()
    def download_file(
        self,
        key: str,
        local_path: str | Path,
        *,
        bucket: str | None = None,
        config: R2Config | None = None,
        version_id: str | None = None,
    ) -> Path:
        cfg, resolved_bucket = self._resolve(bucket, config)
        normalized_key = normalize_key(key)
        destination = Path(local_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        client = self._client(cfg)
        extra = {"VersionId": version_id} if version_id else None
        tags = {"operation": "download_file", "bucket": resolved_bucket}

        with record_operation(self._c.metrics, "download_file", tags=tags):
            with OperationTimer(
                "download_file",
                bucket=resolved_bucket,
                key=normalized_key,
            ):
                client.download_file(
                resolved_bucket,
                normalized_key,
                str(destination),
                ExtraArgs=extra,
                Config=self._transfer(cfg),
            )
        return destination

    @with_circuit_breaker
    @retry_with_backoff()
    def download_bytes(
        self,
        key: str,
        *,
        bucket: str | None = None,
        config: R2Config | None = None,
        version_id: str | None = None,
    ) -> bytes:
        buffer = BytesIO()
        self.download_fileobj(
            key, buffer, bucket=bucket, config=config, version_id=version_id
        )
        return buffer.getvalue()

    @with_circuit_breaker
    @retry_with_backoff()
    def download_fileobj(
        self,
        key: str,
        fileobj: BinaryIO,
        *,
        bucket: str | None = None,
        config: R2Config | None = None,
        version_id: str | None = None,
    ) -> None:
        cfg, resolved_bucket = self._resolve(bucket, config)
        normalized_key = normalize_key(key)
        client = self._client(cfg)
        extra = {"VersionId": version_id} if version_id else None
        tags = {"operation": "download_fileobj", "bucket": resolved_bucket}

        with record_operation(self._c.metrics, "download_fileobj", tags=tags):
            with OperationTimer(
                "download_fileobj",
                bucket=resolved_bucket,
                key=normalized_key,
            ):
                client.download_fileobj(
                resolved_bucket,
                normalized_key,
                fileobj,
                ExtraArgs=extra,
                Config=self._transfer(cfg),
            )

    # ── Delete ──────────────────────────────────────────────────────────────

    @with_circuit_breaker
    @retry_with_backoff()
    def delete_file(
        self,
        key: str,
        *,
        bucket: str | None = None,
        config: R2Config | None = None,
        version_id: str | None = None,
    ) -> None:
        cfg, resolved_bucket = self._resolve(bucket, config)
        normalized_key = normalize_key(key)
        client = self._client(cfg)
        params: dict = {"Bucket": resolved_bucket, "Key": normalized_key}
        if version_id:
            params["VersionId"] = version_id
        tags = {"operation": "delete_file", "bucket": resolved_bucket}

        with record_operation(self._c.metrics, "delete_file", tags=tags):
            client.delete_object(**params)
        self._c.metadata_cache.invalidate(resolved_bucket, normalized_key)

    def delete_files(
        self,
        keys: Sequence[str],
        *,
        bucket: str | None = None,
        config: R2Config | None = None,
    ) -> int:
        if not keys:
            return 0

        cfg, resolved_bucket = self._resolve(bucket, config)
        client = self._client(cfg)
        normalized = [normalize_key(k) for k in keys]
        chunks = [
            normalized[i : i + _DELETE_BATCH_SIZE]
            for i in range(0, len(normalized), _DELETE_BATCH_SIZE)
        ]
        tags = {"operation": "delete_files", "bucket": resolved_bucket}

        with record_operation(self._c.metrics, "delete_files", tags=tags):
            if len(chunks) == 1 or cfg.delete_parallel_batches <= 1:
                for chunk in chunks:
                    self._delete_chunk(client, resolved_bucket, chunk)
            else:
                workers = min(cfg.delete_parallel_batches, len(chunks))
                with ThreadPoolExecutor(max_workers=workers) as pool:
                    futures = [
                        pool.submit(self._delete_chunk, client, resolved_bucket, c)
                        for c in chunks
                    ]
                    for fut in as_completed(futures):
                        fut.result()

        for k in normalized:
            self._c.metadata_cache.invalidate(resolved_bucket, k)
        return len(chunks)

    @staticmethod
    @retry_with_backoff()
    def _delete_chunk(client, bucket: str, chunk: list[str]) -> None:
        client.delete_objects(
            Bucket=bucket,
            Delete={"Objects": [{"Key": k} for k in chunk], "Quiet": True},
        )

    # ── List ────────────────────────────────────────────────────────────────

    @with_circuit_breaker
    @retry_with_backoff()
    def list_objects(
        self,
        *,
        prefix: str = "",
        delimiter: str | None = None,
        bucket: str | None = None,
        config: R2Config | None = None,
        page_size: int = 1000,
        max_keys: int | None = None,
        continuation_token: str | None = None,
    ) -> ListObjectsResult:
        cfg, resolved_bucket = self._resolve(bucket, config)
        normalized_prefix = normalize_prefix(prefix) if prefix else ""
        client = self._client(cfg)
        params: dict = {
            "Bucket": resolved_bucket,
            "Prefix": normalized_prefix,
            "MaxKeys": min(max(page_size, 1), 1000),
        }
        if delimiter is not None:
            params["Delimiter"] = delimiter
        if continuation_token:
            params["ContinuationToken"] = continuation_token
        tags = {"operation": "list_objects", "bucket": resolved_bucket}

        with record_operation(self._c.metrics, "list_objects", tags=tags):
            page = client.list_objects_v2(**params)

        contents = page.get("Contents") or []
        if max_keys is not None:
            contents = contents[:max_keys]
        prefixes = tuple(
            p.get("Prefix", "") for p in (page.get("CommonPrefixes") or [])
        )
        return ListObjectsResult(
            objects=self._parse_contents(contents),
            prefixes=prefixes,
            is_truncated=bool(page.get("IsTruncated")),
            next_continuation_token=page.get("NextContinuationToken"),
        )

    def iter_objects(
        self,
        *,
        prefix: str = "",
        delimiter: str | None = None,
        bucket: str | None = None,
        config: R2Config | None = None,
        page_size: int = 1000,
        max_keys: int | None = None,
    ) -> Iterator[StoredObject]:
        cfg, resolved_bucket = self._resolve(bucket, config)
        normalized_prefix = normalize_prefix(prefix) if prefix else ""
        client = self._client(cfg)
        yielded = 0

        for page in paginate_list_objects_v2(
            client,
            bucket=resolved_bucket,
            prefix=normalized_prefix,
            delimiter=delimiter,
            page_size=page_size,
            max_keys=max_keys,
        ):
            for item in page.get("Contents") or []:
                yield StoredObject(
                    key=item["Key"],
                    size=int(item.get("Size", 0)),
                    etag=str(item.get("ETag", "")).strip('"'),
                    last_modified=item.get("LastModified"),
                    storage_class=item.get("StorageClass"),
                    version_id=item.get("VersionId"),
                )
                yielded += 1
                if max_keys is not None and yielded >= max_keys:
                    return

    @staticmethod
    def _parse_contents(contents: Sequence[dict]) -> tuple[StoredObject, ...]:
        return tuple(
            StoredObject(
                key=item["Key"],
                size=int(item.get("Size", 0)),
                etag=str(item.get("ETag", "")).strip('"'),
                last_modified=item.get("LastModified"),
                storage_class=item.get("StorageClass"),
                version_id=item.get("VersionId"),
            )
            for item in contents
        )

    # ── Exists / metadata ───────────────────────────────────────────────────

    @with_circuit_breaker
    @retry_with_backoff()
    def file_exists(
        self,
        key: str,
        *,
        bucket: str | None = None,
        config: R2Config | None = None,
        version_id: str | None = None,
    ) -> bool:
        """Check object existence via HeadObject (no metadata cache round-trip)."""
        cfg, resolved_bucket = self._resolve(bucket, config)
        normalized_key = normalize_key(key)
        client = self._client(cfg)
        params: dict = {"Bucket": resolved_bucket, "Key": normalized_key}
        if version_id:
            params["VersionId"] = version_id

        try:
            with OperationTimer(
                "file_exists",
                bucket=resolved_bucket,
                key=normalized_key,
            ):
                client.head_object(**params)
            return True
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise

    @with_circuit_breaker
    @retry_with_backoff()
    def get_object_metadata(
        self,
        key: str,
        *,
        bucket: str | None = None,
        config: R2Config | None = None,
        version_id: str | None = None,
    ) -> dict:
        cfg, resolved_bucket = self._resolve(bucket, config)
        normalized_key = normalize_key(key)

        cached = self._c.metadata_cache.get(
            resolved_bucket, normalized_key, version_id
        )
        if cached is not None:
            self._c.metrics.increment("storage.metadata_cache.hit")
            return cached

        self._c.metrics.increment("storage.metadata_cache.miss")
        client = self._client(cfg)
        params: dict = {"Bucket": resolved_bucket, "Key": normalized_key}
        if version_id:
            params["VersionId"] = version_id
        tags = {"operation": "head_object", "bucket": resolved_bucket}

        with record_operation(self._c.metrics, "head_object", tags=tags):
            try:
                response = client.head_object(**params)
            except ClientError as exc:
                code = exc.response.get("Error", {}).get("Code", "")
                if code in {"404", "NoSuchKey", "NotFound"}:
                    raise StorageNotFoundError(
                        f"Object not found: {normalized_key}"
                    ) from exc
                raise

        parsed = parse_head_object_response(response)
        result = parsed.to_dict()
        self._c.metadata_cache.set(
            resolved_bucket, normalized_key, version_id, result
        )
        return result

    # ── Move / copy ─────────────────────────────────────────────────────────

    @with_circuit_breaker
    @retry_with_backoff()
    def move_file(
        self,
        source_key: str,
        dest_key: str,
        *,
        source_bucket: str | None = None,
        dest_bucket: str | None = None,
        config: R2Config | None = None,
        source_version_id: str | None = None,
        dest_version_id: str | None = None,
    ) -> str:
        cfg, default_bucket = self._resolve(None, config)
        src_bucket = cfg.resolve_bucket(source_bucket or default_bucket)
        dst_bucket = cfg.resolve_bucket(dest_bucket or default_bucket)
        src_normalized = normalize_key(source_key)
        dst_normalized = normalize_key(dest_key)
        client = self._client(cfg)

        copy_source: dict = {"Bucket": src_bucket, "Key": src_normalized}
        if source_version_id:
            copy_source["VersionId"] = source_version_id

        extra: dict = {}
        if dest_version_id:
            extra["Metadata"] = {"x-version-id": dest_version_id}
            extra["MetadataDirective"] = "REPLACE"

        tags = {"operation": "move_file", "bucket": dst_bucket}
        with record_operation(self._c.metrics, "move_file", tags=tags):
            client.copy_object(
                Bucket=dst_bucket,
                Key=dst_normalized,
                CopySource=copy_source,
                **extra,
            )
            self.delete_file(
                src_normalized,
                bucket=src_bucket,
                config=cfg,
                version_id=source_version_id,
            )
        self._c.metadata_cache.invalidate(dst_bucket, dst_normalized)
        return dst_normalized

    @with_circuit_breaker
    @retry_with_backoff()
    def copy_file(
        self,
        source_key: str,
        dest_key: str,
        *,
        source_bucket: str | None = None,
        dest_bucket: str | None = None,
        config: R2Config | None = None,
        source_version_id: str | None = None,
    ) -> str:
        cfg, default_bucket = self._resolve(None, config)
        src_bucket = cfg.resolve_bucket(source_bucket or default_bucket)
        dst_bucket = cfg.resolve_bucket(dest_bucket or default_bucket)
        src_normalized = normalize_key(source_key)
        dst_normalized = normalize_key(dest_key)
        client = self._client(cfg)
        copy_source: dict = {"Bucket": src_bucket, "Key": src_normalized}
        if source_version_id:
            copy_source["VersionId"] = source_version_id

        with record_operation(self._c.metrics, "copy_file", tags={"bucket": dst_bucket}):
            client.copy_object(
                Bucket=dst_bucket,
                Key=dst_normalized,
                CopySource=copy_source,
            )
        self._c.metadata_cache.invalidate(dst_bucket, dst_normalized)
        return dst_normalized

    # ── URLs ────────────────────────────────────────────────────────────────

    def generate_public_url(
        self,
        key: str,
        *,
        bucket: str | None = None,
        config: R2Config | None = None,
        version_id: str | None = None,
    ) -> str:
        cfg, resolved_bucket = self._resolve(bucket, config)
        assert self._c.cdn_resolver is not None
        return self._c.cdn_resolver.public_url(
            key,
            bucket=resolved_bucket,
            version_id=version_id,
        )
