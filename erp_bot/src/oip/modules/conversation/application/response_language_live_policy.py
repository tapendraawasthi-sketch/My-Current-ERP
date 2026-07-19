"""NEXT-08 / ADR_0082 — response language live parity for launch scaffolds.

Stable useful EN / Devanagari / Romanized scaffolding — not literary Nepali,
not SSE rewrite, not sole NLU.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

AUTHORITY = "ADR_0082"
STEP = "NEXT-08"
DECISION = "RESPONSE_LANGUAGE_LIVE_PARITY"
APPLIED_RESPONSE_REWRITE = False

_DEVANAGARI = re.compile(r"[\u0900-\u097F]")

# Scaffold catalogs — useful shop parity, not literary translation.
_SCAFFOLD: dict[str, dict[str, str]] = {
    "unsupported_launch": {
        "ENGLISH": (
            "That action is not in the current AI launch set. "
            "For the first public slice I can help with sales or purchase invoice "
            "drafts (Accountant Mode) and company reports: balance sheet, profit & loss, "
            "trial balance, or account ledger (Ask Mode). "
            "Please rephrase to one of those, or use the ERP screens for other actions."
        ),
        "ROMANIZED_NEPALI": (
            "Yo action ahile AI launch set ma chaina. "
            "Pahilo public slice ma ma sales/purchase invoice draft (Accountant Mode) "
            "ra company report: balance sheet, profit & loss, trial balance, "
            "athawa account ledger (Ask Mode) ma madat garna sakchu. "
            "Please tyo madhye euta bhana, athawa ERP screen use garnuhos."
        ),
        "NEPALI_DEVANAGARI": (
            "यो कार्य अहिले AI लन्च सेटमा छैन। "
            "पहिलो सार्वजनिक स्लाइसमा म बिक्री/खरिद इनभ्वाइस ड्राफ्ट (Accountant Mode) "
            "र कम्पनी रिपोर्ट: balance sheet, profit & loss, trial balance, "
            "वा account ledger (Ask Mode) मा मद्दत गर्न सक्छु। "
            "कृपया ती मध्ये एक भन्नुहोस्, वा ERP स्क्रिन प्रयोग गर्नुहोस्।"
        ),
        "MIXED": (
            "Yo action AI launch set ma chaina / यो कार्य लन्च सेटमा छैन। "
            "Sales/purchase draft (Accountant) or company reports (Ask) try garnuhos."
        ),
    },
    "clarify_missing": {
        "ENGLISH": "Please provide the missing details to continue.",
        "ROMANIZED_NEPALI": "Missing details dinuhos — continue garna chahinchha.",
        "NEPALI_DEVANAGARI": "जारी राख्न नपुगेको विवरण दिनुहोस्।",
        "MIXED": "Missing details dinuhos / नपुगेको विवरण दिनुहोस्।",
    },
    "ask_mode_mutation": {
        "ENGLISH": (
            "I can explain or preview in Ask Mode, "
            "but posting or creating ERP records requires Accountant Mode.\n\n"
            "Switch to Accountant Mode to create or modify authorized ERP records."
        ),
        "ROMANIZED_NEPALI": (
            "Ask Mode ma ma explain/preview garna sakchu, "
            "tara post garna Accountant Mode chahinchha.\n\n"
            "ERP record create/modify garna Accountant Mode ma switch garnuhos."
        ),
        "NEPALI_DEVANAGARI": (
            "Ask Mode मा म व्याख्या/प्रिभ्यू गर्न सक्छु, "
            "तर पोस्ट गर्न Accountant Mode चाहिन्छ।\n\n"
            "ERP रेकर्ड बनाउन/परिवर्तन गर्न Accountant Mode मा जानुहोस्।"
        ),
        "MIXED": (
            "Ask Mode ma explain/preview OK — post garna Accountant Mode chahinchha / "
            "पोस्ट गर्न Accountant Mode चाहिन्छ।"
        ),
    },
    "confirm_preview_label": {
        "ENGLISH": "Confirm preview",
        "ROMANIZED_NEPALI": "Confirm preview — check garera post garnuhos",
        "NEPALI_DEVANAGARI": "पुष्टि प्रिभ्यू",
        "MIXED": "Confirm preview / पुष्टि प्रिभ्यू",
    },
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[6]


def registry_path() -> Path:
    return (
        _repo_root() / "docs" / "mokxya-ai" / "MAI_RESPONSE_LANGUAGE_REGISTRY.json"
    )


@lru_cache(maxsize=1)
def load_response_language_registry() -> dict[str, Any]:
    path = registry_path()
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("authority") != AUTHORITY:
        raise RuntimeError("RESPONSE_LANGUAGE_REGISTRY_AUTHORITY_MISMATCH")
    if data.get("decision") != DECISION:
        raise RuntimeError("RESPONSE_LANGUAGE_DECISION_MISMATCH")
    return data


def normalize_response_language(value: str | None) -> str:
    key = str(value or "ENGLISH").strip().upper()
    if key in {"NEPALI_DEVANAGARI", "ROMANIZED_NEPALI", "ENGLISH", "MIXED"}:
        return key
    if key in {"UNKNOWN", ""}:
        return "ENGLISH"
    return "ENGLISH"


def infer_response_language(raw_text: str | None) -> str:
    """Lightweight form inference for scaffolds (does not rewrite model output)."""
    text = raw_text or ""
    if not text.strip():
        return "ENGLISH"
    try:
        from oip.modules.language_runtime.response_register.application.response_register_service import (
            decide_response_register,
        )

        bundle = decide_response_register(raw_text=text)
        lang = normalize_response_language(bundle.response_language.value)
        if lang != "ENGLISH" or lang == "MIXED":
            return lang
        # decide may return ENGLISH for romanized shop Latin — script fallback
    except Exception:  # noqa: BLE001
        pass
    chars = [c for c in text if not c.isspace()]
    if not chars:
        return "ENGLISH"
    deva = sum(1 for c in chars if _DEVANAGARI.match(c))
    ratio = deva / len(chars)
    if ratio >= 0.40:
        return "NEPALI_DEVANAGARI"
    if 0.05 < ratio < 0.40:
        return "MIXED"
    # Latin shop cues → romanized default for launch scaffolds
    if re.search(
        r"(?i)\b(kineko|becheko|kinyo|bikri|dekhaunu|garnuhos|chahinchha|tapai)\b",
        text,
    ):
        return "ROMANIZED_NEPALI"
    if re.search(r"[A-Za-z]", text) and not re.search(
        r"(?i)\b(the|please|show|what|sold|bought|invoice)\b", text
    ):
        return "ROMANIZED_NEPALI"
    return "ENGLISH"


def scaffold_string(
    key: str,
    response_language: str | None = None,
    *,
    raw_text: str | None = None,
) -> str:
    lang = normalize_response_language(
        response_language or infer_response_language(raw_text)
    )
    catalog = _SCAFFOLD.get(key) or _SCAFFOLD["clarify_missing"]
    return catalog.get(lang) or catalog["ENGLISH"]


def is_accidental_english_only(text: str, response_language: str) -> bool:
    """True when NP/Roman expected but scaffold is pure English catalog."""
    lang = normalize_response_language(response_language)
    if lang in {"ENGLISH", "UNKNOWN"}:
        return False
    en = _SCAFFOLD["unsupported_launch"]["ENGLISH"]
    # Exact English catalog hit for non-English target is accidental.
    if text.strip() == en.strip():
        return True
    if lang == "NEPALI_DEVANAGARI" and not _DEVANAGARI.search(text):
        return True
    if lang == "ROMANIZED_NEPALI" and text.strip() == en.strip():
        return True
    return False


def response_language_observability() -> dict[str, Any]:
    reg = load_response_language_registry()
    return {
        "response_language_step": STEP,
        "response_language_adr": AUTHORITY,
        "response_language_decision": reg["decision"],
        "applied_response_rewrite": False,
        "sole_nlu": False,
        "literary_nepali_claimed": False,
        "production_approved": False,
        "is_execution_authority": False,
        "scaffold_keys": sorted(_SCAFFOLD.keys()),
    }


def assert_response_language_honesty(claim: Mapping[str, Any] | None = None) -> None:
    reg = load_response_language_registry()
    honesty = reg.get("honesty") or {}
    if honesty.get("production_approved") is True:
        raise RuntimeError("RESPONSE_LANGUAGE_PRODUCTION_APPROVED")
    if honesty.get("applied_response_rewrite") is True:
        raise RuntimeError("RESPONSE_LANGUAGE_REWRITE_CLAIMED")
    if honesty.get("sole_nlu") is True:
        raise RuntimeError("RESPONSE_LANGUAGE_SOLE_NLU")
    if honesty.get("literary_nepali_claimed") is True:
        raise RuntimeError("RESPONSE_LANGUAGE_LITERARY_NEPALI")
    if honesty.get("is_execution_authority") is True:
        raise RuntimeError("RESPONSE_LANGUAGE_EXECUTION_AUTHORITY")
    if not claim:
        return
    if claim.get("production_approved") is True:
        raise RuntimeError("RESPONSE_LANGUAGE_PRODUCTION_APPROVED")
    if claim.get("applied_response_rewrite") is True:
        raise RuntimeError("RESPONSE_LANGUAGE_REWRITE_CLAIMED")
    if claim.get("sole_nlu") is True:
        raise RuntimeError("RESPONSE_LANGUAGE_SOLE_NLU")
