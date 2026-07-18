"""MAI-07R3N6 isolated evidence-chain corrective runtime.

R3N6 preserves R3N5 target-span behavior while replacing the incomplete scorer
and output-binding authority. It has a new explicit candidate identity so the
consumed R3N5 attempt remains immutable and cannot be rerun in place.
"""

from __future__ import annotations

from typing import Any

from ...infrastructure.compact_resource_repository import CompactResources
from ...normalization.infrastructure.norm_resource_repository import CompactNormResources
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from ..infrastructure.resource_repository import load_resources
from .build_mai07r3n6_pack import DEST as CANDIDATE_PACK_DIR
from .mai07_r3n5_candidate_runtime import (
    PARENT_RESOURCE_HASH,
    PARENT_RUNTIME_VERSION,
    transliterate_r3n5,
)

CANDIDATE_RUNTIME_VERSION = "mai-07.1.11-r3n6-chaincomplete"
CANDIDATE_POLICY_VERSION = "mai-07-r3n6.1.0.0"
PARENT_INVALIDATED_R3N5_RUNTIME_VERSION = "mai-07.1.10-r3n5-targetspan"
PARENT_INVALIDATED_R3N5_VERDICT = (
    "INVALIDATED_INCOMPLETE_INDEPENDENT_SCORING_AND_OUTPUT_BINDING_NEW_RC_REQUIRED"
)
PARENT_INVALIDATED_R3N5_ATTEMPT = "MAI_07R3N5_HOLDOUT_ATTEMPT_001"
PARENT_INVALIDATED_R3N5_LOCK_SEMANTIC = (
    "80bb914f01cc365582177592516ec2bb9e519f4f17a3456b1a2bd48d053af907"
)
DEFAULT_ACTIVE = False


def assert_active_default_immutable() -> None:
    from .mai07_active_default_guard import assert_active_default_immutable as _assert

    _assert(candidate_default_active=DEFAULT_ACTIVE)



def load_r3n6_resources() -> Any:
    assert_active_default_immutable()
    if not CANDIDATE_PACK_DIR.is_dir():
        raise FileNotFoundError(f"r3n6_pack_missing:{CANDIDATE_PACK_DIR}")
    return load_resources(resources_dir=CANDIDATE_PACK_DIR)


def transliterate_r3n6(
    raw_text: str,
    *,
    resources: Any | None = None,
    language_resources: CompactResources | None = None,
    normalization_resources: CompactNormResources | None = None,
    path_spy=None,
) -> Any:
    """Run inherited target-span-safe behavior under explicit R3N6 identity."""
    assert_active_default_immutable()
    bundle = transliterate_r3n5(
        raw_text,
        resources=resources or load_r3n6_resources(),
        language_resources=language_resources,
        normalization_resources=normalization_resources,
        path_spy=path_spy,
    )
    return bundle.model_copy(update={"runtime_version": CANDIDATE_RUNTIME_VERSION})


def candidate_identity_card() -> dict[str, Any]:
    return {
        "candidate_runtime_version": CANDIDATE_RUNTIME_VERSION,
        "candidate_policy_version": CANDIDATE_POLICY_VERSION,
        "parent_invalidated_r3n5_runtime": PARENT_INVALIDATED_R3N5_RUNTIME_VERSION,
        "parent_invalidated_r3n5_verdict": PARENT_INVALIDATED_R3N5_VERDICT,
        "parent_invalidated_r3n5_attempt": PARENT_INVALIDATED_R3N5_ATTEMPT,
        "parent_invalidated_r3n5_lock_semantic": PARENT_INVALIDATED_R3N5_LOCK_SEMANTIC,
        "active_parent_runtime": PARENT_RUNTIME_VERSION,
        "active_parent_resource_hash": PARENT_RESOURCE_HASH,
        "correction_scope": "COMPLETE_INDEPENDENT_SCORING_AND_OUTPUT_BINDING",
        "default_active": False,
        "candidate_promoted": False,
        "candidate_pack_dir": str(CANDIDATE_PACK_DIR),
    }


__all__ = [
    "CANDIDATE_POLICY_VERSION",
    "CANDIDATE_RUNTIME_VERSION",
    "DEFAULT_ACTIVE",
    "PARENT_INVALIDATED_R3N5_ATTEMPT",
    "PARENT_INVALIDATED_R3N5_LOCK_SEMANTIC",
    "PARENT_INVALIDATED_R3N5_RUNTIME_VERSION",
    "PARENT_INVALIDATED_R3N5_VERDICT",
    "assert_active_default_immutable",
    "candidate_identity_card",
    "load_r3n6_resources",
    "transliterate_r3n6",
]
