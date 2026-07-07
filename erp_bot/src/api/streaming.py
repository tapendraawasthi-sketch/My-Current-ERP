"""SSE streaming for e-Khata v2 — live Ollama tokens on LLM paths."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..bridges.session_data import set_session_context
from ..conversation import get_conversation_manager

logger = logging.getLogger(__name__)

router = APIRouter()


class StreamChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str = Field(..., min_length=1)
    context: dict | None = None
    balance: dict | None = None
    language: str | None = None


def _sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, default=str)}\n\n"


@router.post("/v2/chat/stream")
async def stream_chat(request: StreamChatRequest) -> StreamingResponse:
    if request.context:
        set_session_context(request.session_id, request.context)

    async def event_generator() -> AsyncIterator[str]:
        yield _sse({"type": "thinking_start"})
        try:
            mgr = get_conversation_manager()
            loop = asyncio.get_event_loop()

            def run_stream():
                return list(
                    mgr.handle_message_stream(
                        request.message,
                        request.session_id,
                        balance=request.balance,
                        language=request.language,
                        context=request.context,
                    )
                )

            events = await loop.run_in_executor(None, run_stream)

            tools: list[str] = []
            resp = None
            streamed = False

            for kind, payload in events:
                if kind == "token":
                    streamed = True
                    yield _sse({"type": "token", "content": payload})
                elif kind == "complete":
                    resp = payload
                    tcalls = (resp.metadata or {}).get("tool_calls") or (resp.metadata or {}).get("tools_used") or []
                    tools = [
                        t.get("tool") if isinstance(t, dict) else str(t) for t in tcalls
                    ]

            if tools:
                yield _sse({"type": "tool_calling", "tools": tools})

            yield _sse({"type": "thinking_done"})

            if resp is None:
                yield _sse({"type": "error", "message": "No response generated"})
                return

            if not streamed:
                yield _sse({"type": "token", "content": resp.message})

            entry_dict = resp.entry.model_dump() if resp.entry else None
            yield _sse(
                {
                    "type": "complete",
                    "action": resp.action,
                    "message": resp.message,
                    "card": resp.card,
                    "entry": entry_dict,
                    "suggestions": resp.suggestions,
                    "insight": resp.insight,
                    "metadata": resp.metadata,
                    "session_id": resp.session_id,
                }
            )
        except Exception as exc:
            logger.exception("Stream error")
            yield _sse({"type": "error", "message": str(exc)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
