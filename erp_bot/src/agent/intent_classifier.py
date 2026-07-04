from __future__ import annotations

import re

# ── intent labels ──────────────────────────────────────────────
# nav          → user wants WHERE to find / how to open / keyboard shortcut
# action_path  → user wants HOW TO MAKE/CREATE something (give path only)
# definition   → user wants WHAT something IS
# steps        → user wants step-by-step procedure only
# troubleshoot → user has an error or something is not working
# effect       → user wants the accounting debit/credit effect
# code         → developer question about source code / implementation
# general      → catch-all; answer concisely and only what is asked

_NAV_PATTERNS = re.compile(
    r"\b(where is|where do i|how (do i |to )?(open|access|find|go to|get to|navigate)|"
    r"shortcut for|keyboard shortcut|hotkey|press which|which key)\b",
    re.IGNORECASE,
)

_ACTION_PATH_PATTERNS = re.compile(
    r"\b(how (do i |to )(make|create|post|record|enter|add|pass|generate)|"
    r"steps to (make|create|post)|how (can i |do i )?(make|create))\b",
    re.IGNORECASE,
)

_DEFINITION_PATTERNS = re.compile(
    r"\b(what is|what are|explain|tell me about|describe|meaning of|"
    r"definition of|what does .+ (do|mean)|what('s| is) (a |an |the )?)\b",
    re.IGNORECASE,
)

_STEPS_PATTERNS = re.compile(
    r"\b(steps (for|to)|step by step|procedure (for|to)|process (for|of)|"
    r"guide me (through|on)|walk me through|how (exactly|specifically) (do|does))\b",
    re.IGNORECASE,
)

_TROUBLESHOOT_PATTERNS = re.compile(
    r"\b(error|not working|issue|problem|failed|can'?t|cannot|won'?t|"
    r"why (is|isn'?t|does|doesn'?t|can'?t|won'?t)|not (showing|posting|saving|"
    r"appearing|reflecting|working)|getting .+ error|throws?|exception)\b",
    re.IGNORECASE,
)

_EFFECT_PATTERNS = re.compile(
    r"\b(what (gets?|is) (debited|credited)|accounting (entry|effect)|"
    r"journal entry for|debit .+ credit|credit .+ debit|double entry for|"
    r"which account (gets?|is)|ledger effect|gl entry)\b",
    re.IGNORECASE,
)

_CODE_PATTERNS = re.compile(
    r"\b(code|function|component|hook|api (route|endpoint)|schema|"
    r"database|implementation|source (file|code)|where in (the )?code|"
    r"how is .+ (implemented|built|coded|stored)|developer|backend|frontend|"
    r"typescript|tsx?|sql query|table (schema|structure)|column)\b",
    re.IGNORECASE,
)


def classify(question: str) -> str:
    """Return the intent label for a user question. Order matters:
    more-specific patterns are checked before more-general ones."""
    q = question.strip()
    if _CODE_PATTERNS.search(q):
        return "code"
    if _TROUBLESHOOT_PATTERNS.search(q):
        return "troubleshoot"
    if _EFFECT_PATTERNS.search(q):
        return "effect"
    if _STEPS_PATTERNS.search(q):
        return "steps"
    if _ACTION_PATH_PATTERNS.search(q):
        return "action_path"
    if _NAV_PATTERNS.search(q):
        return "nav"
    if _DEFINITION_PATTERNS.search(q):
        return "definition"
    return "general"
