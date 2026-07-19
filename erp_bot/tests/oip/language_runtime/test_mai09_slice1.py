"""MAI-09 slice 1 — duration before money; IDs not amount."""

from __future__ import annotations

from oip.modules.language_runtime.application.language_analyzer import analyze_language
from oip.modules.language_runtime.number_roles import RUNTIME_VERSION
from oip.modules.language_runtime.number_roles.application.number_role_service import (
    attach_number_roles_to_frame,
    parse_number_roles,
)


def test_runtime_version():
    assert RUNTIME_VERSION == "mai-09.0.2-slice2"


def test_five_maina_is_duration_not_amount():
    text = "maile ghar bhada tirnu xa 5 maina ko"
    frame = analyze_language(text)
    roles = parse_number_roles(text, language_frame=frame)
    fives = [r for r in roles if r["surface"] == "5"]
    assert fives
    assert fives[0]["role"] == "duration"
    assert fives[0].get("unit") == "month"
    assert not any(r["surface"] == "5" and r["role"] == "amount" for r in roles)


def test_invoice_number_not_first_money():
    text = "invoice 9001 total due 400"
    frame = analyze_language(text)
    roles = parse_number_roles(text, language_frame=frame)
    by_surface = {r["surface"]: r["role"] for r in roles}
    assert by_surface.get("9001") == "invoice_number"
    assert by_surface.get("400") == "amount"


def test_pan_protected_is_identifier():
    text = "Do not mutate protected token PAN-A1B2C3D4E5 inside draft"
    frame = analyze_language(text)
    updated = attach_number_roles_to_frame(frame)
    assert updated.raw_text == text
    bundle = updated.number_role_bundle
    assert bundle is not None
    assert bundle.silent_applications == 0
    # Digit surfaces inside PAN should not be amount
    for c in bundle.candidates:
        if c.role.value == "amount":
            assert "PAN" not in text[max(0, c.raw_start - 4) : c.raw_end + 4]


def test_bare_digit_defaults_unknown():
    text = "check line 7 please"
    roles = parse_number_roles(text, language_frame=analyze_language(text))
    sevens = [r for r in roles if r["surface"] == "7"]
    assert sevens
    assert sevens[0]["role"] == "unknown"


def test_attach_populates_legacy_number_candidates():
    frame = attach_number_roles_to_frame(analyze_language("qty 2 pcs rice amount 500"))
    assert frame.number_candidates
    roles = {c["role"] for c in frame.number_candidates}
    assert "quantity" in roles or "amount" in roles
