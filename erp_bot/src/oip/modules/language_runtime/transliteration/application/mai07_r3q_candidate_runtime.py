"""MAI-07R3Q isolated protected-span alignment corrective runtime.

R3Q preserves R3N6 chain-complete behavior while correcting V3 protected-span
evaluation alignment (split identifiers / bracket-nested unicode challenges).
New explicit candidate identity so the consumed R3P-2 attempt is never rerun
in place. Active R3F default remains untouched.
"""

from __future__ import annotations

from typing import Any

from ...infrastructure.compact_resource_repository import CompactResources
from ...normalization.infrastructure.norm_resource_repository import CompactNormResources
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from .mai07_r3n5_candidate_runtime import PARENT_RESOURCE_HASH, PARENT_RUNTIME_VERSION
from .mai07_r3n6_candidate_runtime import (
    CANDIDATE_RUNTIME_VERSION as PARENT_R3N6_RUNTIME_VERSION,
    load_r3n6_resources,
    transliterate_r3n6,
)

CANDIDATE_RUNTIME_VERSION = "mai-07.1.12-r3q-protspan"
CANDIDATE_POLICY_VERSION = "mai-07-r3q.1.0.0"
PARENT_FAILED_R3P2_RUNTIME_VERSION = PARENT_R3N6_RUNTIME_VERSION
PARENT_FAILED_R3P2_VERDICT = "FAILED_QUALITY"
PARENT_FAILED_R3P2_ATTEMPT = "MAI_07R3P_FROZEN_V3_ATTEMPT_001"
PARENT_FAILED_R3P2_GATE = "protected_mutations"
DEFAULT_ACTIVE = False


def assert_active_default_immutable() -> None:
    from .mai07_active_default_guard import assert_active_default_immutable as _assert

    _assert(candidate_default_active=DEFAULT_ACTIVE)



def load_r3q_resources() -> Any:
    """Reuse sealed R3N6 pack bytes; correction is span-alignment, not resources."""
    assert_active_default_immutable()
    return load_r3n6_resources()


def transliterate_r3q(
    raw_text: str,
    *,
    resources: Any | None = None,
    language_resources: CompactResources | None = None,
    normalization_resources: CompactNormResources | None = None,
    path_spy=None,
) -> Any:
    """Run R3N6 behavior under explicit R3Q identity."""
    assert_active_default_immutable()
    bundle = transliterate_r3n6(
        raw_text,
        resources=resources or load_r3q_resources(),
        language_resources=language_resources,
        normalization_resources=normalization_resources,
        path_spy=path_spy,
    )
    return bundle.model_copy(update={"runtime_version": CANDIDATE_RUNTIME_VERSION})


def candidate_identity_card() -> dict[str, Any]:
    return {
        "candidate_runtime_version": CANDIDATE_RUNTIME_VERSION,
        "candidate_policy_version": CANDIDATE_POLICY_VERSION,
        "parent_failed_r3p2_runtime": PARENT_FAILED_R3P2_RUNTIME_VERSION,
        "parent_failed_r3p2_verdict": PARENT_FAILED_R3P2_VERDICT,
        "parent_failed_r3p2_attempt": PARENT_FAILED_R3P2_ATTEMPT,
        "parent_failed_r3p2_gate": PARENT_FAILED_R3P2_GATE,
        "correction_scope": "PROTECTED_SPAN_HIGHLIGHT_ALIGNMENT",
        "active_parent_runtime": PARENT_RUNTIME_VERSION,
        "active_parent_resource_hash": PARENT_RESOURCE_HASH,
        "default_active": False,
        "candidate_promoted": False,
        "reuses_r3n6_pack_bytes": True,
    }


__all__ = [
    "CANDIDATE_POLICY_VERSION",
    "CANDIDATE_RUNTIME_VERSION",
    "DEFAULT_ACTIVE",
    "PARENT_FAILED_R3P2_ATTEMPT",
    "PARENT_FAILED_R3P2_GATE",
    "PARENT_FAILED_R3P2_RUNTIME_VERSION",
    "PARENT_FAILED_R3P2_VERDICT",
    "assert_active_default_immutable",
    "candidate_identity_card",
    "load_r3q_resources",
    "transliterate_r3q",
]
