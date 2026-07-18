"""Offset helpers — UNICODE_CODE_POINT is canonical."""

from __future__ import annotations

OFFSET_UNIT = "UNICODE_CODE_POINT"


def as_codepoints(text: str) -> list[str]:
    """Python str is already a sequence of Unicode code points."""
    return list(text)


def slice_codepoints(text: str, start: int, end: int) -> str:
    if start < 0 or end < start or end > len(text):
        raise ValueError("INVALID_CODEPOINT_OFFSET")
    return text[start:end]


def assert_span_roundtrip(text: str, start: int, end: int, surface: str) -> None:
    if slice_codepoints(text, start, end) != surface:
        raise AssertionError("SPAN_ROUNDTRIP_FAILED")


def covered_exactly(text: str, spans: list[tuple[int, int]]) -> bool:
    if not spans and text == "":
        return True
    ordered = sorted(spans, key=lambda s: s[0])
    cursor = 0
    for start, end in ordered:
        if start != cursor or end < start:
            return False
        cursor = end
    return cursor == len(text)
