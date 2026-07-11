"""FastAPI router for Orbix v2. Mounted at /orbix in the main server."""

from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse

from .bootstrap import get_engine, get_memory
from .config import get_config
from .llm.ollama_client import OllamaClient
from .schemas import OrbixChatRequest, OrbixChatResponse
from ..llm.reasoning_filter import strip_reasoning

router = APIRouter(prefix="/orbix/v2", tags=["orbix-v2"])


def _sanitize_response(resp: OrbixChatResponse) -> OrbixChatResponse:
    resp.answer = strip_reasoning(resp.answer)
    return resp


@router.get("/status")
async def status() -> dict:
    config = get_config()
    client = OllamaClient(config.ollama_base_url, config.agent_model)
    reachable = await client.reachable()
    available = await client.available_models() if reachable else []

    agent_ready = reachable and any(
        config.agent_model.split(":")[0] in m for m in available
    )
    return {
        "status": "ok" if reachable else "degraded",
        "mode": "orbix" if agent_ready else ("builtin" if reachable else "offline"),
        "ollama": "reachable" if reachable else "unreachable",
        "agent_model": config.agent_model,
        "verifier_model": config.verifier_model,
        "router_model": config.router_model,
        "embed_model": config.embed_model,
        "available_models": available,
        "agent_model_installed": agent_ready,
    }


@router.post("/chat", response_model=OrbixChatResponse)
async def chat(req: OrbixChatRequest) -> OrbixChatResponse:
    try:
        engine = await get_engine()
        resp = await engine.chat(req)
        if not resp.session_id:
            resp.session_id = req.session_id
        return _sanitize_response(resp)
    except Exception as exc:
        return OrbixChatResponse(
            answer=f"Orbix error: {exc}",
            intent="error",
            confidence=0.0,
            session_id=req.session_id,
            warnings=[str(exc)],
            engine="error",
        )


@router.post("/chat/stream")
async def chat_stream(req: OrbixChatRequest):
    """Server-sent events: emits tool-trace + final answer as JSON lines.

    The engine runs to completion, then the response is streamed as discrete
    events so the UI can render the tool activity and the grounded answer.
    """

    async def event_gen():
        try:
            engine = await get_engine()
            resp = await engine.chat(req)
            if not resp.session_id:
                resp.session_id = req.session_id
            resp = _sanitize_response(resp)
            for record in resp.tool_trace:
                yield _sse("tool", record.model_dump())
            yield _sse("answer", resp.model_dump())
            yield _sse("done", {"ok": True})
        except Exception as exc:
            yield _sse("error", {"message": str(exc)})

    return StreamingResponse(event_gen(), media_type="text/event-stream")


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@router.post("/reindex")
def reindex(background_tasks: BackgroundTasks) -> dict:
    from ..ingestion import embedder

    background_tasks.add_task(embedder.ingest_all)
    return {"status": "reindex started"}


@router.post("/memory/forget")
async def forget_memory(payload: dict) -> dict:
    session_id = str(payload.get("session_id", "")).strip()
    if not session_id:
        return {"status": "error", "message": "session_id required"}
    memory = await get_memory()
    await memory.forget_session(session_id)
    return {"status": "ok", "session_id": session_id}
