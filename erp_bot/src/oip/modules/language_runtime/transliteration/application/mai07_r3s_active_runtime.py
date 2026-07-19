"""MAI-07R3S — promote qualified R3N6 path to active default.

Pack: mai-07.1.11-r3n6-chaincomplete (V3-qualified under R3Q).
Runtime identity: mai-07.1.13-r3s-active.

Does not enable the historical R2 promotion overlay.
"""

from __future__ import annotations

from typing import Any

from ...infrastructure.compact_resource_repository import CompactResources
from ...normalization.infrastructure.norm_resource_repository import CompactNormResources
from .. import (
    ENABLE_PROMOTION_OVERLAY,
    PREVIOUS_ACTIVE_RESOURCE_HASH,
    PREVIOUS_ACTIVE_RUNTIME_VERSION,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from ..infrastructure.resource_repository import CompactXlResources, load_resources
from .mai07_r3n4_candidate_runtime import (
    analyze_language_r3n4,
    apply_r3n4_pipeline_to_frame,
    coalesce_structural_identifiers,
    refine_overmerged_identifier_spans,
)

ACTIVE_RUNTIME_VERSION = "mai-07.1.13-r3s-active"
ACTIVE_PACK_VERSION = "mai-07.1.11-r3n6-chaincomplete"
ACTIVE_PACK_CONTENT_HASH = (
    "8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106"
)
QUALIFIED_BY_ATTEMPT = "MAI_07R3Q_FROZEN_V3_ATTEMPT_001"
AUTHORITY = "ADR_0024"
DEFAULT_ACTIVE = True


def assert_active_cutover_consistent() -> None:
    if RUNTIME_VERSION != ACTIVE_RUNTIME_VERSION:
        raise RuntimeError(f"active_runtime_mismatch:{RUNTIME_VERSION}")
    if RESOURCE_PACK_VERSION != ACTIVE_PACK_VERSION:
        raise RuntimeError(f"active_pack_mismatch:{RESOURCE_PACK_VERSION}")
    if ENABLE_PROMOTION_OVERLAY is not False:
        raise RuntimeError("overlay_must_remain_disabled")
    if DEFAULT_ACTIVE is not True:
        raise RuntimeError("r3s_default_active_must_be_true")


def refine_frame_for_active(
    frame: Any,
    *,
    language_resources: CompactResources | None = None,
) -> Any:
    """Identifier refine + coalesce used on the default analyze path."""
    frame = refine_overmerged_identifier_spans(
        frame, language_resources=language_resources
    )
    return coalesce_structural_identifiers(frame)


def transliterate_active(
    raw_text: str,
    *,
    resources: CompactXlResources | None = None,
    language_resources: CompactResources | None = None,
    normalization_resources: CompactNormResources | None = None,
    path_spy=None,
) -> Any:
    """Active-default pipeline (R3N4/R3N6 behavior under R3S identity)."""
    assert_active_cutover_consistent()
    res = resources or load_resources()
    if res.content_hash != ACTIVE_PACK_CONTENT_HASH:
        raise RuntimeError(f"active_pack_hash_mismatch:{res.content_hash}")
    frame = analyze_language_r3n4(raw_text, language_resources=language_resources)
    bundle = apply_r3n4_pipeline_to_frame(
        frame,
        resources=res,
        normalization_resources=normalization_resources,
        path_spy=path_spy,
    )
    return bundle.model_copy(update={"runtime_version": RUNTIME_VERSION})


def cutover_identity_card() -> dict[str, Any]:
    return {
        "active_runtime_version": ACTIVE_RUNTIME_VERSION,
        "active_pack_version": ACTIVE_PACK_VERSION,
        "active_pack_content_hash": ACTIVE_PACK_CONTENT_HASH,
        "previous_active_runtime": PREVIOUS_ACTIVE_RUNTIME_VERSION,
        "previous_active_resource_hash": PREVIOUS_ACTIVE_RESOURCE_HASH,
        "qualified_by_attempt": QUALIFIED_BY_ATTEMPT,
        "authority": AUTHORITY,
        "candidate_promoted": True,
        "default_active": True,
        "overlay_enabled": False,
        "mai_08": "PASSED_ENGINEERING",
        "mai_09": "PASSED_ENGINEERING",
        "mai_10": "PASSED_ENGINEERING",
        "mai_11": "PASSED_ENGINEERING",
        "mai_12": "PASSED_ENGINEERING",
        "mai_13": "PASSED_ENGINEERING",
        "mai_14": "PASSED_ENGINEERING",
        "mai_15": "PASSED_ENGINEERING",
        "mai_16": "PASSED_ENGINEERING",
        "mai_17": "PASSED_ENGINEERING",
        "mai_18": "PASSED_ENGINEERING",
        "mai_19": "PASSED_ENGINEERING",
        "mai_20": "PASSED_ENGINEERING",
        "mai_21": "PASSED_ENGINEERING",
        "mai_22": "PASSED_ENGINEERING",
        "mai_23": "PASSED_ENGINEERING",
        "mai_24": "PASSED_ENGINEERING",
        "mai_25": "PASSED_ENGINEERING",
        "mai_26": "PASSED_ENGINEERING",
        "mai_27": "PASSED_ENGINEERING",
        "mai_28": "PASSED_ENGINEERING",
        "mai_29": "PASSED_ENGINEERING",
        "mai_30": "PASSED_ENGINEERING",
        "mai_31": "PASSED_ENGINEERING",
        "mai_32": "PASSED_ENGINEERING",
        "mai_33": "IN_PROGRESS",
    }


__all__ = [
    "ACTIVE_PACK_CONTENT_HASH",
    "ACTIVE_PACK_VERSION",
    "ACTIVE_RUNTIME_VERSION",
    "AUTHORITY",
    "DEFAULT_ACTIVE",
    "QUALIFIED_BY_ATTEMPT",
    "assert_active_cutover_consistent",
    "cutover_identity_card",
    "refine_frame_for_active",
    "transliterate_active",
]
