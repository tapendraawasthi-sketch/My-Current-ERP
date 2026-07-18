"""Shared active-default guard after MAI-07R3S cutover.

Candidate factories remain non-default (DEFAULT_ACTIVE=False on each module).
Active production identity is mai-07.1.13-r3s-active + R3N6 pack.
"""

from __future__ import annotations

from .. import ENABLE_PROMOTION_OVERLAY, RESOURCE_PACK_VERSION, RUNTIME_VERSION

REQUIRED_ACTIVE_RUNTIME_VERSION = "mai-07.1.13-r3s-active"
REQUIRED_ACTIVE_PACK_VERSION = "mai-07.1.11-r3n6-chaincomplete"
HISTORICAL_PRE_CUTOVER_RUNTIME_VERSION = "mai-07.1.3-r3f-sealnew"


def assert_active_default_immutable(*, candidate_default_active: bool) -> None:
    if RUNTIME_VERSION != REQUIRED_ACTIVE_RUNTIME_VERSION:
        raise RuntimeError(f"active_runtime_drift:{RUNTIME_VERSION}")
    if RESOURCE_PACK_VERSION != REQUIRED_ACTIVE_PACK_VERSION:
        raise RuntimeError(f"active_pack_drift:{RESOURCE_PACK_VERSION}")
    if ENABLE_PROMOTION_OVERLAY is not False:
        raise RuntimeError("overlay_must_remain_disabled")
    if candidate_default_active is not False:
        raise RuntimeError("candidate_default_active_must_be_false")


__all__ = [
    "HISTORICAL_PRE_CUTOVER_RUNTIME_VERSION",
    "REQUIRED_ACTIVE_PACK_VERSION",
    "REQUIRED_ACTIVE_RUNTIME_VERSION",
    "assert_active_default_immutable",
]
