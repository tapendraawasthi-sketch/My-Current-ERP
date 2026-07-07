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
    fetch_webpage,
    find_navigation_path,
    find_references,
    get_project_conventions,
    list_directory,
    read_full_file,
    search_codebase,
    web_search,
)


# ── Post-generation answer trimmer ─────────────────────────────────────────────
# Enforces intent-specific output format as a safety net when the model rambles.

_PATH_LINE_PATTERN = re.compile(
    r"(Path:|Shortcut:|→|Menu|Transactions|Masters|Reports|Utilities|Company|F\d+)",
    re.IGNORECASE,
)
_DEFINITION_SENTENCE_PATTERN = re.compile(
    r"^[A-Z].*?(is used for|is a|is an|is the|records|allows|enables|lets you|"
    r"provides|helps|used to|feature for|way to)\b",
    re.IGNORECASE,
)
_NUMBERED_STEP_PATTERN = re.compile(r"^\s*\d+[.)]\s*")
_DEBIT_CREDIT_PATTERN = re.compile(r"\b(DEBIT|CREDIT|Dr\.?|Cr\.?)\b", re.IGNORECASE)


def _scope_answer(answer: str, intent: str) -> str:
    """Trim model output to match the intent, as a safety net.

    - action_path / nav: keep only lines containing navigation paths.
    - definition: keep at most the first 3 sentences.
    - steps: keep only numbered list lines.
    - effect: keep only lines with DEBIT/CREDIT/Dr/Cr.
    - code / troubleshoot / general: return unchanged.
    """
    if not answer or not answer.strip():
        return answer

    lines = answer.strip().split("\n")

    if intent in ("action_path", "nav"):
        # Keep only lines that look like navigation paths
        path_lines = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            # Keep lines with path indicators or menu keywords
            if _PATH_LINE_PATTERN.search(stripped):
                path_lines.append(stripped)
                continue
            # Also keep lines that look like "Feature → Sub → Page" format
            if "→" in stripped or ">" in stripped:
                path_lines.append(stripped)
                continue
        # Filter out definition-like sentences
        filtered = []
        for line in path_lines:
            # Skip lines that define the feature
            if _DEFINITION_SENTENCE_PATTERN.search(line):
                continue
            filtered.append(line)
        if filtered:
            return filtered[0]  # Return ONLY the first path line
        # Fallback: return first non-empty line if nothing path-like found
        for line in lines:
            if line.strip():
                return line.strip()
        return answer

    elif intent == "definition":
        raw_lines = [line.strip() for line in lines if line.strip()]
        title_line = next((l for l in raw_lines if l.startswith("**") and l.endswith("**")), None)
        body_lines = [
            l for l in raw_lines
            if l != title_line
            and not re.match(
                r"^\*\*(Open|Steps|Rules|Required|Accounting|Validation|Location|Menu path)",
                l,
                re.I,
            )
        ]
        text = " ".join(body_lines).replace("**", "")
        sentences = re.split(r"(?<=[.!?])\s+", text)
        body = " ".join(sentences[:3]).strip()
        if title_line and body:
            return f"{title_line}\n{body}"
        if title_line:
            return title_line
        return body or answer

    elif intent == "steps":
        # Keep only numbered list lines
        step_lines = [line for line in lines if _NUMBERED_STEP_PATTERN.match(line)]
        if step_lines:
            return "\n".join(step_lines)
        return answer

    elif intent == "effect":
        # Keep only lines containing DEBIT/CREDIT/Dr/Cr
        effect_lines = [
            line for line in lines
            if _DEBIT_CREDIT_PATTERN.search(line)
        ]
        if effect_lines:
            return "\n".join(effect_lines)
        return answer

    # code / troubleshoot / general — return unchanged
    return answer

_llm = ChatOllama(
    model=MODEL_NAME,
    base_url=OLLAMA_BASE_URL,
    temperature=0,
    num_ctx=2048,
    num_predict=400,
)
_tools = [
    find_navigation_path,
    search_codebase,
    read_full_file,
    list_directory,
    find_references,
    get_project_conventions,
    web_search,
    fetch_webpage,
]
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

    # Deterministic nav lookup — skip vector search when path is found in source
    if intent in _LIGHTWEIGHT_INTENTS:
        nav_result = find_navigation_path.invoke({"feature_name": question})
        if nav_result.startswith("Path:"):
            sources = set()
            for line in nav_result.splitlines():
                if line.startswith("File:"):
                    rel = line.split("File:", 1)[1].strip()
                    if (ERP_PATH / rel).exists():
                        sources.add(rel)
            sources.add("src/components/BusyMenuBar.tsx")
            fmt = (
                "RESPONSE FORMAT — INTENT: "
                + intent
                + "\nOutput EXACTLY the Path line below. Do NOT add explanation or steps.\n\n"
                + nav_result
            )
            enriched = f"INTENT: {intent}\n\n{fmt}\n\nQUESTION: {question}"
            return enriched, sources

    # For navigation/action_path intents without deterministic match: vector search
    if intent in _LIGHTWEIGHT_INTENTS:
        # Target the specific files and patterns that define navigation:
        # - App.tsx (switch(currentPage) route map)
        # - Sidebar.tsx (menuGroups)
        # - BusyMenuBar.tsx (MENU_TREE)
        # - RightButtonBar.tsx, PAGE_SHORTCUTS
        nav_query = (
            f"route case menu item page shortcut PAGE_SHORTCUTS Sidebar "
            f"App.tsx BusyMenuBar menuGroups MENU_TREE currentPage {question}"
        )
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
    intent = _classify_intent(question)

    # Short-circuit nav/action_path when deterministic resolver succeeds
    if intent in _LIGHTWEIGHT_INTENTS:
        nav_result = find_navigation_path.invoke({"feature_name": question})
        if nav_result.startswith("Path:"):
            answer_line = nav_result.splitlines()[0]
            sources: set[str] = {"src/components/BusyMenuBar.tsx"}
            for line in nav_result.splitlines():
                if line.startswith("File:"):
                    rel = line.split("File:", 1)[1].strip()
                    if (ERP_PATH / rel).exists():
                        sources.add(rel)
            return {
                "answer": _scope_answer(answer_line, intent),
                "sources": sorted(sources),
            }

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

    # Apply intent-specific answer scoping to enforce format discipline
    answer = _scope_answer(answer, intent)

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
