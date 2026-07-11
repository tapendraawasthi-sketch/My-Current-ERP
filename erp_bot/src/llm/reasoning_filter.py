"""Strip Qwen3 / thinking-model reasoning from user-facing assistant text."""

from __future__ import annotations

import re

# Tagged thinking blocks (Qwen3, DeepSeek-R1, legacy variants).
_THINK_BLOCK_RE = re.compile(
    r"<(?:redacted_)?think(?:ing)?>.*?</(?:redacted_)?think(?:ing)?>",
    re.DOTALL | re.IGNORECASE,
)
_THINK_CLOSE_RE = re.compile(r"</(?:redacted_)?think(?:ing)?>", re.IGNORECASE)
_THINK_OPEN_RE = re.compile(r"<(?:redacted_)?think(?:ing)?>", re.IGNORECASE)

# Leading prose reasoning when models omit the opening tag.
_REASONING_STARTERS = (
    "okay, the user",
    "okay the user",
    "let me think",
    "the user asked",
    "the user wants",
    "the user is asking",
    "the user is asking about",
    "the user wants to know",
    "i need to think",
    "first, let me",
    "first let me",
    "alright, the user",
    "alright the user",
)


def _strip_orphan_think_tags(text: str) -> str:
    """Remove content before a lone closing tag or after a lone opening tag."""
    close = _THINK_CLOSE_RE.search(text)
    if close:
        text = text[close.end() :]

    open_ = _THINK_OPEN_RE.search(text)
    if open_:
        remainder = text[open_.end() :]
        close2 = _THINK_CLOSE_RE.search(remainder)
        if close2:
            text = remainder[close2.end() :]
        else:
            text = ""

    return text


def _strip_leading_reasoning_prose(text: str) -> str:
    """Drop paragraph(s) that read like internal scratchpad before the answer."""
    text = text.strip()
    changed = True
    while text and changed:
        changed = False
        lower = text.lower()
        if not any(lower.startswith(prefix) for prefix in _REASONING_STARTERS):
            break
        boundary = text.find("\n\n")
        if boundary == -1:
            break
        text = text[boundary + 2 :].strip()
        changed = True
    return text


def strip_reasoning(text: str) -> str:
    """Return only the final assistant answer — never chain-of-thought."""
    if not text:
        return ""

    cleaned = str(text)

    # Full tagged blocks.
    cleaned = _THINK_BLOCK_RE.sub("", cleaned)
    cleaned = re.sub(r"</?think>", "", cleaned, flags=re.IGNORECASE)

    # Orphan tags (e.g. prose + </think> with no opening tag).
    cleaned = _strip_orphan_think_tags(cleaned)

    # Bare leading reasoning paragraphs.
    cleaned = _strip_leading_reasoning_prose(cleaned)

    return cleaned.strip()


def append_no_think(prompt: str) -> str:
    """Append Qwen3 /no_think suffix when not already present."""
    if "/no_think" in prompt.lower():
        return prompt
    return f"{prompt} /no_think"
