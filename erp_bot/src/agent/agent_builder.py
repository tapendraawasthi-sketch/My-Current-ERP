"""Build the runnable agent using the current langchain.agents API."""

from __future__ import annotations

from langchain.agents import create_agent
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import InMemorySaver

from ..config import MAX_AGENT_ITERATIONS, MODEL_NAME, OLLAMA_BASE_URL
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


def ask(question: str, session_id: str) -> dict:
    config = {
        "configurable": {"thread_id": session_id},
        "recursion_limit": MAX_AGENT_ITERATIONS,
    }
    try:
        result = _agent.invoke(
            {"messages": [{"role": "user", "content": question}]},
            config=config,
        )
    except Exception as e:
        return {"answer": f"Agent error: {e}", "sources": []}

    messages = result.get("messages", [])
    answer = messages[-1].content if messages else "No response generated."
    sources = set()
    for m in messages:
        content = getattr(m, "content", "")
        if isinstance(content, str) and "File:" in content:
            for line in content.splitlines():
                line = line.strip()
                if line.startswith("File:") or line.startswith("  File:"):
                    sources.add(line.split("File:", 1)[1].strip())
    return {"answer": answer, "sources": sorted(sources)}
