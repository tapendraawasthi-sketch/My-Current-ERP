"""3-layer memory for e-Khata conversations."""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from ollama import Client

from ..config import BOT_ROOT, FAST_MODEL, OLLAMA_BASE_URL

logger = logging.getLogger(__name__)

_MEMORY_DIR = BOT_ROOT / "data" / "memory"


class LayeredMemory:
    """
    Layer 1 — working memory (last 10 messages)
    Layer 2 — session summary (compressed every 10 messages)
    Layer 3 — long-term memory (persisted JSON per session)
    """

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.working: list[dict[str, Any]] = []
        self.session_summary: str = ""
        self.long_term: dict[str, Any] = {}
        self.pending_slots: dict[str, Any] = {}
        self.message_count: int = 0
        self._client = Client(host=OLLAMA_BASE_URL)
        self._load_long_term()

    def add_message(self, role: str, content: str, metadata: dict[str, Any] | None = None) -> None:
        self.working.append(
            {
                "role": role,
                "content": content,
                "metadata": metadata or {},
                "index": self.message_count,
            }
        )
        self.message_count += 1

        if len(self.working) > 10:
            self.working.pop(0)

        if self.message_count % 10 == 0:
            self._update_session_summary()

        self._extract_long_term(role, content, metadata)

    def get_context_for_llm(self) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = []

        if self.long_term:
            lt = self._format_long_term()
            if lt:
                messages.append(
                    {
                        "role": "system",
                        "content": f"Long-term knowledge about this user/business:\n{lt}",
                    }
                )

        if self.session_summary:
            messages.append(
                {
                    "role": "system",
                    "content": f"Session so far ({self.message_count} messages):\n{self.session_summary}",
                }
            )

        if self.pending_slots:
            slot_text = ", ".join(f"{k}={v}" for k, v in self.pending_slots.items())
            messages.append(
                {
                    "role": "system",
                    "content": f"Pending slots from clarification: {slot_text}",
                }
            )

        for msg in self.working:
            messages.append({"role": msg["role"], "content": msg["content"]})

        return messages

    def set_pending_slots(self, slots: dict[str, Any]) -> None:
        self.pending_slots = dict(slots)

    def clear_pending_slots(self) -> None:
        self.pending_slots = {}

    def _update_session_summary(self) -> None:
        all_content = "\n".join(f"{m['role']}: {m['content'][:120]}" for m in self.working)
        prompt = f"""Summarize this accounting chat in 3-5 bullet points.
Focus on: parties, entries, balances, pending items, language preference.

Messages:
{all_content}

Previous summary: {self.session_summary or 'First summary'}"""

        try:
            response = self._client.chat(
                model=FAST_MODEL,
                messages=[{"role": "user", "content": prompt}],
                options={"temperature": 0, "num_ctx": 2048},
            )
            self.session_summary = (response.message.content or "").strip()
        except Exception as exc:
            logger.warning("Session summary failed: %s", exc)

    def _extract_long_term(
        self,
        role: str,
        content: str,
        metadata: dict[str, Any] | None,
    ) -> None:
        if metadata and metadata.get("entry_posted"):
            entry = metadata["entry_posted"]
            party = entry.get("party")
            if party:
                parties = self.long_term.setdefault("parties", {})
                if party not in parties:
                    parties[party] = {
                        "first_seen": datetime.now().isoformat(),
                        "entry_count": 0,
                        "total_amount": 0,
                        "common_intents": [],
                    }
                p = parties[party]
                p["entry_count"] += 1
                p["total_amount"] += float(entry.get("amount", 0))
                p["common_intents"].append(entry.get("intent"))
                p["last_seen"] = datetime.now().isoformat()

        if role == "user":
            if len(re.findall(r"[\u0900-\u097F]", content)) > 5:
                self.long_term["language_preference"] = "devanagari"
            elif re.search(r"\b(lai|le|bata|ko|ma|ho|cha)\b", content, re.I):
                self.long_term["language_preference"] = "romanized_nepali"
            else:
                self.long_term.setdefault("language_preference", "english")

    def _format_long_term(self) -> str:
        parts: list[str] = []
        if self.long_term.get("language_preference"):
            parts.append(f"Language: {self.long_term['language_preference']}")
        parties = self.long_term.get("parties") or {}
        for name, data in list(parties.items())[:5]:
            parts.append(
                f"{name}: {data.get('entry_count', 0)} entries, "
                f"total Rs {data.get('total_amount', 0):,.0f}"
            )
        return "\n".join(parts)

    def _load_long_term(self) -> None:
        path = _MEMORY_DIR / f"{self.session_id}.json"
        if path.exists():
            try:
                self.long_term = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                self.long_term = {}

    def save_long_term(self) -> None:
        _MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        path = _MEMORY_DIR / f"{self.session_id}.json"
        path.write_text(json.dumps(self.long_term, indent=2, default=str), encoding="utf-8")


_memory_cache: dict[str, LayeredMemory] = {}


def get_layered_memory(session_id: str) -> LayeredMemory:
    if session_id not in _memory_cache:
        _memory_cache[session_id] = LayeredMemory(session_id)
    return _memory_cache[session_id]
