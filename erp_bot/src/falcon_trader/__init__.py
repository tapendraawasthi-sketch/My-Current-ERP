from __future__ import annotations

from .disambiguation import CLARIFYING_QUESTION, needs_party_role_clarification
from .entity_extractor import extract_entities
from .intent_classifier import classify
from .normalizer import normalize


def parse_khata_message(text: str) -> dict[str, object]:
    if needs_party_role_clarification(text):
        return {
            "intent": None,
            "clarifying_question": CLARIFYING_QUESTION,
            "PARTY_ROLE": "UNKNOWN",
            "normalized_text": normalize(text),
        }

    intent = classify(text)
    entities = extract_entities(text, intent)

    return {
        "intent": intent,
        "clarifying_question": None,
        "PARTY_ROLE": "KNOWN" if entities.get("PARTY") not in (None, "UNKNOWN") else "UNKNOWN",
        "normalized_text": normalize(text),
        **entities,
    }


__all__ = [
    "CLARIFYING_QUESTION",
    "classify",
    "extract_entities",
    "needs_party_role_clarification",
    "normalize",
    "parse_khata_message",
]
