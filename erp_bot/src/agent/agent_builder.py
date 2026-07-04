"""Build the runnable agent using the current langchain.agents API."""

from __future__ import annotations

import re

from langchain.agents import create_agent
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import InMemorySaver

from ..config import ERP_PATH, MAX_AGENT_ITERATIONS, MODEL_NAME, OLLAMA_BASE_URL
from .system_prompt import SYSTEM_PROMPT
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


def _extract_sources(text: str) -> set[str]:
    sources: set[str] = set()
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("File:"):
            sources.add(line.split("File:", 1)[1].strip())
    return sources


def _build_enriched_question(question: str) -> tuple[str, set[str]]:
    search_out = search_codebase.invoke({"query": question})
    sources = _extract_sources(search_out)

    extra = ""
    q_lower = question.lower()
    if any(k in q_lower for k in _CONVENTION_KEYWORDS):
        extra = "\n\nPROJECT CONVENTIONS:\n" + get_project_conventions.invoke({})

    no_results = "No relevant code found" in search_out
    honesty = ""
    if no_results:
        honesty = (
            "\n\nIMPORTANT: The pre-fetched search found NO matching code. "
            "You MUST answer: \"I searched the codebase and could not find code "
            f'related to {question.strip()}. It may not be implemented yet." '
            "Do NOT invent any file paths or functions."
        )

    enriched = (
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
