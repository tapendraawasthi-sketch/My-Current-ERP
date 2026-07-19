"""MAI-11 response language + linguistic register policy.

Annotation / policy only. Never mutates raw_text. Never rewrites model output.
"""

from __future__ import annotations

import re

from .....contracts.language import LanguageFrameV1
from .....contracts.response_register import (
    LinguisticRegisterKind,
    ResponseLanguageKind,
    ResponseRegisterBundleV1,
    ResponseRegisterStatus,
)
from ...domain.taxonomy import CodeMixPattern, LanguageForm
from .. import OFFSET_UNIT, RUNTIME_VERSION

_HONORIFIC = re.compile(r"(?i)\b(tapai|tapaai|hajur|हजुर|तपाईं|तपाई)\b")
_ACCOUNTING_FORMAL = re.compile(
    r"(?i)\b(journal|ledger|trial\s+balance|debit|credit|liability|asset|"
    r"financial\s+statement|voucher|fiscal)\b"
)
_DEVANAGARI_CHAR = re.compile(r"[\u0900-\u097F]")


def _share(distribution: dict[str, float], *keys: str) -> float:
    return sum(float(distribution.get(k, 0.0) or 0.0) for k in keys)


def _script_fallback_language(raw_text: str) -> ResponseLanguageKind:
    chars = [c for c in raw_text if not c.isspace()]
    if not chars:
        return ResponseLanguageKind.UNKNOWN
    deva = sum(1 for c in chars if _DEVANAGARI_CHAR.match(c))
    ratio = deva / len(chars)
    if ratio >= 0.55:
        return ResponseLanguageKind.NEPALI_DEVANAGARI
    if ratio <= 0.05 and re.search(r"[A-Za-z]", raw_text):
        # Latin-only without form distribution — treat as romanized shop default
        # unless strong English accounting cues (handled by caller).
        return ResponseLanguageKind.ROMANIZED_NEPALI
    if 0.05 < ratio < 0.55:
        return ResponseLanguageKind.MIXED
    return ResponseLanguageKind.UNKNOWN


def decide_response_register(
    *,
    raw_text: str,
    language_distribution: dict[str, float] | None = None,
    code_mix_pattern: str | None = None,
) -> ResponseRegisterBundleV1:
    dist = dict(language_distribution or {})
    reasons: list[str] = ["RESPONSE_REGISTER_POLICY"]

    en = _share(dist, LanguageForm.ENGLISH.value, LanguageForm.TECHNICAL_ACCOUNTING_ENGLISH.value)
    rom = _share(dist, LanguageForm.ROMANIZED_NEPALI.value)
    dev = _share(dist, LanguageForm.NEPALI_DEVANAGARI.value)
    amb = _share(dist, LanguageForm.SHARED_OR_AMBIGUOUS_LATIN.value)

    pattern = code_mix_pattern or CodeMixPattern.UNKNOWN.value
    response = ResponseLanguageKind.UNKNOWN
    mirror = False

    if pattern in {
        CodeMixPattern.THREE_WAY_MIX.value,
        CodeMixPattern.AMBIGUOUS.value,
    } or amb >= 0.45:
        response = ResponseLanguageKind.MIXED
        reasons.append("CODE_MIX_OR_AMBIGUOUS")
    elif pattern == CodeMixPattern.NEPALI_DEVANAGARI_ONLY.value or dev >= 0.55:
        response = ResponseLanguageKind.NEPALI_DEVANAGARI
        mirror = True
        reasons.append("DOMINANT_DEVANAGARI")
    elif pattern == CodeMixPattern.ROMANIZED_NEPALI_ONLY.value or rom >= 0.55:
        response = ResponseLanguageKind.ROMANIZED_NEPALI
        mirror = True
        reasons.append("DOMINANT_ROMANIZED")
    elif pattern == CodeMixPattern.ENGLISH_ONLY.value or en >= 0.55:
        response = ResponseLanguageKind.ENGLISH
        mirror = True
        reasons.append("DOMINANT_ENGLISH")
    elif pattern == CodeMixPattern.ENGLISH_ROMANIZED.value:
        # Prefer romanized for shop hybrid unless English clearly dominates.
        if en > rom:
            response = ResponseLanguageKind.ENGLISH
            reasons.append("ENGLISH_ROMANIZED_EN_WINS")
        else:
            response = ResponseLanguageKind.ROMANIZED_NEPALI
            reasons.append("ENGLISH_ROMANIZED_ROM_WINS")
        mirror = True
    elif pattern == CodeMixPattern.ENGLISH_DEVANAGARI.value:
        response = (
            ResponseLanguageKind.NEPALI_DEVANAGARI
            if dev >= en
            else ResponseLanguageKind.ENGLISH
        )
        mirror = True
        reasons.append("ENGLISH_DEVANAGARI_PICK")
    elif pattern == CodeMixPattern.DEVANAGARI_ROMANIZED.value:
        response = (
            ResponseLanguageKind.NEPALI_DEVANAGARI
            if dev >= rom
            else ResponseLanguageKind.ROMANIZED_NEPALI
        )
        mirror = True
        reasons.append("DEVANAGARI_ROMANIZED_PICK")
    else:
        response = _script_fallback_language(raw_text)
        if response != ResponseLanguageKind.UNKNOWN:
            mirror = response != ResponseLanguageKind.MIXED
            reasons.append("SCRIPT_FALLBACK")

    honorific = None
    m = _HONORIFIC.search(raw_text)
    if m:
        honorific = m.group(0)

    register = LinguisticRegisterKind.NEUTRAL
    if honorific:
        register = LinguisticRegisterKind.SHOP_INFORMAL
        reasons.append("HONORIFIC_CUE")
    elif _ACCOUNTING_FORMAL.search(raw_text) and (
        response == ResponseLanguageKind.ENGLISH or en >= 0.35
    ):
        register = LinguisticRegisterKind.ACCOUNTING_FORMAL
        reasons.append("ACCOUNTING_FORMAL_CUE")
    elif response in {
        ResponseLanguageKind.ROMANIZED_NEPALI,
        ResponseLanguageKind.NEPALI_DEVANAGARI,
    }:
        register = LinguisticRegisterKind.SHOP_INFORMAL
        reasons.append("SHOP_LANGUAGE_DEFAULT")
    elif response == ResponseLanguageKind.UNKNOWN:
        register = LinguisticRegisterKind.UNKNOWN

    return ResponseRegisterBundleV1(
        analysis_status=ResponseRegisterStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        offset_unit=OFFSET_UNIT,
        source_authority="RAW",
        response_language=response,
        linguistic_register=register,
        mirror_user_language=mirror,
        honorific_cue=honorific,
        reason_codes=tuple(reasons),
        silent_applications=0,
        applied_response_rewrite=False,
    )


def build_response_register_bundle(frame: LanguageFrameV1) -> ResponseRegisterBundleV1:
    return decide_response_register(
        raw_text=frame.raw_text,
        language_distribution=frame.language_distribution,
        code_mix_pattern=frame.code_mix_pattern,
    )


def attach_response_register_to_frame(frame: LanguageFrameV1) -> LanguageFrameV1:
    bundle = build_response_register_bundle(frame)
    versions = dict(frame.analyzer_versions or {})
    versions["response_register"] = RUNTIME_VERSION
    return frame.model_copy(
        update={
            "response_register_bundle": bundle,
            "dominant_response_language": bundle.response_language.value,
            "linguistic_register": bundle.linguistic_register.value,
            "analyzer_versions": versions,
        }
    )
