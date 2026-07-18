"""MAI-07R3N4 IdentityAnchorV1 — immutable raw-slice identity metadata.

The raw source text remains authoritative. The anchor is derived metadata,
never a replacement authority. Surfaces/digests must not enter production traces.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any

OFFSET_UNIT = "UNICODE_CODE_POINT"
SCHEMA_VERSION = "IdentityAnchorV1.1.0"
POLICY_VERSION = "mai-07-r3n4.1.0.0"


def _sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass(frozen=True, slots=True)
class IdentityAnchorV1:
    schema_version: str
    offset_unit: str
    raw_start: int
    raw_end_exclusive: int
    raw_surface: str
    raw_surface_digest: str
    source_text_digest: str
    anchor_kind: str
    created_from: str
    policy_version: str
    parent_anchor_ids: tuple[str, ...] = ()
    anchor_id: str = ""

    def to_public_dict(self) -> dict[str, Any]:
        """Hash/ID fields only — no raw surfaces for logs/artifacts."""
        return {
            "schema_version": self.schema_version,
            "offset_unit": self.offset_unit,
            "raw_start": self.raw_start,
            "raw_end_exclusive": self.raw_end_exclusive,
            "raw_surface_digest": self.raw_surface_digest,
            "source_text_digest": self.source_text_digest,
            "anchor_kind": self.anchor_kind,
            "created_from": self.created_from,
            "policy_version": self.policy_version,
            "parent_anchor_ids": list(self.parent_anchor_ids),
            "anchor_id": self.anchor_id,
        }


class IdentityAnchorError(ValueError):
    pass


def _anchor_id(
    *,
    source_text_digest: str,
    raw_start: int,
    raw_end_exclusive: int,
    raw_surface_digest: str,
    anchor_kind: str,
) -> str:
    payload = (
        f"{source_text_digest}|{raw_start}|{raw_end_exclusive}|"
        f"{raw_surface_digest}|{anchor_kind}|{POLICY_VERSION}"
    )
    return "anc_" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]


def create_identity_anchor(
    raw_text: str,
    *,
    raw_start: int,
    raw_end_exclusive: int,
    anchor_kind: str = "SOURCE_SPAN",
    created_from: str = "raw_slice",
    parent_anchor_ids: tuple[str, ...] = (),
) -> IdentityAnchorV1:
    if not isinstance(raw_text, str):
        raise IdentityAnchorError("raw_text_not_str")
    if raw_start < 0 or raw_end_exclusive < raw_start or raw_end_exclusive > len(raw_text):
        raise IdentityAnchorError(
            f"bounds_invalid:{raw_start}:{raw_end_exclusive}:len={len(raw_text)}"
        )
    slice_surface = raw_text[raw_start:raw_end_exclusive]
    source_digest = _sha256_text(raw_text)
    surface_digest = _sha256_text(slice_surface)
    aid = _anchor_id(
        source_text_digest=source_digest,
        raw_start=raw_start,
        raw_end_exclusive=raw_end_exclusive,
        raw_surface_digest=surface_digest,
        anchor_kind=anchor_kind,
    )
    anchor = IdentityAnchorV1(
        schema_version=SCHEMA_VERSION,
        offset_unit=OFFSET_UNIT,
        raw_start=raw_start,
        raw_end_exclusive=raw_end_exclusive,
        raw_surface=slice_surface,
        raw_surface_digest=surface_digest,
        source_text_digest=source_digest,
        anchor_kind=anchor_kind,
        created_from=created_from,
        policy_version=POLICY_VERSION,
        parent_anchor_ids=tuple(parent_anchor_ids),
        anchor_id=aid,
    )
    validate_identity_anchor(anchor, raw_text=raw_text)
    return anchor


def validate_identity_anchor(anchor: IdentityAnchorV1, *, raw_text: str) -> None:
    if anchor.schema_version != SCHEMA_VERSION:
        raise IdentityAnchorError("schema_mismatch")
    if anchor.offset_unit != OFFSET_UNIT:
        raise IdentityAnchorError("offset_unit_mismatch")
    if raw_text[anchor.raw_start : anchor.raw_end_exclusive] != anchor.raw_surface:
        raise IdentityAnchorError("raw_surface_slice_mismatch")
    if _sha256_text(anchor.raw_surface) != anchor.raw_surface_digest:
        raise IdentityAnchorError("raw_surface_digest_mismatch")
    if _sha256_text(raw_text) != anchor.source_text_digest:
        raise IdentityAnchorError("source_text_digest_mismatch")
    expected_id = _anchor_id(
        source_text_digest=anchor.source_text_digest,
        raw_start=anchor.raw_start,
        raw_end_exclusive=anchor.raw_end_exclusive,
        raw_surface_digest=anchor.raw_surface_digest,
        anchor_kind=anchor.anchor_kind,
    )
    if anchor.anchor_id != expected_id:
        raise IdentityAnchorError("anchor_id_mismatch")


def refine_anchor(
    parent: IdentityAnchorV1,
    raw_text: str,
    *,
    raw_start: int,
    raw_end_exclusive: int,
) -> IdentityAnchorV1:
    if raw_start < parent.raw_start or raw_end_exclusive > parent.raw_end_exclusive:
        raise IdentityAnchorError("refined_not_contained_in_parent")
    return create_identity_anchor(
        raw_text,
        raw_start=raw_start,
        raw_end_exclusive=raw_end_exclusive,
        anchor_kind="REFINED_SPAN",
        created_from="refine_from_parent",
        parent_anchor_ids=(parent.anchor_id, *parent.parent_anchor_ids),
    )


def coalesce_anchor(
    parents: tuple[IdentityAnchorV1, ...],
    raw_text: str,
    *,
    raw_start: int,
    raw_end_exclusive: int,
) -> IdentityAnchorV1:
    if not parents:
        raise IdentityAnchorError("coalesce_requires_parents")
    ordered = tuple(sorted(parents, key=lambda a: a.raw_start))
    for i in range(len(ordered) - 1):
        if ordered[i].raw_end_exclusive > ordered[i + 1].raw_start:
            raise IdentityAnchorError("coalesce_parent_overlap")
    # Final coalesced slice must own intervening raw characters between first and last.
    if raw_start != ordered[0].raw_start or raw_end_exclusive != ordered[-1].raw_end_exclusive:
        # Allow explicit ownership of intervening characters when bounds expand to cover gap.
        if raw_start > ordered[0].raw_start or raw_end_exclusive < ordered[-1].raw_end_exclusive:
            raise IdentityAnchorError("coalesce_bounds_do_not_cover_parents")
    return create_identity_anchor(
        raw_text,
        raw_start=raw_start,
        raw_end_exclusive=raw_end_exclusive,
        anchor_kind="COALESCED_SPAN",
        created_from="coalesce_from_parents",
        parent_anchor_ids=tuple(p.anchor_id for p in ordered),
    )


def split_anchors(
    parent: IdentityAnchorV1,
    raw_text: str,
    child_ranges: list[tuple[int, int]],
) -> tuple[IdentityAnchorV1, ...]:
    children: list[IdentityAnchorV1] = []
    prev_end = parent.raw_start
    for start, end in child_ranges:
        if start < parent.raw_start or end > parent.raw_end_exclusive or start >= end:
            raise IdentityAnchorError("split_child_out_of_parent")
        if start < prev_end:
            raise IdentityAnchorError("split_child_overlap_or_disorder")
        children.append(
            create_identity_anchor(
                raw_text,
                raw_start=start,
                raw_end_exclusive=end,
                anchor_kind="SPLIT_SPAN",
                created_from="split_from_parent",
                parent_anchor_ids=(parent.anchor_id,),
            )
        )
        prev_end = end
    return tuple(children)


def anchor_from_source_span(raw_text: str, start: int, end: int, *, kind: str = "SOURCE_SPAN") -> IdentityAnchorV1:
    return create_identity_anchor(
        raw_text,
        raw_start=start,
        raw_end_exclusive=end,
        anchor_kind=kind,
        created_from="source_span_annotation",
    )


__all__ = [
    "OFFSET_UNIT",
    "SCHEMA_VERSION",
    "POLICY_VERSION",
    "IdentityAnchorV1",
    "IdentityAnchorError",
    "create_identity_anchor",
    "validate_identity_anchor",
    "refine_anchor",
    "coalesce_anchor",
    "split_anchors",
    "anchor_from_source_span",
]
