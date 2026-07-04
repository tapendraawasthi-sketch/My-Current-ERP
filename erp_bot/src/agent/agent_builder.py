"""Build the runnable agent using the current langchain.agents API."""

from __future__ import annotations

import re

from langchain.agents import create_agent
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import InMemorySaver

from ..config import ERP_PATH, MAX_AGENT_ITERATIONS, MODEL_NAME, OLLAMA_BASE_URL
from .system_prompt import SYSTEM_PROMPT
from .intent_classifier import classify as _classify_intent
from .tools import (
    find_references,
    get_project_conventions,
    list_directory,
    read_full_file,
    search_codebase,
)

_llm = ChatOllama(model=MODEL_NAME, base_url=OLLAMA_BASE_URL, temperature=0, num_ctx=8192)
_tools = [search_codebase, read_full_file, list_directory, find_references, get_project_conventions]
_checkpointer = InMemorySaver()
_agent = create_agent(
    model=_llm,
    tools=_tools,
    system_prompt=SYSTEM_PROMPT,
    checkpointer=_checkpointer,
)

_CONVENTION_KEYWORDS = (
    "architecture", "convention", "dead", "unused", "agents.md", "gemini",
    "rule", "immutab", "stockitems", "route", "owns", "design",
)

# Intents for which we skip the heavy pre-fetch and just pass
# a lightweight navigation search instead.
_LIGHTWEIGHT_INTENTS = frozenset({"nav", "action_path"})

# Intents for which code conventions are always relevant.
_CONVENTION_INTENTS = frozenset({"code"})


def _extract_sources(text: str) -> set[str]:
    sources: set[str] = set()
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("File:"):
            sources.add(line.split("File:", 1)[1].strip())
    return sources


def _build_enriched_question(question: str) -> tuple[str, set[str]]:
    intent = _classify_intent(question)

    # For navigation/action_path intents: search for route/menu/shortcut
    # patterns only — no need for deep code chunks.
    if intent in _LIGHTWEIGHT_INTENTS:
        nav_query = f"menu route navigation shortcut {question}"
        search_out = search_codebase.invoke({"query": nav_query})
    else:
        search_out = search_codebase.invoke({"query": question})

    sources = _extract_sources(search_out)

    # Append project conventions only for code / architecture intents.
    extra = ""
    q_lower = question.lower()
    if intent in _CONVENTION_INTENTS or any(k in q_lower for k in _CONVENTION_KEYWORDS):
        extra = "\n\nPROJECT CONVENTIONS:\n" + get_project_conventions.invoke({})

    no_results = "No relevant code found" in search_out
    honesty = ""
    if no_results:
        honesty = (
            "\n\nIMPORTANT: The pre-fetched search found NO matching code. "
            "You MUST answer: \"I searched the codebase and could not find "
            f'information about {question.strip()}. It may not be implemented yet." '
            "Do NOT invent any file paths or functions."
        )

    # Intent-specific response instruction injected into the prompt so
    # the LLM knows exactly what format to produce.
    intent_instructions = {
        "nav": (
            "RESPONSE FORMAT — INTENT: nav\n"
            "Output ONE line only: Path + shortcut. Zero explanation."
        ),
        "action_path": (
            "RESPONSE FORMAT — INTENT: action_path\n"
            "Output the navigation path and keyboard shortcut ONLY.\n"
            "Do NOT explain what the feature is. Do NOT list steps."
        ),
        "definition": (
            "RESPONSE FORMAT — INTENT: definition\n"
            "Output 2–3 sentences of plain-English explanation only.\n"
            "No navigation path. No steps."
        ),
        "steps": (
            "RESPONSE FORMAT — INTENT: steps\n"
            "Output a numbered step list only. No preamble. No definition."
        ),
        "troubleshoot": (
            "RESPONSE FORMAT — INTENT: troubleshoot\n"
            "Output: root cause (1 sentence) + fix (1–3 sentences). Nothing else."
        ),
        "effect": (
            "RESPONSE FORMAT — INTENT: effect\n"
            "Output the DEBIT/CREDIT accounting entry only.\n"
            "One sentence of context if the entry is non-obvious."
        ),
        "code": (
            "RESPONSE FORMAT — INTENT: code\n"
            "Use the full developer format: Summary / Files Involved / "
            "Key Functions / Code Evidence / Notes."
        ),
        "general": (
            "RESPONSE FORMAT — INTENT: general\n"
            "Answer concisely. Provide only what was asked. No padding."
        ),
    }
    fmt_instruction = intent_instructions.get(intent, intent_instructions["general"])

    enriched = (
        f"INTENT: {intent}\n\n"
        f"{fmt_instruction}\n\n"
        f"QUESTION: {question}\n\n"
        "PRE-FETCHED CODEBASE SEARCH (ground your answer ONLY in this and tool results):\n"
        f"{search_out}"
        f"{extra}"
        f"{honesty}\n\n"
        "Use read_full_file or find_references only to trace paths already listed above. "
        "Never cite a file path unless you read it via search or a tool this turn."
    )
    return enriched, sources


def ask(question: str, session_id: str) -> dict:
    enriched, prefetched_sources = _build_enriched_question(question)
    config = {
        "configurable": {"thread_id": session_id},
        "recursion_limit": MAX_AGENT_ITERATIONS,
    }
    try:
        result = _agent.invoke(
            {"messages": [{"role": "user", "content": enriched}]},
            config=config,
        )
    except Exception as e:
        return {"answer": f"Agent error: {e}", "sources": sorted(prefetched_sources)}

    messages = result.get("messages", [])
    answer = messages[-1].content if messages else "No response generated."

    sources = set(prefetched_sources)
    for m in messages:
        content = getattr(m, "content", "")
        if isinstance(content, str):
            sources.update(_extract_sources(content))

    # Keep only sources that exist in the repo
    verified = set()
    for src in sources:
        if (ERP_PATH / src).exists():
            verified.add(src)

    return {"answer": answer, "sources": sorted(verified)}
