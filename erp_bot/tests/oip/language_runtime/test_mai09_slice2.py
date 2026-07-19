"""MAI-09 slice 2 — word numerals + BS/AD date roles."""

from __future__ import annotations

from oip.modules.language_runtime.application.language_analyzer import analyze_language
from oip.modules.language_runtime.number_roles.application.bs_ad_service import (
    ad_to_bs,
    bs_to_ad,
)
from oip.modules.language_runtime.number_roles.application.number_role_service import (
    attach_number_roles_to_frame,
    parse_number_roles,
)
from oip.modules.language_runtime.number_roles.application.word_numerals import (
    expand_word_numeral_phrases,
)


def test_bs_ad_epoch_roundtrip():
    assert bs_to_ad(2000, 1, 1).isoformat() == "1943-04-14"
    assert ad_to_bs(1943, 4, 14) == (2000, 1, 1)
    assert bs_to_ad(2081, 1, 1).isoformat() == "2024-04-13"


def test_five_hajar_is_amount_5000():
    phrases = expand_word_numeral_phrases("ram lai 5 hajar tiryo")
    assert phrases
    assert phrases[0]["normalized_value"] == "5000"
    assert phrases[0]["role"] == "amount"


def test_two_lakh_and_one_crore():
    assert expand_word_numeral_phrases("sale 2 lakh cash")[0]["normalized_value"] == "200000"
    assert expand_word_numeral_phrases("project 1 crore")[0]["normalized_value"] == "10000000"


def test_tin_hajar_word_digit():
    assert expand_word_numeral_phrases("tin hajar cash bechye")[0]["normalized_value"] == "3000"


def test_parse_roles_word_numeral_and_duration_coexist():
    text = "5 maina ko rent 2 lakh due"
    roles = parse_number_roles(text, language_frame=analyze_language(text))
    by_role = {}
    for r in roles:
        by_role.setdefault(r["role"], []).append(r)
    assert any(r["surface"] == "5" for r in by_role.get("duration", []))
    assert any(r["normalized_value"] == "200000" for r in by_role.get("amount", []))


def test_bs_date_converts_to_ad():
    text = "voucher date BS 2081-01-01"
    roles = parse_number_roles(text, language_frame=analyze_language(text))
    dates = [r for r in roles if r["role"] == "date"]
    assert dates
    assert dates[0]["normalized_value"] == "2024-04-13"
    assert "BS_TO_AD_CONVERTED" in dates[0]["reason_codes"]


def test_ad_date_has_bs_available():
    text = "invoice on 2024-04-13"
    roles = parse_number_roles(text, language_frame=analyze_language(text))
    dates = [r for r in roles if r["role"] == "date"]
    assert dates
    assert dates[0]["normalized_value"] == "2024-04-13"
    assert any("AD_TO_BS_AVAILABLE" in c or c == "AD_TO_BS_AVAILABLE" for c in dates[0]["reason_codes"])


def test_attach_fills_date_candidates():
    frame = attach_number_roles_to_frame(analyze_language("entry 2081/01/01 BS"))
    assert frame.date_candidates
    assert frame.number_role_bundle
    assert frame.number_role_bundle.runtime_version == "mai-09.0.2-slice2"
