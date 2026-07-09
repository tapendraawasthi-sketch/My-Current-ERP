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
)
from .system_prompt import SYSTEM_PROMPT
from .tools import TOOLS

logger = logging.getLogger(__name__)


def _build_conversational_llm() -> ChatOllama:
    """Create the primary conversational LLM with warm settings."""
    return ChatOllama(
        model=CONVERSATIONAL_MODEL,
        base_url=OLLAMA_BASE_URL,
        temperature=CONVERSATIONAL_MODEL_OPTIONS["temperature"],
        num_ctx=int(CONVERSATIONAL_MODEL_OPTIONS["num_ctx"]),
        top_p=CONVERSATIONAL_MODEL_OPTIONS.get("top_p", 0.9),
        repeat_penalty=CONVERSATIONAL_MODEL_OPTIONS.get("repeat_penalty", 1.1),
    )


def _build_fast_llm() -> ChatOllama:
    """Create the fast routing LLM for intent classification."""
    return ChatOllama(
        model=FAST_MODEL,
        base_url=OLLAMA_BASE_URL,
        temperature=FAST_MODEL_OPTIONS["temperature"],
        num_ctx=int(FAST_MODEL_OPTIONS["num_ctx"]),
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
    """Remove Qwen3 <think>...</think> blocks from response.
    
    Qwen3 uses thinking mode for complex reasoning, but users shouldn't
    see the chain-of-thought. We strip it here before showing the response.
    """
    # Remove <think>...</think> blocks (may span multiple lines)
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Remove any orphan tags
    text = re.sub(r"</?think>", "", text, flags=re.IGNORECASE)
    return text.strip()


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
    """Run the agent and stream the response token-by-token.
    
    Yields chunks of text as they're generated. Thinking tags are buffered
    and removed before yielding to the user.
    
    Args:
        question: The user's question
        history: Previous conversation turns
    
    Yields:
        Text chunks (tokens or small groups of tokens)
    """
    llm = get_conversational_llm()
    chat_history = _format_conversation_history(history or [])
    
    # Build full message list
    messages: list[BaseMessage] = [
        SystemMessage(content=SYSTEM_PROMPT),
        *chat_history,
        HumanMessage(content=question),
    ]
    
    # For streaming, we do a simple generation without tool calling
    # (tool calling streaming is complex; we use non-streaming for tool-heavy queries)
    
    buffer = ""
    in_think_block = False
    
    async for chunk in llm.astream(messages):
        if hasattr(chunk, "content"):
            text = chunk.content
            buffer += text
            
            # Handle thinking blocks
            while True:
                if not in_think_block:
                    # Look for start of thinking
                    think_start = buffer.lower().find("<think>")
                    if think_start >= 0:
                        # Yield everything before the tag
                        if think_start > 0:
                            yield buffer[:think_start]
                        buffer = buffer[think_start + 7:]  # Skip <think>
                        in_think_block = True
                        continue
                    else:
                        # No tag yet — yield everything except last 7 chars
                        # (in case tag is split across chunks)
                        if len(buffer) > 7:
                            yield buffer[:-7]
                            buffer = buffer[-7:]
                        break
                else:
                    # Inside thinking block — look for end
                    think_end = buffer.lower().find("</think>")
                    if think_end >= 0:
                        # Discard thinking content, continue after tag
                        buffer = buffer[think_end + 8:]  # Skip </think>
                        in_think_block = False
                        continue
                    else:
                        # Still in thinking block — keep buffering
                        break
    
    # Flush remaining buffer
    if buffer and not in_think_block:
        yield buffer.strip()


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
    """Stream a simple one-shot generation.
    
    Args:
        prompt: The user prompt
        system: Optional system prompt override
        use_fast: If True, use the fast model
    
    Yields:
        Text chunks
    """
    llm = get_fast_llm() if use_fast else get_conversational_llm()
    
    messages: list[BaseMessage] = []
    if system:
        messages.append(SystemMessage(content=system))
    messages.append(HumanMessage(content=prompt))
    
    buffer = ""
    in_think_block = False
    
    async for chunk in llm.astream(messages):
        if hasattr(chunk, "content"):
            text = chunk.content
            buffer += text
            
            while True:
                if not in_think_block:
                    think_start = buffer.lower().find("<think>")
                    if think_start >= 0:
                        if think_start > 0:
                            yield buffer[:think_start]
                        buffer = buffer[think_start + 7:]
                        in_think_block = True
                        continue
                    else:
                        if len(buffer) > 7:
                            yield buffer[:-7]
                            buffer = buffer[-7:]
                        break
                else:
                    think_end = buffer.lower().find("</think>")
                    if think_end >= 0:
                        buffer = buffer[think_end + 8:]
                        in_think_block = False
                        continue
                    else:
                        break
    
    if buffer and not in_think_block:
        yield buffer.strip()


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
# MAIN API: ask() — synchronous entry point for /chat endpoint
# ══════════════════════════════════════════════════════════════════════════════

def ask(question: str, session_id: str) -> dict[str, any]:
    """Synchronous entry point for the /chat endpoint.
    
    Maintains conversation history per session and returns the agent's response.
    
    Args:
        question: The user's question
        session_id: Unique session identifier for conversation continuity
    
    Returns:
        {"answer": str, "sources": list[str]}
    """
    import asyncio
    
    # Get existing history
    history = get_session_history(session_id)
    
    # Add user message to history
    add_to_history(session_id, "user", question)
    
    try:
        # Run the agent
        answer = asyncio.get_event_loop().run_until_complete(
            run_agent(question, history)
        )
    except RuntimeError:
        # No event loop running, create one
        answer = asyncio.run(run_agent(question, history))
    
    # Add assistant response to history
    add_to_history(session_id, "assistant", answer)
    
    # Extract sources from tool calls (simplified - real impl would track tool results)
    sources: list[str] = []
    
    return {"answer": answer, "sources": sources}


# ══════════════════════════════════════════════════════════════════════════════
# LEGACY COMPATIBILITY
# ══════════════════════════════════════════════════════════════════════════════

def build_conversational_agent():
    """Legacy alias for build_agent_executor."""
    return build_agent_executor()


def get_agent_executor():
    """Legacy alias for build_agent_executor."""
    return build_agent_executor()
