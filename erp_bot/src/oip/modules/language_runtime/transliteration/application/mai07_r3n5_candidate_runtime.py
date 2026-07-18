"""MAI-07R3N5 isolated candidate runtime.

R3N5 retains the R3N4 anchor/finalization implementation and changes the
evaluation target authority.  It is a new explicit candidate identity so the
consumed R3N4 attempt is never repaired or rerun in place.  The active R3F
runtime remains untouched.
"""

from __future__ import annotations

from typing import Any

from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from .mai07_r3n4_candidate_runtime import (
    PARENT_RESOURCE_HASH,
    PARENT_RUNTIME_VERSION,
    transliterate_r3n4,
)
from ..infrastructure.resource_repository import load_resources
from .build_mai07r3n5_pack import DEST as CANDIDATE_PACK_DIR

CANDIDATE_RUNTIME_VERSION = "mai-07.1.10-r3n5-targetspan"
CANDIDATE_POLICY_VERSION = "mai-07-r3n5.1.0.0"
PARENT_FAILED_R3N4_RUNTIME_VERSION = "mai-07.1.9-r3n4-identityanchor"
PARENT_FAILED_R3N4_VERDICT = "FAILED_HOLDOUT_QUALITY"
PARENT_FAILED_R3N4_ATTEMPT = "MAI_07R3N4_HOLDOUT_ATTEMPT_001"
PARENT_FAILED_R3N4_LOCK_SEMANTIC = (
    "4e80b55ae8338e5b281b72c54311a1dca25c7f97e79a4d5dc1b0ba5ae7165d51"
)
DEFAULT_ACTIVE = False


def assert_active_default_immutable() -> None:
    if RUNTIME_VERSION != PARENT_RUNTIME_VERSION:
        raise RuntimeError(f"active_runtime_drift:{RUNTIME_VERSION}")
    if ENABLE_PROMOTION_OVERLAY is not False:
        raise RuntimeError("overlay_must_remain_disabled")
    if DEFAULT_ACTIVE is not False:
        raise RuntimeError("r3n5_default_active_must_be_false")


def transliterate_r3n5(
    raw_text: str,
    *,
    resources: Any | None = None,
    language_resources: Any | None = None,
    normalization_resources: Any | None = None,
    path_spy=None,
) -> Any:
    """Run the inherited anchor-safe implementation under explicit R3N5 identity."""
    assert_active_default_immutable()
    bundle = transliterate_r3n4(
        raw_text,
        resources=resources or load_r3n5_resources(),
        language_resources=language_resources,
        normalization_resources=normalization_resources,
        path_spy=path_spy,
    )
    return bundle.model_copy(update={"runtime_version": CANDIDATE_RUNTIME_VERSION})


def load_r3n5_resources() -> Any:
    assert_active_default_immutable()
    if not CANDIDATE_PACK_DIR.is_dir():
        raise FileNotFoundError(f"r3n5_pack_missing:{CANDIDATE_PACK_DIR}")
    return load_resources(resources_dir=CANDIDATE_PACK_DIR)


def candidate_identity_card() -> dict[str, Any]:
    return {
        "candidate_runtime_version": CANDIDATE_RUNTIME_VERSION,
        "candidate_policy_version": CANDIDATE_POLICY_VERSION,
        "parent_failed_r3n4_runtime": PARENT_FAILED_R3N4_RUNTIME_VERSION,
        "parent_failed_r3n4_verdict": PARENT_FAILED_R3N4_VERDICT,
        "parent_failed_r3n4_attempt": PARENT_FAILED_R3N4_ATTEMPT,
        "parent_failed_r3n4_lock_semantic": PARENT_FAILED_R3N4_LOCK_SEMANTIC,
        "active_parent_runtime": PARENT_RUNTIME_VERSION,
        "active_parent_resource_hash": PARENT_RESOURCE_HASH,
        "correction_scope": "TARGET_SPAN_AND_EVALUATION_PATH_AUTHORITY",
        "default_active": False,
        "candidate_promoted": False,
        "candidate_pack_dir": str(CANDIDATE_PACK_DIR),
    }


__all__ = [
    "CANDIDATE_POLICY_VERSION",
    "CANDIDATE_RUNTIME_VERSION",
    "DEFAULT_ACTIVE",
    "PARENT_FAILED_R3N4_ATTEMPT",
    "PARENT_FAILED_R3N4_LOCK_SEMANTIC",
    "PARENT_FAILED_R3N4_RUNTIME_VERSION",
    "PARENT_FAILED_R3N4_VERDICT",
    "assert_active_default_immutable",
    "candidate_identity_card",
    "load_r3n5_resources",
    "transliterate_r3n5",
]
