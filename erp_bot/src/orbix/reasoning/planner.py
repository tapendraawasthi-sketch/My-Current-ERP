"""Planner — turns a request + context into a short executable JSON plan."""

from __future__ import annotations

import json
from typing import Any

from ..llm.ollama_client import OllamaClient
from ..prompts import PLANNER_PROMPT
from ..schemas import OrbixChatRequest, Plan, PlanStep


def _fallback_plan(request: OrbixChatRequest) -> Plan:
    """Heuristic plan if the router LLM is unavailable — keeps the agent usable."""
    msg = request.message.lower()
    if any(w in msg for w in ("path", "where", "shortcut", "menu", "navigate", "kaha", "kata")):
        return Plan(
            intent="navigation",
            steps=[PlanStep(id="s1", goal="Resolve navigation path", tool="find_navigation_path", args={"feature": request.message})],
            stop_when="navigation path verified",
        )
    if any(w in msg for w in ("file", "renders", "component", "function", "code")):
        return Plan(
            intent="code",
            steps=[PlanStep(id="s1", goal="Search code", tool="search_codebase", args={"query": request.message})],
            stop_when="relevant code found",
        )
    if any(w in msg for w in ("udhaar", "udharo", "becheko", "tiryo", "diye", "payment", "discount", "kinya", "बेचे", "तिर्")):
        return Plan(
            intent="khata_entry",
            steps=[PlanStep(id="s1", goal="Parse and compute journal", tool="calculate_journal", args={})],
            stop_when="balanced journal proposed",
        )
    return Plan(intent="general", needs_tools=False, steps=[], stop_when="answered")


async def create_plan(
    llm: OllamaClient,
    request: OrbixChatRequest,
    tool_list: str,
    working_memory: dict[str, Any],
    recalled_memory: list[dict[str, Any]],
) -> Plan:
    context_parts = []
    if request.current_route:
        context_parts.append(f"Current screen: {request.screen_title or request.current_route}")
    if working_memory:
        context_parts.append(f"Working memory: {json.dumps(working_memory, default=str)[:600]}")
    if recalled_memory:
        mem = "; ".join(m.get("user_message", "") or m.get("summary", "") for m in recalled_memory[:3])
        context_parts.append(f"Recent episodes: {mem[:400]}")
    context = "\n".join(context_parts) or "(no prior context)"

    messages = [
        {"role": "system", "content": PLANNER_PROMPT.format(tool_list=tool_list)},
        {"role": "user", "content": f"Context:\n{context}\n\nUser request: {request.message}"},
    ]
    try:
        parsed = await llm.chat_json(messages, temperature=0.1)
    except Exception:
        parsed = None

    if not isinstance(parsed, dict):
        return _fallback_plan(request)

    try:
        steps = [
            PlanStep(
                id=str(s.get("id", f"s{i+1}")),
                goal=str(s.get("goal", "")),
                tool=s.get("tool"),
                args=s.get("args", {}) or {},
            )
            for i, s in enumerate(parsed.get("steps", []) or [])
        ]
        return Plan(
            intent=str(parsed.get("intent", "general")),
            needs_tools=bool(parsed.get("needs_tools", True)),
            steps=steps,
            stop_when=str(parsed.get("stop_when", "")),
        )
    except Exception:
        return _fallback_plan(request)
