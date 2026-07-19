"""MAI-11 response language / register policy — never mutates raw; never rewrites replies in slice 1."""

from __future__ import annotations

RUNTIME_VERSION = "mai-11.0.2-slice2"
OFFSET_UNIT = "UNICODE_CODE_POINT"

__all__ = ["RUNTIME_VERSION", "OFFSET_UNIT"]
