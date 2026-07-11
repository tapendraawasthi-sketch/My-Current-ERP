"""Conversational agent builder for Orbix/Falcon.

This module creates a warm, natural agent using Qwen3 that:
- Maintains multi-turn conversation history
- Uses tools to ground answers in real code/data
- Responds in the user's language (EN/Devanagari/Romanized Nepali)
- Streams responses token-by-token for responsive UX
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import AsyncIterator, Sequence

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from ..config import (
    CONVERSATIONAL_MODEL,
    CONVERSATIONAL_MODEL_OPTIONS,
    FAST_MODEL,
    FAST_MODEL_OPTIONS,
    MAX_AGENT_ITERATIONS,
    MAX_CONVERSATION_TURNS,
    OLLAMA_BASE_URL,
    OLLAMA_KEEP_ALIVE,
)
from ..llm.reasoning_filter import append_no_think, strip_reasoning
from .system_prompt import CHITCHAT_SYSTEM_PROMPT, SYSTEM_PROMPT
from .unified_tools import UNIFIED_TOOLS as TOOLS

logger = logging.getLogger(__name__)


def _build_conversational_llm(*, reasoning: bool = False) -> ChatOllama:
    """Create the primary conversational LLM with warm settings."""
    return ChatOllama(
        model=CONVERSATIONAL_MODEL,
        base_url=OLLAMA_BASE_URL,
        temperature=CONVERSATIONAL_MODEL_OPTIONS["temperature"],
        num_ctx=int(CONVERSATIONAL_MODEL_OPTIONS["num_ctx"]),
        top_p=CONVERSATIONAL_MODEL_OPTIONS.get("top_p", 0.9),
        repeat_penalty=CONVERSATIONAL_MODEL_OPTIONS.get("repeat_penalty", 1.1),
        reasoning=reasoning,
        keep_alive=OLLAMA_KEEP_ALIVE,
    )


def _build_fast_llm() -> ChatOllama:
    """Create the fast LLM for simple responses (chitchat, erp_howto)."""
    return ChatOllama(
        model=FAST_MODEL,
        base_url=OLLAMA_BASE_URL,
        temperature=FAST_MODEL_OPTIONS["temperature"],
        num_ctx=int(FAST_MODEL_OPTIONS["num_ctx"]),
        reasoning=False,
        keep_alive=OLLAMA_KEEP_ALIVE,
    )


# Pre-instantiate LLMs at module load
_conversational_llm: ChatOllama | None = None
_fast_llm: ChatOllama | None = None


def get_conversational_llm() -> ChatOllama:
    """Get or create the conversational LLM singleton."""
    global _conversational_llm
    if _conversational_llm is None:
        _conversational_llm = _build_conversational_llm()
    return _conversational_llm


def get_fast_llm() -> ChatOllama:
    """Get or create the fast LLM singleton."""
    global _fast_llm
    if _fast_llm is None:
        _fast_llm = _build_fast_llm()
    return _fast_llm


def _trim_thinking_tags(text: str) -> str:
    """Remove Qwen3 reasoning blocks from a completed response."""
    return strip_reasoning(text)


_THINK_OPEN_TAGS = ("<think>", "<" + "think>")
_THINK_CLOSE_TAGS = ("</think>", "</" + "think>")
_TAG_KEEP_TAIL = 22  # longest partial open tag we might buffer


def _find_earliest_marker(buffer: str, markers: tuple[str, ...]) -> tuple[int, str] | None:
    """Return (index, marker) of the earliest marker in buffer (case-insensitive)."""
    lower = buffer.lower()
    best: tuple[int, str] | None = None
    for marker in markers:
        idx = lower.find(marker.lower())
        if idx >= 0 and (best is None or idx < best[0]):
            best = (idx, marker)
    return best


async def _stream_filtered_llm(
    messages: list[BaseMessage],
    llm: ChatOllama,
) -> AsyncIterator[str]:
    """Stream LLM output, stripping Qwen3 thinking blocks before yielding."""
    buffer = ""
    in_think_block = False

    async for chunk in llm.astream(messages):
        content = chunk.content if hasattr(chunk, "content") else ""
        extra = getattr(chunk, "additional_kwargs", None) or {}
        # When reasoning=True, thinking tokens arrive separately — never show them
        if not content and extra.get("reasoning_content"):
            continue
        if not content:
            continue
        buffer += content

        while buffer:
            if not in_think_block:
                hit = _find_earliest_marker(buffer, _THINK_OPEN_TAGS)
                if hit:
                    start, marker = hit
                    if start > 0:
                        yield buffer[:start]
                    buffer = buffer[start + len(marker) :]
                    in_think_block = True
                    continue

                if len(buffer) > _TAG_KEEP_TAIL:
                    yield buffer[:-_TAG_KEEP_TAIL]
                    buffer = buffer[-_TAG_KEEP_TAIL:]
                break

            hit = _find_earliest_marker(buffer, _THINK_CLOSE_TAGS)
            if hit:
                end, marker = hit
                buffer = buffer[end + len(marker) :]
                in_think_block = False
                continue
            break

    if buffer and not in_think_block:
        cleaned = _trim_thinking_tags(buffer)
        if cleaned:
            yield cleaned


def _with_no_think(prompt: str) -> str:
    """Append Qwen3 no-thinking suffix for faster generation."""
    return append_no_think(prompt)


def _format_conversation_history(
    history: list[dict[str, str]],
    max_turns: int = MAX_CONVERSATION_TURNS,
) -> list[BaseMessage]:
    """Convert conversation history dicts to LangChain messages.
    
    History format: [{"role": "user"/"assistant", "content": "..."}, ...]
    
    We keep the most recent `max_turns` exchanges to fit in context.
    Each exchange is one user + one assistant message.
    """
    if not history:
        return []
    
    # Keep last N*2 messages (N turns = N user + N assistant)
    trimmed = history[-(max_turns * 2):]
    
    messages: list[BaseMessage] = []
    for item in trimmed:
        role = item.get("role", "").lower()
        content = item.get("content", "")
        if not content:
            continue
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    
    return messages


def build_agent_executor():
    """Build the LangChain agent executor with tools.
    
    Returns a callable that can be invoked with:
        agent_executor.invoke({"messages": [...], "input": "user question"})
    """
    from langchain.agents import AgentExecutor, create_tool_calling_agent
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    
    llm = get_conversational_llm()
    
    # Bind tools to LLM
    llm_with_tools = llm.bind_tools(TOOLS)
    
    # Prompt with conversation history placeholder
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    
    agent = create_tool_calling_agent(llm_with_tools, TOOLS, prompt)
    
    executor = AgentExecutor(
        agent=agent,
        tools=TOOLS,
        verbose=False,  # Set True for debugging
        max_iterations=MAX_AGENT_ITERATIONS,
        handle_parsing_errors=True,
        return_intermediate_steps=False,
    )
    
    return executor


async def run_agent(
    question: str,
    history: list[dict[str, str]] | None = None,
) -> str:
    """Run the agent synchronously and return the final answer.
    
    Args:
        question: The user's question
        history: Previous conversation turns as [{"role": "user"/"assistant", "content": "..."}]
    
    Returns:
        The agent's response with thinking tags stripped
    """
    executor = build_agent_executor()
    chat_history = _format_conversation_history(history or [])
    
    try:
        result = await asyncio.to_thread(
            executor.invoke,
            {"input": question, "chat_history": chat_history}
        )
        answer = result.get("output", "")
        return _trim_thinking_tags(answer)
    except Exception as e:
        logger.exception("Agent execution failed")
        return f"माफ गर्नुहोस्, कुनै समस्या भयो। (Error: {e})"


async def run_agent_stream(
    question: str,
    history: list[dict[str, str]] | None = None,
) -> AsyncIterator[str]:
    """Stream conversational LLM output (no tools) with thinking stripped."""
    async for chunk in _direct_llm_stream(
        question,
        history,
        system_prompt=SYSTEM_PROMPT,
        use_fast=False,
        no_think=True,
    ):
        yield chunk


async def _direct_llm_stream(
    question: str,
    history: list[dict[str, str]] | None = None,
    *,
    system_prompt: str = SYSTEM_PROMPT,
    use_fast: bool = False,
    no_think: bool = True,
    max_history_turns: int | None = None,
) -> AsyncIterator[str]:
    """Fast direct LLM stream — no tools, optional fast model for chitchat."""
    if use_fast:
        llm = get_fast_llm()
    else:
        llm = _build_conversational_llm(reasoning=False)
    turns = max_history_turns if max_history_turns is not None else (3 if use_fast else MAX_CONVERSATION_TURNS)
    chat_history = _format_conversation_history(history or [], max_turns=turns)
    user_text = _with_no_think(question) if no_think else question

    messages: list[BaseMessage] = [
        SystemMessage(content=system_prompt),
        *chat_history,
        HumanMessage(content=user_text),
    ]

    async for chunk in _stream_filtered_llm(messages, llm):
        yield chunk


async def simple_generate(
    prompt: str,
    system: str | None = None,
    use_fast: bool = False,
) -> str:
    """Simple one-shot generation without tools or history.
    
    Useful for quick classifications, extractions, or simple Q&A.
    
    Args:
        prompt: The user prompt
        system: Optional system prompt override
        use_fast: If True, use the fast model (qwen3:4b) instead of conversational
    
    Returns:
        The model's response
    """
    llm = get_fast_llm() if use_fast else get_conversational_llm()
    
    messages: list[BaseMessage] = []
    if system:
        messages.append(SystemMessage(content=system))
    messages.append(HumanMessage(content=prompt))
    
    try:
        result = await asyncio.to_thread(llm.invoke, messages)
        text = result.content if hasattr(result, "content") else str(result)
        return _trim_thinking_tags(text)
    except Exception as e:
        logger.exception("Generation failed")
        return ""


async def simple_generate_stream(
    prompt: str,
    system: str | None = None,
    use_fast: bool = False,
) -> AsyncIterator[str]:
    """Stream a simple one-shot generation."""
    llm = get_fast_llm() if use_fast else get_conversational_llm()

    messages: list[BaseMessage] = []
    if system:
        messages.append(SystemMessage(content=system))
    messages.append(HumanMessage(content=_with_no_think(prompt)))

    async for chunk in _stream_filtered_llm(messages, llm):
        yield chunk


# ══════════════════════════════════════════════════════════════════════════════
# CONVERSATION HISTORY STORE
# ══════════════════════════════════════════════════════════════════════════════

_session_histories: dict[str, list[dict[str, str]]] = {}


def get_session_history(session_id: str) -> list[dict[str, str]]:
    """Get conversation history for a session."""
    return _session_histories.get(session_id, [])


def add_to_history(session_id: str, role: str, content: str) -> None:
    """Add a message to session history."""
    if session_id not in _session_histories:
        _session_histories[session_id] = []
    _session_histories[session_id].append({"role": role, "content": content})
    # Trim to max turns
    max_msgs = MAX_CONVERSATION_TURNS * 2
    if len(_session_histories[session_id]) > max_msgs:
        _session_histories[session_id] = _session_histories[session_id][-max_msgs:]


def clear_session_history(session_id: str) -> None:
    """Clear conversation history for a session."""
    _session_histories.pop(session_id, None)


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — ROUTED GENERATION
# ══════════════════════════════════════════════════════════════════════════════

async def run_routed_agent(
    question: str,
    history: list[dict[str, str]] | None = None,
) -> dict[str, any]:
    """Run the agent with intent-based routing.
    
    Phase 2 routing:
    - chitchat → LLM directly (no tools)
    - general_qa → LLM directly (no tools)
    - accounting_qa → RAG(knowledge) → LLM
    - erp_howto → RAG(code/nav) → LLM with tools
    - code_qa → RAG(code) → LLM with tools
    - khata_entry → structured parser → LLM confirmation
    
    Returns:
        {
            "answer": str,
            "sources": list[str],
            "route": {"intent": str, "confidence": float, "method": str}
        }
    """
    from .intent_router import classify_intent, should_skip_tools, get_rag_query
    
    # Step 1: Classify intent
    route = await classify_intent(question)
    logger.info(f"Route: {route.intent} ({route.confidence:.2f}) via {route.method}")
    
    # Step 2: Route based on intent
    card = None  # For khata confirmation cards
    
    if route.intent == "chitchat":
        # Direct LLM response without tools — fast and conversational
        answer = await _direct_llm_response(question, history)
    elif route.intent == "general_qa":
        # Direct LLM response — may use general knowledge
        answer = await _direct_llm_response(question, history)
    elif route.intent == "khata_entry":
        # Phase 4: Structured parsing + validation + confirmation
        answer, card = await _handle_khata_entry(question, history)
    else:
        # accounting_qa, erp_howto, code_qa — use RAG + tools
        rag_query = get_rag_query(question, route.intent)
        rag_context = await _fetch_rag_context(rag_query, route.rag_collection)
        
        if route.intent in ("erp_howto", "code_qa"):
            # Use full agent with tools
            answer = await run_agent(question, history)
        else:
            # accounting_qa — use RAG context but no code tools
            answer = await _rag_augmented_response(question, history, rag_context)
    
    result = {
        "answer": strip_reasoning(answer),
        "sources": [],
        "route": {
            "intent": route.intent,
            "confidence": route.confidence,
            "method": route.method,
            "reasoning": route.reasoning,
        },
    }
    
    # Phase 4: Include confirmation card for khata entries
    if card:
        result["card"] = card
    
    return result


async def _stream_text_chunks(text: str, chunk_size: int = 16) -> AsyncIterator[str]:
    """Yield pre-computed text in small chunks for streaming UX."""
    for i in range(0, len(text), chunk_size):
        yield text[i : i + chunk_size]
        await asyncio.sleep(0)


async def run_routed_agent_stream(
    question: str,
    history: list[dict[str, str]] | None = None,
    *,
    session_id: str = "default",
    context: dict | None = None,
) -> AsyncIterator[dict]:
    """Stream a routed Qwen response (Orbix ultra stack).
    
    Yields event dicts:
      {"type": "route", "route": {...}}
      {"type": "token", "content": "..."}
      {"type": "complete", "message": "...", "card": {...}|None, "route": {...}}
    """
    from .cascade_router import classify_cascade
    from .ledger_query_handler import handle_ledger_query
    from .answer_verifier import append_verification_note
    from ..config import CACHE_ENABLED
    from ..bridges.session_data import set_session_context

    if context:
        set_session_context(session_id, context)

    # Cache hit — instant stream for repeated questions
    if CACHE_ENABLED:
        try:
            from ..api.cache import get_response_cache
            cached = get_response_cache().get(question, intent=None)
            if cached and cached.get("response"):
                route_dict = cached.get("route") or {
                    "intent": "cached",
                    "confidence": 1.0,
                    "method": "cache",
                    "reasoning": cached.get("cache_type", "exact"),
                }
                yield {"type": "route", "route": route_dict}
                async for chunk in _stream_text_chunks(cached["response"]):
                    yield {"type": "token", "content": chunk}
                yield {
                    "type": "complete",
                    "message": cached["response"],
                    "card": None,
                    "route": route_dict,
                }
                return
        except Exception:
            pass

    # Static FAQ — instant answer, no LLM
    from ..knowledge.static_answers import get_static_answer

    static = get_static_answer(question)
    if static:
        route_dict = {
            "intent": "accounting_qa",
            "confidence": 1.0,
            "method": "static_faq",
            "reasoning": "Precomputed FAQ answer",
            "model_tier": "none",
        }
        yield {"type": "route", "route": route_dict}
        async for chunk in _stream_text_chunks(static):
            yield {"type": "token", "content": chunk}
        yield {
            "type": "complete",
            "message": static,
            "card": None,
            "route": route_dict,
        }
        return

    # Single router pass — classify once, update model tier based on RAG hit
    from dataclasses import replace
    from .intent_router import get_rag_query
    from ..knowledge.unified_retriever import retrieve, format_retrieved_context

    cascade = await classify_cascade(question, rag_hit=False)
    rag_context = ""
    if cascade.needs_rag:
        rq = get_rag_query(question, cascade.route.intent)
        if rq:
            chunks = retrieve(rq, intent=cascade.route.intent, k=5)
            rag_context = format_retrieved_context(chunks)
            # Update model tier for accounting_qa if RAG hit + high confidence
            if (
                rag_context
                and cascade.route.intent == "accounting_qa"
                and cascade.confidence >= 0.90
                and cascade.model == "32b"
                and cascade.escalate_reason == "no_rag_context"
            ):
                cascade = replace(cascade, model="4b", escalate_reason=None)

    route = cascade.route
    route_dict = {
        "intent": route.intent,
        "confidence": route.confidence,
        "method": route.method,
        "reasoning": route.reasoning,
        "model_tier": cascade.model,
        "escalate_reason": cascade.escalate_reason,
    }
    yield {"type": "route", "route": route_dict}

    card = None
    parts: list[str] = []

    try:
        if route.intent == "khata_entry":
            answer, card = await _handle_khata_entry(question, history)
            async for chunk in _stream_text_chunks(answer):
                parts.append(chunk)
                yield {"type": "token", "content": chunk}

        elif route.intent == "chitchat":
            # Fast path: qwen3:4b + short prompt (skip 32b load for greetings)
            async for chunk in _direct_llm_stream(
                question,
                history,
                system_prompt=CHITCHAT_SYSTEM_PROMPT,
                use_fast=True,
                no_think=True,
                max_history_turns=3,
            ):
                parts.append(chunk)
                yield {"type": "token", "content": chunk}

        elif route.intent == "ledger_query":
            result = handle_ledger_query(question, session_id)
            answer = str(result.get("answer", ""))
            if result.get("template") or cascade.model == "none":
                async for chunk in _stream_text_chunks(answer):
                    parts.append(chunk)
                    yield {"type": "token", "content": chunk}
            else:
                augmented = f"Ledger facts:\n{result.get('facts')}\n\nUser: {question}"
                async for chunk in _direct_llm_stream(
                    augmented,
                    history,
                    system_prompt=CHITCHAT_SYSTEM_PROMPT,
                    use_fast=True,
                    max_history_turns=2,
                ):
                    parts.append(chunk)
                    yield {"type": "token", "content": chunk}

        elif route.intent == "general_qa":
            use_fast = cascade.model == "4b"
            async for chunk in _direct_llm_stream(
                question,
                history,
                system_prompt=SYSTEM_PROMPT,
                use_fast=use_fast,
                no_think=True,
            ):
                parts.append(chunk)
                yield {"type": "token", "content": chunk}

        elif route.intent == "accounting_qa":
            if not rag_context:
                rq = get_rag_query(question, route.intent)
                if rq:
                    chunks = retrieve(rq, intent=route.intent, k=5)
                    rag_context = format_retrieved_context(chunks)
            if rag_context:
                augmented = f"""Reference (Nepal accounting/tax):

{rag_context}

---

Question: {question}

Answer from the reference. Be concise. Cite the source file when possible."""
            else:
                augmented = question
            use_fast = cascade.model == "4b"
            stream_parts: list[str] = []
            async for chunk in _direct_llm_stream(
                augmented,
                history,
                system_prompt=SYSTEM_PROMPT,
                use_fast=use_fast,
                no_think=True,
                max_history_turns=5,
            ):
                stream_parts.append(chunk)
                parts.append(chunk)
                yield {"type": "token", "content": chunk}
            if not use_fast and rag_context:
                full = "".join(stream_parts)
                verified = append_verification_note(full, rag_context)
                if verified != full:
                    parts = [verified]

        elif route.intent == "erp_howto":
            from .nav_resolver import resolve_navigation
            nav = resolve_navigation(question)
            if nav and nav.get("found"):
                nav_text = nav.get("answer", "")
                async for chunk in _stream_text_chunks(nav_text):
                    parts.append(chunk)
                    yield {"type": "token", "content": chunk}
            else:
                from ..vectorstore.nav_index_store import search_nav_index

                rag_query = get_rag_query(question, route.intent)
                nav_hits = search_nav_index(rag_query, k=4)
                nav_ctx = "\n\n".join(
                    f"[{h.get('source', '')}]\n{h.get('text', '')[:800]}" for h in nav_hits
                )
                code_ctx = await _fetch_rag_context(rag_query, "code")
                sections = [s for s in (nav_ctx, code_ctx) if s]
                prompt = (
                    "\n\n".join(sections) + f"\n\nQuestion: {question}"
                    if sections
                    else question
                )
                async for chunk in _direct_llm_stream(
                    prompt,
                    history,
                    use_fast=True,
                    max_history_turns=3,
                ):
                    parts.append(chunk)
                    yield {"type": "token", "content": chunk}

        elif route.intent == "code_qa":
            rag_query = get_rag_query(question, route.intent)
            code_ctx = await _fetch_rag_context(rag_query, "code")
            prompt = f"{code_ctx}\n\nQuestion: {question}" if code_ctx else question
            async for chunk in _direct_llm_stream(
                prompt,
                history,
                use_fast=False,
                no_think=True,
                max_history_turns=5,
            ):
                parts.append(chunk)
                yield {"type": "token", "content": chunk}

        else:
            async for chunk in run_agent_stream(question, history):
                parts.append(chunk)
                yield {"type": "token", "content": chunk}

    except Exception as e:
        logger.exception("Routed stream failed")
        err = f"माफ गर्नुहोस्, कुनै समस्या भयो। (Error: {e})"
        parts = [err]
        yield {"type": "token", "content": err}

    yield {
        "type": "complete",
        "message": strip_reasoning("".join(parts)),
        "card": card,
        "route": route_dict,
    }


async def _direct_llm_response(
    question: str,
    history: list[dict[str, str]] | None = None,
) -> str:
    """Generate a direct LLM response without tools (for chitchat/general_qa)."""
    llm = get_conversational_llm()
    chat_history = _format_conversation_history(history or [])
    
    messages: list[BaseMessage] = [
        SystemMessage(content=SYSTEM_PROMPT),
        *chat_history,
        HumanMessage(content=_with_no_think(question)),
    ]
    
    try:
        result = await asyncio.to_thread(llm.invoke, messages)
        text = result.content if hasattr(result, "content") else str(result)
        return _trim_thinking_tags(text)
    except Exception as e:
        logger.exception("Direct LLM response failed")
        return f"माफ गर्नुहोस्, कुनै समस्या भयो। (Error: {e})"


async def _fetch_rag_context(query: str | None, collection: str | None) -> str:
    """Fetch relevant context from unified RAG or codebase index."""
    if not query or not collection:
        return ""

    try:
        if collection == "knowledge":
            from ..knowledge.unified_retriever import retrieve, format_retrieved_context

            chunks = retrieve(query, intent="accounting_qa", k=5)
            return format_retrieved_context(chunks, max_chars=2500)

        elif collection == "code":
            from ..vectorstore import chroma_store

            results = chroma_store.search_codebase(query, k=5)
            if results:
                return "\n\n---\n\n".join(
                    f"[{r.get('source', 'unknown')}]\n{r.get('content', '')}"
                    for r in results
                )
    except Exception as e:
        logger.warning(f"RAG fetch failed: {e}")

    return ""


async def _rag_augmented_response(
    question: str,
    history: list[dict[str, str]] | None = None,
    rag_context: str = "",
) -> str:
    """Generate a response augmented with RAG context."""
    llm = get_conversational_llm()
    chat_history = _format_conversation_history(history or [])
    
    # Build augmented prompt
    if rag_context:
        augmented_question = f"""Based on the following reference information:

{rag_context}

---

User question: {question}

Answer the question using the reference information above. If the reference doesn't contain the answer, say so and provide what you know."""
    else:
        augmented_question = question
    
    messages: list[BaseMessage] = [
        SystemMessage(content=SYSTEM_PROMPT),
        *chat_history,
        HumanMessage(content=augmented_question),
    ]
    
    try:
        result = await asyncio.to_thread(llm.invoke, messages)
        text = result.content if hasattr(result, "content") else str(result)
        return _trim_thinking_tags(text)
    except Exception as e:
        logger.exception("RAG-augmented response failed")
        return f"माफ गर्नुहोस्, कुनै समस्या भयो। (Error: {e})"


async def _handle_khata_entry(
    question: str,
    history: list[dict[str, str]] | None = None,
) -> tuple[str, dict | None]:
    """Phase 4 — Handle khata entry using structured parser + validator.
    
    Uses:
    1. LLM-based extraction (with regex fast-path)
    2. Deterministic double-entry validation (must balance)
    3. Natural-language confirmation card
    
    Returns:
        (response_text, card_dict_or_none)
    """
    from ..khata.khata_engine import handle_khata_intent
    
    try:
        response, card = await handle_khata_intent(question, history)
        
        if response:
            return response, card
        
        # Khata engine returned empty — fall back to LLM
        llm = get_conversational_llm()
        chat_history = _format_conversation_history(history or [])
        
        khata_prompt = f"""The user is describing a transaction to record. Parse it and show the double-entry journal:

User: {question}

Show the accounting entry with:
1. What the transaction is
2. DEBIT and CREDIT accounts with amounts
3. Ask for confirmation before recording

Respond in the same language as the user (English, Nepali, or Romanized Nepali)."""
        
        messages: list[BaseMessage] = [
            SystemMessage(content=SYSTEM_PROMPT),
            *chat_history,
            HumanMessage(content=khata_prompt),
        ]
        
        result = await asyncio.to_thread(llm.invoke, messages)
        text = result.content if hasattr(result, "content") else str(result)
        return _trim_thinking_tags(text), None
        
    except Exception as e:
        logger.exception("Khata entry handling failed")
        return f"माफ गर्नुहोस्, transaction बुझ्न सकिएन। (Error: {e})", None


# ══════════════════════════════════════════════════════════════════════════════
# MAIN API: ask() — synchronous entry point for /chat endpoint
# ══════════════════════════════════════════════════════════════════════════════

def ask(question: str, session_id: str) -> dict[str, any]:
    """Synchronous entry point for the /chat endpoint.
    
    Uses Phase 2 intent routing for smarter responses.
    
    Args:
        question: The user's question
        session_id: Unique session identifier for conversation continuity
    
    Returns:
        {"answer": str, "sources": list[str], "route": {...}}
    """
    import asyncio
    
    # Get existing history
    history = get_session_history(session_id)
    
    # Add user message to history
    add_to_history(session_id, "user", question)
    
    try:
        # Run the routed agent
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're in an async context, use thread pool
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(asyncio.run, run_routed_agent(question, history))
                    result = future.result(timeout=120)
            else:
                result = loop.run_until_complete(run_routed_agent(question, history))
        except RuntimeError:
            result = asyncio.run(run_routed_agent(question, history))
    except Exception as e:
        logger.exception("Routed agent failed")
        result = {
            "answer": f"माफ गर्नुहोस्, कुनै समस्या भयो। (Error: {e})",
            "sources": [],
            "route": {"intent": "error", "confidence": 0, "method": "error"},
        }
    
    result["answer"] = strip_reasoning(result.get("answer", ""))
    add_to_history(session_id, "assistant", result["answer"])
    
    return result


async def ask_async(question: str, session_id: str) -> dict[str, any]:
    """Async entry point for the /chat endpoint.
    
    Args:
        question: The user's question
        session_id: Unique session identifier for conversation continuity
    
    Returns:
        {"answer": str, "sources": list[str], "route": {...}}
    """
    # Get existing history
    history = get_session_history(session_id)
    
    # Add user message to history
    add_to_history(session_id, "user", question)
    
    try:
        result = await run_routed_agent(question, history)
    except Exception as e:
        logger.exception("Routed agent failed")
        result = {
            "answer": f"माफ गर्नुहोस्, कुनै समस्या भयो। (Error: {e})",
            "sources": [],
            "route": {"intent": "error", "confidence": 0, "method": "error"},
        }
    
    result["answer"] = strip_reasoning(result.get("answer", ""))
    add_to_history(session_id, "assistant", result["answer"])
    
    return result


# ══════════════════════════════════════════════════════════════════════════════
# LEGACY COMPATIBILITY
# ══════════════════════════════════════════════════════════════════════════════

def build_conversational_agent():
    """Legacy alias for build_agent_executor."""
    return build_agent_executor()


def get_agent_executor():
    """Legacy alias for build_agent_executor."""
    return build_agent_executor()
