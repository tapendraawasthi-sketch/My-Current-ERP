"""Conversation orchestration helpers."""

from __future__ import annotations

import re


def detect_language(text: str) -> str:
    if re.search(r"[\u0900-\u097F]", text):
        return "nepali"
    if re.search(
        r"\b(ho|huncha|hunxa|bhayo|lai|le|ko|ma|cha|chha|garnu|bhannu|kati|ke\s*ho|kasari|udhaar|nagad|saman|malik|tapai)\b",
        text,
        re.I,
    ):
        return "nepali"
    if re.search(r"\b(the|what|how|when|where|is|are|was|were|please|entry|account)\b", text, re.I):
        return "english"
    return "mixed"


def needs_agent_tools(message: str) -> bool:
    t = message.lower()
    return bool(
        re.search(
            r"\b(kati\s+baki|balance|trial\s*balance|profit|loss|ledger|duplicate|"
            r"party\s+balance|cash\s+balance|report|summary|outstanding|receivable|"
            r"calculate\s+tds|calculate\s+vat|baki\s+cha)\b",
            t,
        )
    )


def is_complex_question(message: str) -> bool:
    t = message.lower()
    if len(message) > 150:
        return True
    return bool(
        re.search(
            r"\b(difference|compare|versus|vs\.|step\s*by\s*step|journal\s+entry\s+for|"
            r"multiple|compound|consolidat|reclassif|actuarial|percentage\s+of\s+completion|"
            r"adjusting\s+entry|accrual|defer|reversal|set\s*off|contra)\b",
            t,
        )
    )


def is_confirm_message(text: str) -> bool:
    lower = text.lower().strip()
    words = {
        "ho", "hau", "yes", "ok", "okay", "confirm", "thik", "sahi", "huncha", "lau", "gardiu",
        "milcha", "thik cha", "thikcha", "milchha", "gara", "gar", "entry hala", "post", "posted",
        "confirm gara", "thik ho", "sahi ho", "huncha ho",
    }
    if lower in words:
        return True
    return any(w in lower for w in words if len(w) > 2)


def is_cancel_message(text: str) -> bool:
    lower = text.lower().strip()
    cancel = {"hoina", "no", "cancel", "pardaina", "nah", "nope", "wrong", "galat", "radda", "na"}
    return lower in cancel or any(w in lower for w in ("cancel", "hoina", "galat", "wrong"))
