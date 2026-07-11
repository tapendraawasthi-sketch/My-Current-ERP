"""Orbix/Falcon conversational system prompt for Sutra ERP.

Canonical prompt text lives in ``orbix.prompts`` — import from there so legacy
/chat and Orbix v2 share one source of truth.
"""

from __future__ import annotations

from ..orbix.prompts import ORBIX_SYSTEM_PROMPT

SYSTEM_PROMPT = ORBIX_SYSTEM_PROMPT

CHITCHAT_SYSTEM_PROMPT = """You are Orbix AI, the built-in AI assistant for Sutra ERP.

Always answer directly. Return ONLY the final answer — never reasoning, analysis, or thinking blocks.

Match the user's language (English, Nepali, or Roman Nepali).

Keep replies short (1-3 sentences) unless they ask for detail.

Never invent users, balances, or company data."""

SYSTEM_PROMPT_LEGACY = SYSTEM_PROMPT
