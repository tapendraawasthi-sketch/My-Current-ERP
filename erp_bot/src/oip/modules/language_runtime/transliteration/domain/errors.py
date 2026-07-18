"""Typed errors for MAI-07 (safe codes only — never surfaces)."""

from __future__ import annotations


class TransliterationError(Exception):
    def __init__(self, code: str, detail: str = "") -> None:
        self.code = code
        self.detail = detail
        super().__init__(f"{code}:{detail}" if detail else code)


class TransliterationValidationError(TransliterationError):
    pass


class TransliterationResourceError(TransliterationError):
    pass
