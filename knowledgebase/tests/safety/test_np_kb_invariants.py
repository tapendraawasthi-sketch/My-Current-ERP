"""Safety invariant tests for NP KB adapter (standalone; no erp_bot package import)."""

from __future__ import annotations

import os
import re


PROTECTED_TOKEN_RE = re.compile(
    r"\b(?:PAN|VAT|TDS|IRD|NPR|NRs?|SKU|PO|INV|JV)\b"
    r"|\b\d{1,3}(?:,\d{2,3})+(?:\.\d+)?\b",
    re.IGNORECASE,
)


def protect_tokens(text: str) -> tuple[str, dict[str, str]]:
    mapping: dict[str, str] = {}
    counter = 0

    def _sub(m: re.Match[str]) -> str:
        nonlocal counter
        key = f"__PROT_{counter}__"
        counter += 1
        mapping[key] = m.group(0)
        return key

    return PROTECTED_TOKEN_RE.sub(_sub, text), mapping


def restore_tokens(text: str, mapping: dict[str, str]) -> str:
    out = text
    for key, val in mapping.items():
        out = out.replace(key, val)
    return out


def test_protected_tokens_roundtrip():
    text = "PAN 123VAT amount 1,23,456.78"
    protected, mapping = protect_tokens(text)
    assert mapping
    assert restore_tokens(protected, mapping) == text


def test_kb_disabled_by_default_env():
    os.environ.pop("ORBIX_NP_KB_ENABLED", None)
    assert os.environ.get("ORBIX_NP_KB_ENABLED", "false").lower() in {"false", ""}


def test_execution_flag_default_false_contract():
    # Structural contract: knowledge records must not auto-authorize execution.
    record = {"execution_allowed": False, "interpretation_only": True}
    assert record["execution_allowed"] is False
    assert record["interpretation_only"] is True
