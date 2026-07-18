"""Canonical digests for MAI-06 reconstruction integrity (trusted-descriptor model)."""

from __future__ import annotations

import hashlib
import json
from typing import Iterable

from .....contracts.normalization import (
    NormalizationEditV1,
    OffsetMapV1,
    ReconstructionIntegrityV1,
    SafetyClass,
    ViewType,
)
from .. import (
    INTEGRITY_ALGORITHM,
    INTEGRITY_DOMAIN,
    INTEGRITY_SCHEMA_VERSION,
    NORMALIZER_VERSION,
    OFFSET_UNIT,
)

SUPPORTED_INTEGRITY_SCHEMA = frozenset({"1.0.0"})
SUPPORTED_NORMALIZER_VERSIONS = frozenset({NORMALIZER_VERSION})
SUPPORTED_NORMALIZER_PREFIX = "mai-06."


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def digest_text(surface: str, *, role: str) -> str:
    """Digest a Unicode surface with domain + role separation (UTF-8, length-prefixed)."""
    encoded = surface.encode("utf-8")
    payload = (
        INTEGRITY_DOMAIN.encode("utf-8")
        + b"\0"
        + role.encode("utf-8")
        + b"\0"
        + str(len(encoded)).encode("ascii")
        + b"\0"
        + encoded
    )
    return _sha256_hex(payload)


def _canonical_json(obj: object) -> bytes:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def applied_edits_for_view(
    edits: Iterable[NormalizationEditV1],
    view_type: ViewType,
) -> list[NormalizationEditV1]:
    out: list[NormalizationEditV1] = []
    for e in edits:
        if view_type not in e.applied_views:
            continue
        if e.safety_class in {
            SafetyClass.CANDIDATE_ONLY,
            SafetyClass.PROHIBITED,
            SafetyClass.SECURITY_REVIEW_REQUIRED,
        }:
            continue
        out.append(e)
    return out


def digest_edits(edits: list[NormalizationEditV1], view_type: ViewType) -> str:
    rows = []
    for idx, e in enumerate(edits):
        ns = e.normalized_span
        rows.append(
            {
                "order_index": idx,
                "edit_id": e.edit_id,
                "operation": e.operation.value,
                "safety_class": e.safety_class.value,
                "raw_start": e.raw_span.start_offset,
                "raw_end": e.raw_span.end_offset,
                "norm_start": None if ns is None else ns.start_offset,
                "norm_end": None if ns is None else ns.end_offset,
                "original_surface": e.original_surface,
                "candidate_surface": e.candidate_surface,
                "applied_view": view_type.value,
                "offset_unit": e.raw_span.offset_unit,
                "rule_id": e.rule_id,
                "rule_version": e.rule_version,
            }
        )
    payload = INTEGRITY_DOMAIN.encode("utf-8") + b"\0EDITS\0" + _canonical_json(rows)
    return _sha256_hex(payload)


def digest_offset_map(om: OffsetMapV1) -> str:
    rows = []
    for idx, s in enumerate(om.segments):
        rows.append(
            {
                "order_index": idx,
                "mapping_kind": s.mapping_kind.value,
                "raw_start": s.raw_start,
                "raw_end": s.raw_end,
                "normalized_start": s.normalized_start,
                "normalized_end": s.normalized_end,
                "edit_id": s.edit_id,
                "zero_width_norm": s.normalized_start == s.normalized_end,
                "offset_unit": om.offset_unit,
            }
        )
    body = {
        "raw_length": om.raw_length,
        "normalized_length": om.normalized_length,
        "mapping_version": om.mapping_version,
        "offset_unit": om.offset_unit,
        "segments": rows,
    }
    payload = INTEGRITY_DOMAIN.encode("utf-8") + b"\0MAP\0" + _canonical_json(body)
    return _sha256_hex(payload)


def digest_artifact(
    *,
    normalizer_version: str,
    view_name: str,
    offset_unit: str,
    source_codepoint_length: int,
    view_codepoint_length: int,
    source_digest: str,
    view_digest: str,
    edits_digest: str,
    offset_map_digest: str,
) -> str:
    body = {
        "integrity_algorithm": INTEGRITY_ALGORITHM,
        "integrity_domain": INTEGRITY_DOMAIN,
        "schema_version": INTEGRITY_SCHEMA_VERSION,
        "normalizer_version": normalizer_version,
        "view_name": view_name,
        "offset_unit": offset_unit,
        "source_codepoint_length": source_codepoint_length,
        "view_codepoint_length": view_codepoint_length,
        "source_digest": source_digest,
        "view_digest": view_digest,
        "edits_digest": edits_digest,
        "offset_map_digest": offset_map_digest,
    }
    payload = INTEGRITY_DOMAIN.encode("utf-8") + b"\0ARTIFACT\0" + _canonical_json(body)
    return _sha256_hex(payload)


def build_reconstruction_integrity(
    *,
    source_text: str,
    view_text: str,
    view_type: ViewType,
    offset_map: OffsetMapV1,
    applied_edits: list[NormalizationEditV1],
    normalizer_version: str = NORMALIZER_VERSION,
    offset_unit: str = OFFSET_UNIT,
) -> ReconstructionIntegrityV1:
    source_digest = digest_text(source_text, role="SOURCE")
    view_digest = digest_text(view_text, role="VIEW")
    edits_digest = digest_edits(applied_edits, view_type)
    map_digest = digest_offset_map(offset_map)
    artifact = digest_artifact(
        normalizer_version=normalizer_version,
        view_name=view_type.value,
        offset_unit=offset_unit,
        source_codepoint_length=len(source_text),
        view_codepoint_length=len(view_text),
        source_digest=source_digest,
        view_digest=view_digest,
        edits_digest=edits_digest,
        offset_map_digest=map_digest,
    )
    return ReconstructionIntegrityV1(
        schema_version=INTEGRITY_SCHEMA_VERSION,
        integrity_algorithm=INTEGRITY_ALGORITHM,
        integrity_domain=INTEGRITY_DOMAIN,
        normalizer_version=normalizer_version,
        view_name=view_type.value,
        offset_unit=offset_unit,
        source_codepoint_length=len(source_text),
        view_codepoint_length=len(view_text),
        source_digest=source_digest,
        view_digest=view_digest,
        edits_digest=edits_digest,
        offset_map_digest=map_digest,
        artifact_digest=artifact,
    )
