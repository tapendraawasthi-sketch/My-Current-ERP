"""Application-level retry with exponential backoff and jitter."""

from __future__ import annotations

import logging
import random
import time
from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar

from botocore.exceptions import BotoCoreError, ClientError

from backend.config.r2 import R2ConfigError
from backend.storage.internal.errors import (
    StorageAuthError,
    StorageCircuitOpenError,
    StorageConfigError,
    StorageConflictError,
    StorageConnectionError,
    StorageError,
    StorageNotFoundError,
    StoragePermissionError,
    StorageRetryExhaustedError,
)

P = ParamSpec("P")
T = TypeVar("T")

logger = logging.getLogger(__name__)

_RETRYABLE_CLIENT_CODES = frozenset(
    {
        "RequestTimeout",
        "RequestTimeoutException",
        "ServiceUnavailable",
        "InternalError",
        "SlowDown",
        "Throttling",
        "ThrottlingException",
        "TooManyRequestsException",
        "ProvisionedThroughputExceededException",
    }
)


def map_client_error(exc: ClientError, *, key: str | None = None) -> StorageError:
    """Translate boto3 ``ClientError`` into domain exceptions."""
    code = exc.response.get("Error", {}).get("Code", "")
    message = exc.response.get("Error", {}).get("Message", str(exc))
    ctx = f" (key={key!r})" if key else ""

    if code in {"InvalidAccessKeyId", "SignatureDoesNotMatch"}:
        return StorageAuthError(
            "R2 credentials are invalid. "
            "Verify R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY."
            + ctx
        )
    if code in {"AccessDenied", "403"}:
        return StoragePermissionError(
            f"R2 access denied{ctx}: {message}"
        )
    if code in {"NoSuchKey", "404", "NotFound"}:
        return StorageNotFoundError(f"Object not found{ctx}: {message}")
    if code in {"NoSuchBucket"}:
        return StorageNotFoundError(f"Bucket not found{ctx}: {message}")
    if code in {"BucketAlreadyOwnedByYou", "BucketAlreadyExists"}:
        return StorageConflictError(f"Bucket conflict: {message}")
    return StorageError(f"R2 operation failed [{code}]{ctx}: {message}")


def map_boto_error(exc: Exception, *, key: str | None = None) -> StorageError:
    """Map any boto-related exception to a storage error."""
    if isinstance(exc, StorageError):
        return exc
    if isinstance(exc, ClientError):
        return map_client_error(exc, key=key)
    if isinstance(exc, BotoCoreError):
        return StorageConnectionError(f"R2 connection error: {exc}")
    if isinstance(exc, R2ConfigError):
        return StorageConfigError(str(exc))
    return StorageError(str(exc))


def is_retryable(exc: Exception) -> bool:
    """Return whether an exception warrants application-level retry."""
    if isinstance(
        exc,
        (
            StorageAuthError,
            StoragePermissionError,
            StorageConfigError,
            StorageNotFoundError,
            StorageCircuitOpenError,
        ),
    ):
        return False
    if isinstance(exc, ClientError):
        code = exc.response.get("Error", {}).get("Code", "")
        return code in _RETRYABLE_CLIENT_CODES
    if isinstance(exc, BotoCoreError):
        return True
    if isinstance(exc, StorageConnectionError):
        return True
    return False


def _resolve_max_attempts(
    max_attempts: int | None, args: tuple[object, ...]
) -> int:
    """Resolve retry limit from decorator arg or service config."""
    if max_attempts is not None:
        return max_attempts
    if args and hasattr(args[0], "_c"):
        return int(args[0]._c.config.app_retry_max_attempts)
    return 3


def retry_with_backoff(
    *,
    max_attempts: int | None = None,
    base_delay: float = 0.1,
    max_delay: float = 5.0,
    jitter: float = 0.25,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """Decorator applying exponential backoff for transient failures."""

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            attempts_limit = _resolve_max_attempts(max_attempts, args)
            attempt = 0
            while True:
                attempt += 1
                try:
                    return func(*args, **kwargs)
                except FileNotFoundError:
                    raise
                except Exception as exc:
                    if attempt >= attempts_limit or not is_retryable(exc):
                        if attempt >= attempts_limit and is_retryable(exc):
                            raise StorageRetryExhaustedError(
                                f"{func.__name__} failed after {attempts_limit} attempts"
                            ) from exc
                        raise
                    delay = min(max_delay, base_delay * (2 ** (attempt - 1)))
                    delay += random.uniform(0, jitter * delay)
                    logger.warning(
                        "Retrying %s attempt=%d/%d delay=%.3fs error=%s",
                        func.__name__,
                        attempt,
                        attempts_limit,
                        delay,
                        type(exc).__name__,
                    )
                    time.sleep(delay)

        return wrapper

    return decorator


def with_storage_error_handling(
    operation: str,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """Decorator that logs and maps exceptions for sync storage calls."""

    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            key = kwargs.get("key")
            try:
                return func(*args, **kwargs)
            except FileNotFoundError:
                raise
            except Exception as exc:
                mapped = map_boto_error(
                    exc, key=key if isinstance(key, str) else None
                )
                logger.error(
                    "R2 %s failed: %s",
                    operation,
                    mapped,
                    exc_info=exc if not isinstance(exc, StorageError) else None,
                )
                raise mapped from exc

        return wrapper

    return decorator
