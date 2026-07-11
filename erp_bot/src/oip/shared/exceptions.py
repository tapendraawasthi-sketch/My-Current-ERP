"""OIP domain and application exceptions."""

from __future__ import annotations


class OipError(Exception):
    """Base error for Orbix Intelligence Platform."""


class OipValidationError(OipError):
    """Raised when input fails schema or business validation."""


class OipForbiddenError(OipError):
    """Raised when policy or permissions deny an operation."""


class OipNotFoundError(OipError):
    """Raised when a requested resource does not exist."""


class OipConflictError(OipError):
    """Raised on version or idempotency conflicts."""


class OipInfrastructureError(OipError):
    """Raised when an outbound port adapter fails."""
