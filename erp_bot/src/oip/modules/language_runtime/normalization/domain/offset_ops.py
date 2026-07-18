"""Exact integer code-point boundary mapping — no float ratios."""

from __future__ import annotations

from dataclasses import dataclass

from .....contracts.normalization import MappingKind, OffsetMapSegmentV1, OffsetMapV1


@dataclass(frozen=True)
class BoundaryRange:
    """Exclusive-end code-point range [start, end). Point: start == end is a boundary."""

    start: int
    end: int

    def __post_init__(self) -> None:
        if self.start < 0 or self.end < self.start:
            raise ValueError("INVALID_BOUNDARY_RANGE")


@dataclass
class Seg:
    raw_start: int
    raw_end: int
    norm_start: int
    norm_end: int
    kind: MappingKind = MappingKind.IDENTITY
    edit_id: str | None = None


def identity_map(length: int, *, version: str = "mai-06.1.0") -> OffsetMapV1:
    segs: tuple[OffsetMapSegmentV1, ...] = ()
    if length:
        segs = (
            OffsetMapSegmentV1(
                raw_start=0,
                raw_end=length,
                normalized_start=0,
                normalized_end=length,
                mapping_kind=MappingKind.IDENTITY,
            ),
        )
    return OffsetMapV1(
        segments=segs,
        raw_length=length,
        normalized_length=length,
        mapping_version=version,
    )


def build_map(segs: list[Seg], *, raw_len: int, norm_len: int, version: str = "mai-06.1.0") -> OffsetMapV1:
    # Keep zero-width normalized segments (applied deletions / trim).
    built: list[OffsetMapSegmentV1] = []
    for s in segs:
        if s.raw_start == s.raw_end and s.norm_start == s.norm_end:
            continue
        built.append(
            OffsetMapSegmentV1(
                raw_start=s.raw_start,
                raw_end=s.raw_end,
                normalized_start=s.norm_start,
                normalized_end=s.norm_end,
                edit_id=s.edit_id,
                mapping_kind=s.kind,
            )
        )
    return OffsetMapV1(
        segments=tuple(built),
        raw_length=raw_len,
        normalized_length=norm_len,
        mapping_version=version,
    )


def _seg_covers_norm_unit(s: OffsetMapSegmentV1, i: int) -> bool:
    """Character unit [i, i+1) under normalized axis."""
    return s.normalized_start <= i < s.normalized_end


def _seg_covers_raw_unit(s: OffsetMapSegmentV1, i: int) -> bool:
    return s.raw_start <= i < s.raw_end


def map_norm_point_to_raw_range(om: OffsetMapV1, point: int) -> BoundaryRange:
    """Map a normalized boundary/point to a conservative raw boundary range.

    For equal-length IDENTITY/ONE_TO_ONE: exact corresponding boundary (start==end).
    For MANY_TO_ONE interior units: full raw segment.
    For ONE_TO_MANY: exact corresponding raw unit via edit segment.
    """
    if point < 0 or point > om.normalized_length:
        raise ValueError("INVALID_NORMALIZED_POINT")
    if point == om.normalized_length:
        return BoundaryRange(om.raw_length, om.raw_length)
    if point == 0:
        # Prefer boundary at start of first covering segment
        for s in om.segments:
            if s.normalized_start == 0:
                return BoundaryRange(s.raw_start, s.raw_start)
    # Boundary between characters: prefer start of unit at `point` if any
    for s in om.segments:
        if s.normalized_start == point:
            return BoundaryRange(s.raw_start, s.raw_start)
        if s.normalized_end == point:
            return BoundaryRange(s.raw_end, s.raw_end)
    # Interior of a character unit — map unit [point, point+1)
    return map_norm_unit_to_raw_range(om, point)


def map_norm_unit_to_raw_range(om: OffsetMapV1, unit_start: int) -> BoundaryRange:
    if unit_start < 0 or unit_start >= om.normalized_length:
        raise ValueError("INVALID_NORMALIZED_UNIT")
    for s in om.segments:
        if not _seg_covers_norm_unit(s, unit_start):
            continue
        raw_len = s.raw_end - s.raw_start
        norm_len = s.normalized_end - s.normalized_start
        if s.mapping_kind in {MappingKind.IDENTITY, MappingKind.ONE_TO_ONE} and raw_len == norm_len:
            off = unit_start - s.normalized_start
            return BoundaryRange(s.raw_start + off, s.raw_start + off + 1)
        if s.mapping_kind is MappingKind.ONE_TO_MANY and raw_len == 1:
            return BoundaryRange(s.raw_start, s.raw_end)
        if s.mapping_kind is MappingKind.MANY_TO_ONE or raw_len != norm_len:
            # Conservative: whole raw side of the segment
            return BoundaryRange(s.raw_start, s.raw_end)
        # Fallback equal-length without kind
        if raw_len == norm_len:
            off = unit_start - s.normalized_start
            return BoundaryRange(s.raw_start + off, s.raw_start + off + 1)
        return BoundaryRange(s.raw_start, s.raw_end)
    raise ValueError("UNMAPPED_NORMALIZED_UNIT")


def map_raw_point_to_norm_range(om: OffsetMapV1, point: int) -> BoundaryRange:
    if point < 0 or point > om.raw_length:
        raise ValueError("INVALID_RAW_POINT")
    if point == om.raw_length:
        return BoundaryRange(om.normalized_length, om.normalized_length)
    for s in om.segments:
        if s.raw_start == point:
            return BoundaryRange(s.normalized_start, s.normalized_start)
        if s.raw_end == point:
            return BoundaryRange(s.normalized_end, s.normalized_end)
    return map_raw_unit_to_norm_range(om, point)


def map_raw_unit_to_norm_range(om: OffsetMapV1, unit_start: int) -> BoundaryRange:
    if unit_start < 0 or unit_start >= om.raw_length:
        raise ValueError("INVALID_RAW_UNIT")
    for s in om.segments:
        if not _seg_covers_raw_unit(s, unit_start):
            continue
        raw_len = s.raw_end - s.raw_start
        norm_len = s.normalized_end - s.normalized_start
        if s.mapping_kind in {MappingKind.IDENTITY, MappingKind.ONE_TO_ONE} and raw_len == norm_len:
            off = unit_start - s.raw_start
            return BoundaryRange(s.normalized_start + off, s.normalized_start + off + 1)
        if norm_len == 0:
            # Deletion into view — maps to a boundary point
            return BoundaryRange(s.normalized_start, s.normalized_start)
        if s.mapping_kind is MappingKind.MANY_TO_ONE or raw_len != norm_len:
            return BoundaryRange(s.normalized_start, s.normalized_end)
        if raw_len == norm_len:
            off = unit_start - s.raw_start
            return BoundaryRange(s.normalized_start + off, s.normalized_start + off + 1)
        return BoundaryRange(s.normalized_start, s.normalized_end)
    raise ValueError("UNMAPPED_RAW_UNIT")


def map_norm_span_to_raw(om: OffsetMapV1, start: int, end: int) -> tuple[int, int]:
    """Conservative exclusive span mapping."""
    if start < 0 or end < start or end > om.normalized_length:
        raise ValueError("INVALID_NORMALIZED_SPAN")
    if start == end:
        br = map_norm_point_to_raw_range(om, start)
        return br.start, br.end if br.end > br.start else br.start
    raw_lo = om.raw_length
    raw_hi = 0
    for i in range(start, end):
        br = map_norm_unit_to_raw_range(om, i)
        raw_lo = min(raw_lo, br.start)
        raw_hi = max(raw_hi, br.end)
    # Also absorb zero-width deletion segments anchored inside [start, end]
    for s in om.segments:
        if s.normalized_start == s.normalized_end and start <= s.normalized_start <= end:
            raw_lo = min(raw_lo, s.raw_start)
            raw_hi = max(raw_hi, s.raw_end)
    if raw_hi < raw_lo:
        br = map_norm_point_to_raw_range(om, start)
        return br.start, br.start
    return raw_lo, raw_hi


def map_raw_span_to_norm(om: OffsetMapV1, start: int, end: int) -> tuple[int, int]:
    if start < 0 or end < start or end > om.raw_length:
        raise ValueError("INVALID_RAW_SPAN")
    if start == end:
        br = map_raw_point_to_norm_range(om, start)
        return br.start, br.end if br.end > br.start else br.start
    n_lo = om.normalized_length
    n_hi = 0
    for i in range(start, end):
        br = map_raw_unit_to_norm_range(om, i)
        n_lo = min(n_lo, br.start)
        n_hi = max(n_hi, br.end)
    if n_hi < n_lo:
        br = map_raw_point_to_norm_range(om, start)
        return br.start, br.start
    return n_lo, n_hi


# Back-compat helpers used by older call sites: return the start of the range for "point"
def map_norm_point_to_raw(om: OffsetMapV1, point: int) -> int:
    return map_norm_point_to_raw_range(om, point).start


def map_raw_point_to_norm(om: OffsetMapV1, point: int) -> int:
    return map_raw_point_to_norm_range(om, point).start


def maps_cover_without_overlap(om: OffsetMapV1) -> bool:
    """Normalized axis covered without positive-length overlaps; zero-width allowed at boundaries."""
    if om.normalized_length == 0:
        return True
    cursor = 0
    for s in sorted(om.segments, key=lambda x: (x.normalized_start, x.normalized_end, x.raw_start)):
        if s.normalized_end < s.normalized_start:
            return False
        if s.normalized_start == s.normalized_end:
            # zero-width deletion/insertion at a boundary — must sit at cursor or after progress
            if s.normalized_start < 0 or s.normalized_start > om.normalized_length:
                return False
            if s.normalized_start < cursor:
                return False
            continue
        if s.normalized_start != cursor:
            return False
        cursor = s.normalized_end
    return cursor == om.normalized_length


def float_interpolation_usage_count(source_text: str) -> int:
    """Static audit helper for tests — counts forbidden executable patterns."""
    lines = []
    in_helper = False
    for line in source_text.splitlines():
        if "def float_interpolation_usage_count" in line:
            in_helper = True
            continue
        if in_helper:
            # end helper at next top-level def
            if line.startswith("def ") or line.startswith("class "):
                in_helper = False
            else:
                continue
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        lines.append(line)
    body = "\n".join(lines)
    count = 0
    needle_ratio = "rat" + "io ="
    needle_round = "int(ro" + "und("
    if needle_ratio in body:
        count += 1
    if needle_round in body:
        count += 1
    return count
