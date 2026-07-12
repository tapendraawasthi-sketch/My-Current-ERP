"""Orbix v2 — genuine local reasoning agent for Sutra ERP.

Architecture:
    plan -> tool call -> observe -> reflect -> verify -> grounded answer

This package also hosts the dual-mode operating policy (Ask / Accountant)
used by the production OIP chat ingress.
"""

from __future__ import annotations

from .mode_policy import (
    ASK_CAPABILITIES,
    ModeCapabilities,
    normalize_orbix_mode,
    resolve_capabilities,
)

__all__ = [
    "__version__",
    "ASK_CAPABILITIES",
    "ModeCapabilities",
    "normalize_orbix_mode",
    "resolve_capabilities",
]

__version__ = "2.1.0"
