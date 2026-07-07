"""
Agentic Loop — autonomous tool calling via Ollama native tools.
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

from ollama import Client

from ..bridges.dexie_bridge import set_active_session
from ..config import OLLAMA_BASE_URL, PRIMARY_MODEL, PRIMARY_MODEL_OPTIONS
from .tool_registry import ALL_TOOLS, TOOL_MAP

logger = logging.getLogger(__name__)

AGENT_SYSTEM_PROMPT = """You are e-Khata, Nepal's most intelligent accounting AI assistant.

You have access to real accounting tools. USE THEM when you need data:
- Before confirming an entry → check_duplicate_entry to prevent duplicates
- When user asks "kati baki cha?" → get_party_balance to get real numbers
- When entry involves TDS → calculate_tds to get exact amounts
- When entry involves VAT → calculate_vat to compute breakdown
- When user asks about profit/loss → get_profit_loss with real data
- When unsure about Nepal tax rules → search_accounting_knowledge

CRITICAL: NEVER fabricate numbers. If you need a balance or amount that you
don't have, CALL A TOOL to get it. Better to call a tool and give accurate
data than to guess and be wrong.

You respond in the same language the user uses. If they speak Nepali,
reply in Nepali. If English, reply in English. If mixed, reply mixed.

You are warm, professional, and patient."""

MAX_TOOL_ITERATIONS = 5


def _build_context_message(ctx: dict[str, Any]) -> str:
    parts: list[str] = []
    if ctx.get("company_name"):
        parts.append(f"Company: {ctx['company_name']}")
    if ctx.get("recent_parties"):
        parts.append(f"Recent parties: {', '.join(ctx['recent_parties'][-5:])}")
    if ctx.get("today_entry_count") is not None:
        parts.append(f"Entries posted today: {ctx['today_entry_count']}")
    if ctx.get("cash_balance") is not None:
        parts.append(f"Current cash balance: Rs {float(ctx['cash_balance']):,.2f}")
    if ctx.get("party_balances"):
        top = list(ctx["party_balances"].items())[:5]
        parts.append("Party balances: " + ", ".join(f"{p}=Rs {b:,.0f}" for p, b in top))
    return "Session context: " + " | ".join(parts) if parts else ""


def _extract_entry_from_response(content: str | None) -> dict[str, Any] | None:
    if not content:
        return None
    match = re.search(r"\{[\s\S]*\"intent\"[\s\S]*\}", content)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def _execute_tool(tc: Any) -> str:
    fn_name = tc.function.name
    fn_args = tc.function.arguments or {}
    if isinstance(fn_args, str):
        try:
            fn_args = json.loads(fn_args)
        except json.JSONDecodeError:
            fn_args = {}

    if fn_name not in TOOL_MAP:
        return json.dumps({"error": f"Unknown tool: {fn_name}"})

    try:
        return str(TOOL_MAP[fn_name](**fn_args))
    except Exception as exc:
        logger.warning("Tool %s failed: %s", fn_name, exc)
        return json.dumps({"error": str(exc)})


def agent_loop(
    messages: list[dict[str, str]],
    session_context: dict[str, Any] | None = None,
    session_id: str = "default",
    stream: bool = False,
) -> dict[str, Any]:
    """
    Run the agentic tool-calling loop (sync).

    Returns content, thinking, tool_calls_made, entry, latency_ms.
    """
    del stream  # streaming handled in api/streaming.py
    start = time.monotonic()
    set_active_session(session_id)

    full_messages: list[dict[str, Any]] = [{"role": "system", "content": AGENT_SYSTEM_PROMPT}]
    if session_context:
        ctx_msg = _build_context_message(session_context)
        if ctx_msg:
            full_messages.append({"role": "system", "content": ctx_msg})
    full_messages.extend(messages)

    client = Client(host=OLLAMA_BASE_URL)
    all_tool_calls: list[dict[str, Any]] = []
    response = None

    options = {
        "temperature": float(PRIMARY_MODEL_OPTIONS.get("temperature", 0.3)),
        "num_ctx": int(PRIMARY_MODEL_OPTIONS.get("num_ctx", 8192)),
        "top_p": float(PRIMARY_MODEL_OPTIONS.get("top_p", 0.9)),
    }

    for iteration in range(MAX_TOOL_ITERATIONS):
        response = client.chat(
            model=PRIMARY_MODEL,
            messages=full_messages,
            tools=ALL_TOOLS,
            options=options,
        )

        msg = response.message
        full_messages.append(msg.model_dump())

        tool_calls = msg.tool_calls or []
        if not tool_calls:
            break

        for tc in tool_calls:
            result = _execute_tool(tc)
            all_tool_calls.append(
                {
                    "tool": tc.function.name,
                    "args": tc.function.arguments,
                    "result": result[:500],
                    "iteration": iteration,
                }
            )
            full_messages.append(
                {
                    "role": "tool",
                    "content": result,
                }
            )

    elapsed_ms = int((time.monotonic() - start) * 1000)
    content = (response.message.content if response else "") or ""
    thinking = getattr(response.message, "thinking", None) if response else None

    return {
        "content": content,
        "thinking": thinking or "",
        "tool_calls_made": all_tool_calls,
        "entry": _extract_entry_from_response(content),
        "latency_ms": elapsed_ms,
    }
