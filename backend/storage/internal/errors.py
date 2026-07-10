"""Storage domain exceptions."""

from __future__ import annotations


class StorageError(Exception):
    """Base exception for storage operations."""


class StorageConfigError(StorageError):
    """Configuration-related storage failure."""


class StorageAuthError(StorageError):
    """Authentication or authorization failure talking to R2."""


class StoragePermissionError(StorageAuthError):
    """Valid credentials but insufficient permissions for the operation."""


class StorageNotFoundError(StorageError):
    """Requested object does not exist."""


class StorageConflictError(StorageError):
    """Object already exists or operation conflicts with current state."""


class StorageConnectionError(StorageError):
    """Network or service connectivity failure."""


class StorageRetryExhaustedError(StorageConnectionError):
    """Application-level retries were exhausted."""


class StorageCircuitOpenError(StorageConnectionError):
    """Circuit breaker is open — R2 calls are temporarily blocked."""
