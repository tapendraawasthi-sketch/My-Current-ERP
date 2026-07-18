"""Edit-based reconstruction and map validation — independent of bundle.raw_text."""

from __future__ import annotations

from dataclasses import dataclass

from .....contracts.normalization import (
    MappingKind,
    NormalizationEditV1,
    OffsetMapV1,
    ReconstructionIntegrityV1,
    SafetyClass,
    ViewType,
)
from .. import INTEGRITY_ALGORITHM, INTEGRITY_DOMAIN, OFFSET_UNIT
from .integrity import (
    SUPPORTED_INTEGRITY_SCHEMA,
    SUPPORTED_NORMALIZER_VERSIONS,
    applied_edits_for_view,
    digest_artifact,
    digest_edits,
    digest_offset_map,
    digest_text,
)
from .offset_ops import maps_cover_without_overlap


class ReconstructionError(Exception):
    """Typed failure for structural reconstruction (safe codes only)."""

    def __init__(self, code: str, detail: str = "") -> None:
        self.code = code
        self.detail = detail
        super().__init__(f"{code}:{detail}" if detail else code)


class ReconstructionValidationError(ReconstructionError):
    """Map/edit structural validation failed before reconstruction."""


class ReconstructionIntegrityError(ReconstructionError):
    """Trusted integrity descriptor disagrees with reconstruction artifacts."""


class UnsupportedReconstructionVersionError(ReconstructionError):
    """Integrity schema or normalizer version is not supported."""


@dataclass(frozen=True)
class ValidationReport:
    ok: bool
    errors: tuple[str, ...]


def get_preserved_raw(bundle) -> str:
    """Property A accessor — explicit raw preservation, not reconstruction."""
    return bundle.raw_text


def validate_offset_map(
    om: OffsetMapV1,
    *,
    view_text: str | None = None,
    applied_edits: tuple[NormalizationEditV1, ...] | list[NormalizationEditV1] = (),
) -> ValidationReport:
    errors: list[str] = []
    if type(om.raw_length) is not int or type(om.normalized_length) is not int:
        errors.append("NON_INTEGER_LENGTH")
    if om.raw_length < 0 or om.normalized_length < 0:
        errors.append("NEGATIVE_LENGTH")
    if view_text is not None and len(view_text) != om.normalized_length:
        errors.append("VIEW_LENGTH_MISMATCH")

    edit_ids = {e.edit_id for e in applied_edits}
    for s in om.segments:
        for v in (s.raw_start, s.raw_end, s.normalized_start, s.normalized_end):
            if type(v) is not int:
                errors.append("NON_INTEGER_BOUNDARY")
        if s.raw_end < s.raw_start or s.normalized_end < s.normalized_start:
            errors.append("INVERTED_SEGMENT")
        if s.raw_start < 0 or s.normalized_start < 0:
            errors.append("NEGATIVE_BOUNDARY")
        if s.raw_end > om.raw_length or s.normalized_end > om.normalized_length:
            errors.append("OUT_OF_BOUNDS_SEGMENT")
        if applied_edits and s.edit_id and s.edit_id not in edit_ids:
            errors.append("MISSING_EDIT_REF")
        raw_len = s.raw_end - s.raw_start
        norm_len = s.normalized_end - s.normalized_start
        if s.mapping_kind is MappingKind.IDENTITY and raw_len != norm_len:
            errors.append("IDENTITY_LENGTH_MISMATCH")
        if s.mapping_kind is MappingKind.ONE_TO_ONE and raw_len != norm_len:
            errors.append("ONE_TO_ONE_LENGTH_MISMATCH")
        if s.mapping_kind is MappingKind.MANY_TO_ONE and raw_len <= norm_len:
            errors.append("MANY_TO_ONE_LENGTH_RELATION")
        if s.mapping_kind is MappingKind.ONE_TO_MANY and norm_len <= raw_len:
            errors.append("ONE_TO_MANY_LENGTH_RELATION")
        if s.mapping_kind is MappingKind.INSERTION and raw_len != 0:
            errors.append("INSERTION_MUST_BE_ZERO_RAW")

    if not maps_cover_without_overlap(om):
        errors.append("COVERAGE_OR_OVERLAP")

    for e in applied_edits:
        if e.safety_class in {
            SafetyClass.CANDIDATE_ONLY,
            SafetyClass.PROHIBITED,
            SafetyClass.SECURITY_REVIEW_REQUIRED,
        }:
            continue
        if not e.applied_views:
            continue
        if e.normalized_span is not None and view_text is not None:
            ns = e.normalized_span.start_offset
            ne = e.normalized_span.end_offset
            if ne < ns or ns < 0 or ne > len(view_text):
                errors.append("EDIT_NORM_SPAN_OOB")
            elif ne > ns and view_text[ns:ne] != e.candidate_surface:
                errors.append("EDIT_SURFACE_MISMATCH")

    return ValidationReport(ok=not errors, errors=tuple(dict.fromkeys(errors)))


def _edit_norm_surface(e: NormalizationEditV1) -> str:
    if e.normalized_span is not None:
        return e.normalized_span.original_text
    return e.candidate_surface


def _require_integrity(integrity: ReconstructionIntegrityV1 | None) -> ReconstructionIntegrityV1:
    if integrity is None:
        raise UnsupportedReconstructionVersionError("MISSING_INTEGRITY", "integrity_required")
    if integrity.schema_version not in SUPPORTED_INTEGRITY_SCHEMA:
        raise UnsupportedReconstructionVersionError(
            "UNSUPPORTED_INTEGRITY_SCHEMA",
            f"schema={integrity.schema_version}",
        )
    if integrity.integrity_algorithm != INTEGRITY_ALGORITHM:
        raise UnsupportedReconstructionVersionError("UNSUPPORTED_INTEGRITY_ALGORITHM", "")
    if integrity.integrity_domain != INTEGRITY_DOMAIN:
        raise UnsupportedReconstructionVersionError("UNSUPPORTED_INTEGRITY_DOMAIN", "")
    if integrity.normalizer_version not in SUPPORTED_NORMALIZER_VERSIONS:
        raise UnsupportedReconstructionVersionError(
            "UNSUPPORTED_NORMALIZER_VERSION",
            f"version={integrity.normalizer_version}",
        )
    return integrity


def _validate_integrity_pre(
    *,
    view_text: str,
    applied: list[NormalizationEditV1],
    offset_map: OffsetMapV1,
    integrity: ReconstructionIntegrityV1,
    view_type: ViewType,
) -> None:
    if integrity.view_name != view_type.value:
        raise ReconstructionIntegrityError("VIEW_NAME_MISMATCH", f"expected={view_type.value}")
    if integrity.offset_unit != OFFSET_UNIT or offset_map.offset_unit != OFFSET_UNIT:
        raise ReconstructionIntegrityError("OFFSET_UNIT_MISMATCH", "")
    if integrity.view_codepoint_length != len(view_text):
        raise ReconstructionIntegrityError(
            "VIEW_LENGTH_MISMATCH",
            f"actual={len(view_text)} expected={integrity.view_codepoint_length}",
        )
    view_d = digest_text(view_text, role="VIEW")
    if view_d != integrity.view_digest:
        raise ReconstructionIntegrityError("VIEW_DIGEST_MISMATCH", f"edit_count={len(applied)}")

    edits_d = digest_edits(applied, view_type)
    if edits_d != integrity.edits_digest:
        raise ReconstructionIntegrityError("EDITS_DIGEST_MISMATCH", f"edit_count={len(applied)}")

    map_d = digest_offset_map(offset_map)
    if map_d != integrity.offset_map_digest:
        raise ReconstructionIntegrityError(
            "OFFSET_MAP_DIGEST_MISMATCH",
            f"segment_count={len(offset_map.segments)}",
        )

    if offset_map.normalized_length != len(view_text):
        raise ReconstructionIntegrityError(
            "VIEW_MAP_LENGTH_MISMATCH",
            f"map={offset_map.normalized_length} view={len(view_text)}",
        )
    if offset_map.raw_length != integrity.source_codepoint_length:
        raise ReconstructionIntegrityError(
            "SOURCE_LENGTH_BIND_MISMATCH",
            f"map={offset_map.raw_length} expected={integrity.source_codepoint_length}",
        )

    artifact_d = digest_artifact(
        normalizer_version=integrity.normalizer_version,
        view_name=integrity.view_name,
        offset_unit=integrity.offset_unit,
        source_codepoint_length=integrity.source_codepoint_length,
        view_codepoint_length=integrity.view_codepoint_length,
        source_digest=integrity.source_digest,
        view_digest=integrity.view_digest,
        edits_digest=integrity.edits_digest,
        offset_map_digest=integrity.offset_map_digest,
    )
    if artifact_d != integrity.artifact_digest:
        raise ReconstructionIntegrityError("ARTIFACT_DIGEST_MISMATCH", "")


def _validate_integrity_post(result: str, integrity: ReconstructionIntegrityV1) -> None:
    if len(result) != integrity.source_codepoint_length:
        raise ReconstructionIntegrityError(
            "RECONSTRUCTED_LENGTH_MISMATCH",
            f"actual={len(result)} expected={integrity.source_codepoint_length}",
        )
    source_d = digest_text(result, role="SOURCE")
    if source_d != integrity.source_digest:
        raise ReconstructionIntegrityError("SOURCE_DIGEST_MISMATCH", f"len={len(result)}")


def reconstruct_from_view(
    view_text: str,
    applied_edits: tuple[NormalizationEditV1, ...] | list[NormalizationEditV1],
    offset_map: OffsetMapV1,
    *,
    integrity: ReconstructionIntegrityV1 | None = None,
    view_type: ViewType | None = None,
) -> str:
    """Property B — rebuild raw from view + applied edits + map + integrity. Never takes raw_text."""
    integ = _require_integrity(integrity)
    vt = view_type
    if vt is None:
        try:
            vt = ViewType(integ.view_name)
        except ValueError as exc:
            raise ReconstructionIntegrityError("UNKNOWN_VIEW_NAME", "") from exc
    elif integ.view_name != vt.value:
        raise ReconstructionIntegrityError("VIEW_NAME_MISMATCH", f"expected={vt.value}")

    applied = applied_edits_for_view(applied_edits, vt)
    _validate_integrity_pre(
        view_text=view_text,
        applied=applied,
        offset_map=offset_map,
        integrity=integ,
        view_type=vt,
    )

    report = validate_offset_map(offset_map, view_text=view_text, applied_edits=applied)
    if not report.ok:
        raise ReconstructionValidationError("INVALID_MAP", ",".join(report.errors))

    by_id: dict[str, NormalizationEditV1] = {}
    for e in applied:
        if e.edit_id in by_id:
            raise ReconstructionValidationError("DUPLICATE_EDIT", e.edit_id)
        by_id[e.edit_id] = e

    ordered = sorted(
        enumerate(offset_map.segments),
        key=lambda iv: (iv[1].normalized_start, iv[1].normalized_end, iv[1].raw_start, iv[1].raw_end, iv[0]),
    )
    segs_walk = [s for _, s in ordered]

    parts: list[str] = []
    used: set[str] = set()
    cursor = 0

    for s in segs_walk:
        if s.normalized_start == s.normalized_end:
            if s.normalized_start != cursor:
                raise ReconstructionValidationError("ZERO_WIDTH_OUT_OF_ORDER", str(s.normalized_start))
            if not s.edit_id or s.edit_id not in by_id:
                raise ReconstructionValidationError("MISSING_EDIT", "none")
            ed = by_id[s.edit_id]
            used.add(s.edit_id)
            parts.append(ed.original_surface)
            continue

        if s.normalized_start != cursor:
            raise ReconstructionValidationError("MAP_GAP", f"{cursor}->{s.normalized_start}")

        slice_v = view_text[s.normalized_start : s.normalized_end]
        raw_len = s.raw_end - s.raw_start
        norm_len = s.normalized_end - s.normalized_start

        if s.edit_id:
            if s.edit_id not in by_id:
                raise ReconstructionValidationError("MISSING_EDIT", "ref")
            ed = by_id[s.edit_id]
            used.add(s.edit_id)
            if slice_v != _edit_norm_surface(ed) and slice_v != ed.candidate_surface:
                raise ReconstructionValidationError("CORRUPT_VIEW_SURFACE", "edit")
            if not ed.original_surface and raw_len > 0:
                raise ReconstructionValidationError("CORRUPT_EDIT", "edit")
            parts.append(ed.original_surface)
        else:
            if raw_len != norm_len:
                raise ReconstructionValidationError("UNEDITED_LENGTH_MISMATCH", f"{raw_len}:{norm_len}")
            if s.mapping_kind not in {MappingKind.IDENTITY, MappingKind.ONE_TO_ONE}:
                raise ReconstructionValidationError("UNEDITED_NON_IDENTITY", s.mapping_kind.value)
            parts.append(slice_v)
        cursor = s.normalized_end

    if cursor != offset_map.normalized_length:
        raise ReconstructionValidationError(
            "INCOMPLETE_COVERAGE",
            f"{cursor}/{offset_map.normalized_length}",
        )

    referenced = {s.edit_id for s in offset_map.segments if s.edit_id}
    for eid in referenced:
        if eid not in by_id:
            raise ReconstructionValidationError("MISSING_EDIT", "ref")
        if eid not in used:
            raise ReconstructionValidationError("UNUSED_EDIT", "ref")
    for e in applied:
        if e.edit_id not in referenced:
            raise ReconstructionValidationError("ORPHAN_APPLIED_EDIT", "ref")

    result = "".join(parts)
    _validate_integrity_post(result, integ)
    return result
