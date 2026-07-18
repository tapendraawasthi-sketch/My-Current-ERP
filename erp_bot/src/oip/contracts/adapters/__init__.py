"""Contract adapters package."""

from .canonical_oip import CanonicalOipRequestAdapter
from .legacy_orbix import (
    LegacyDraftCardAdapter,
    LegacyExecutionFlagAdapter,
    LegacyOrbixClientRequestAdapter,
    LegacyOrbixSseEventAdapter,
    LegacyReportSpecAdapter,
    trusted_scope_from_mai01,
)

__all__ = [
    "CanonicalOipRequestAdapter",
    "LegacyOrbixClientRequestAdapter",
    "LegacyOrbixSseEventAdapter",
    "LegacyDraftCardAdapter",
    "LegacyReportSpecAdapter",
    "LegacyExecutionFlagAdapter",
    "trusted_scope_from_mai01",
]
