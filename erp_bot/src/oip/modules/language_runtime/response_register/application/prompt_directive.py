"""MAI-11 slice 2 — format response-register policy into a system-prompt directive.

Guides the model; does not rewrite SSE/model output text.
"""

from __future__ import annotations

from typing import Any, Mapping

from .....contracts.response_register import ResponseRegisterBundleV1

_LANGUAGE_INSTRUCTIONS: dict[str, str] = {
    "NEPALI_DEVANAGARI": (
        "Write the user-facing reply primarily in Nepali Devanagari script."
    ),
    "ROMANIZED_NEPALI": (
        "Write the user-facing reply primarily in Romanized Nepali (Latin script), "
        "matching shop typing style."
    ),
    "ENGLISH": (
        "Write the user-facing reply primarily in clear English."
    ),
    "MIXED": (
        "Match the user's mix of scripts; do not force a single script rewrite."
    ),
    "UNKNOWN": (
        "Match the language/script of the user's latest message as closely as possible."
    ),
}

_REGISTER_INSTRUCTIONS: dict[str, str] = {
    "SHOP_INFORMAL": (
        "Use a shop-friendly informal register; keep numbers and accounting facts precise."
    ),
    "ACCOUNTING_FORMAL": (
        "Use a professional accounting register; prefer precise ledger/tax terminology."
    ),
    "NEUTRAL": ("Use a clear, concise neutral register."),
    "UNKNOWN": ("Use a clear, concise register appropriate to the user's tone."),
}


def bundle_to_metadata(bundle: ResponseRegisterBundleV1) -> dict[str, Any]:
    return {
        "response_language": bundle.response_language.value,
        "linguistic_register": bundle.linguistic_register.value,
        "mirror_user_language": bool(bundle.mirror_user_language),
        "honorific_cue": bundle.honorific_cue,
        "runtime_version": bundle.runtime_version,
        "reason_codes": list(bundle.reason_codes),
        "applied_response_rewrite": False,
    }


def format_response_register_directive(
    policy: Mapping[str, Any] | ResponseRegisterBundleV1 | None,
) -> str:
    """Return a system-prompt block, or empty string when policy is absent/unknown."""
    if policy is None:
        return ""
    if isinstance(policy, ResponseRegisterBundleV1):
        data = bundle_to_metadata(policy)
    else:
        data = dict(policy)

    lang = str(data.get("response_language") or "UNKNOWN")
    register = str(data.get("linguistic_register") or "UNKNOWN")
    if lang == "UNKNOWN" and register == "UNKNOWN":
        return ""

    mirror = bool(data.get("mirror_user_language"))
    honorific = data.get("honorific_cue")
    lines = [
        "=== RESPONSE LANGUAGE / REGISTER POLICY (MAI-11) ===",
        f"Reply language/script: {lang}",
        f"Register: {register}",
        f"Mirror user language: {'yes' if mirror else 'no'}",
    ]
    if honorific:
        lines.append(f"Honorific cue observed: {honorific}")
    lines.append("Instructions:")
    lines.append(f"- {_LANGUAGE_INSTRUCTIONS.get(lang, _LANGUAGE_INSTRUCTIONS['UNKNOWN'])}")
    lines.append(
        f"- {_REGISTER_INSTRUCTIONS.get(register, _REGISTER_INSTRUCTIONS['UNKNOWN'])}"
    )
    lines.append(
        "- Do not invent accounting facts. Do not rewrite the user's raw message."
    )
    lines.append("=== END RESPONSE LANGUAGE / REGISTER POLICY ===")
    return "\n".join(lines)


def append_response_register_to_system_prompt(
    base_prompt: str,
    policy: Mapping[str, Any] | ResponseRegisterBundleV1 | None,
) -> str:
    base = (base_prompt or "").rstrip()
    block = format_response_register_directive(policy).strip()
    if not block:
        return base
    return f"{base}\n\n{block}"
