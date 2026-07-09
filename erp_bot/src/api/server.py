"""Expose the chatbot over HTTP for the widget.

Phase 1 — Conversation Brain:
- Multi-turn conversation with memory
- Streaming responses via SSE
- Warm, natural, tri-lingual (EN/Devanagari/Romanized Nepali)
"""

from __future__ import annotations

import asyncio
import httpx
from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ..agent import agent_builder
from ..config import (
    BOT_ROOT,
    CONVERSATIONAL_MODEL,
    EMBED_MODEL,
    ERP_PATH,
    FAST_MODEL,
    KHATA_STRUCTURED_PARSE,
    MODEL_NAME,
    OLLAMA_BASE_URL,
)
from ..ingestion import embedder
from ..vectorstore import chroma_store
from ..watcher.watcher import start_watcher
from ..bridges.session_data import set_session_context
from ..conversation import get_conversation_manager
from ..khata import khata_chat
from ..khata.feedback_store import append_feedback, append_feedback_bulk, feedback_stats
from ..khata.khata_chat import clear_session as khata_clear_session

from .streaming import router as streaming_router

app = FastAPI(title="ERP AI Chatbot")
app.include_router(streaming_router)

# Orbix v2 — genuine local reasoning agent (plan/tool/verify loop).
try:
    from ..orbix.api import router as orbix_router

    app.include_router(orbix_router)
    print("[SERVER] Orbix v2 router mounted at /orbix")
except Exception as _orbix_exc:  # keep legacy endpoints working if Orbix fails to import
    print(f"[SERVER] Orbix v2 unavailable: {_orbix_exc}")

# Local dev tool only — tighten origins if ever exposed beyond localhost.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/static/erp_bot",
    StaticFiles(directory=str(BOT_ROOT / "src" / "ui")),
    name="erp_bot_ui",
)


@app.on_event("startup")
def on_startup():
    start_watcher()
    print("[SERVER] Watcher started")
    if chroma_store.get_indexed_file_count() == 0:
        print(
            "[SERVER] WARNING: index is empty — run scripts/start.py's initial scan, "
            "or POST /reindex"
        )
    try:
        from ..knowledge.knowledge_init import ensure_knowledge_indexes

        idx = ensure_knowledge_indexes()
        print(f"[SERVER] Knowledge indexes: {idx}")
    except Exception as exc:
        print(f"[SERVER] Knowledge index warning: {exc}")


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=2000, min_length=1)
    session_id: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]
    session_id: str


class KhataChatRequest(BaseModel):
    message: str = Field(..., max_length=4000, min_length=1)
    session_id: str = Field(..., min_length=1)
    balance: dict | None = None
    language: str | None = None


class KhataChatResponse(BaseModel):
    kind: str
    reply: str
    card: dict | None = None
    session_id: str
    engine: str = "ollama"


class V2ChatRequest(BaseModel):
    message: str = Field(..., max_length=4000, min_length=1)
    session_id: str = Field(..., min_length=1)
    balance: dict | None = None
    language: str | None = None
    context: dict | None = None


class V2ChatResponse(BaseModel):
    message: str
    action: str
    entry: dict | None = None
    card: dict | None = None
    suggestions: list[str] = Field(default_factory=list)
    insight: str | None = None
    metadata: dict = Field(default_factory=dict)
    session_id: str


class KhataFeedbackRequest(BaseModel):
    label: str = Field(..., pattern="^(confirmed|cancelled|corrected)$")
    narration: str = Field(..., min_length=1, max_length=4000)
    intent: str = Field(..., min_length=1, max_length=128)
    amount: int = Field(..., ge=0)
    party: str | None = None
    journalLines: list[dict] | None = None
    correctedNarration: str | None = None
    id: str | None = None
    timestamp: str | None = None


@app.get("/health")
def health() -> dict:
    """Lightweight readiness probe for deploy scripts."""
    from ..vectorstore.ca_knowledge_store import get_ca_knowledge_count
    from ..vectorstore.nlu_knowledge_store import get_nlu_knowledge_count

    ollama_ok = False
    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        ollama_ok = resp.status_code == 200
    except Exception:
        pass

    return {
        "status": "online",
        "ollama": "connected" if ollama_ok else "unreachable",
        "khata_llm": ollama_ok,
        "indexed_files": chroma_store.get_indexed_file_count(),
        "ca_knowledge_chunks": get_ca_knowledge_count(),
        "nlu_knowledge_chunks": get_nlu_knowledge_count(),
        "model": MODEL_NAME,
    }


@app.get("/status")
def status() -> dict:
    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=10)
        resp.raise_for_status()
        ollama_status = "connected"
    except Exception:
        ollama_status = "unreachable"

    return {
        "status": "online",
        "model": CONVERSATIONAL_MODEL,
        "conversational_model": CONVERSATIONAL_MODEL,
        "fast_model": FAST_MODEL,
        "embed_model": EMBED_MODEL,
        "erp_path": str(ERP_PATH),
        "indexed_files": chroma_store.get_indexed_file_count(),
        "ollama": ollama_status,
        "watcher": "active",
        "khata_llm": ollama_status == "connected",
        "conversation_memory": True,
        "streaming": True,
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """Standard chat endpoint with conversation memory."""
    try:
        if not req.message.strip():
            return ChatResponse(
                answer="Message cannot be empty.",
                sources=[],
                session_id=req.session_id,
            )
        result = agent_builder.ask(req.message, req.session_id)
        return ChatResponse(
            answer=result["answer"],
            sources=result["sources"],
            session_id=req.session_id,
        )
    except Exception as e:
        return ChatResponse(
            answer=f"Chat error: {e}",
            sources=[],
            session_id=req.session_id,
        )


class StreamChatRequest(BaseModel):
    message: str = Field(..., max_length=4000, min_length=1)
    session_id: str = Field(..., min_length=1)


@app.post("/chat/stream")
async def chat_stream(req: StreamChatRequest):
    """Streaming chat endpoint using Server-Sent Events.
    
    Returns tokens as they're generated for responsive UX.
    Use with EventSource or fetch with streaming on the frontend.
    """
    if not req.message.strip():
        async def empty_response():
            yield "data: Message cannot be empty.\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(empty_response(), media_type="text/event-stream")
    
    # Get history and add user message
    history = agent_builder.get_session_history(req.session_id)
    agent_builder.add_to_history(req.session_id, "user", req.message)
    
    collected_response: list[str] = []
    
    async def generate():
        try:
            async for chunk in agent_builder.run_agent_stream(req.message, history):
                if chunk:
                    collected_response.append(chunk)
                    # Escape newlines for SSE format
                    safe_chunk = chunk.replace("\n", "\\n")
                    yield f"data: {safe_chunk}\n\n"
            
            # Save complete response to history
            full_response = "".join(collected_response)
            agent_builder.add_to_history(req.session_id, "assistant", full_response)
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: Error: {e}\n\n"
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


@app.delete("/chat/session/{session_id}")
def clear_chat_session(session_id: str) -> dict:
    """Clear conversation history for a session."""
    agent_builder.clear_session_history(session_id)
    return {"status": "ok", "session_id": session_id}


@app.get("/chat/session/{session_id}/history")
def get_chat_history(session_id: str) -> dict:
    """Get conversation history for a session."""
    history = agent_builder.get_session_history(session_id)
    return {"session_id": session_id, "history": history}


@app.post("/khata/chat", response_model=KhataChatResponse)
def khata_chat_endpoint(req: KhataChatRequest) -> KhataChatResponse:
    try:
        result = khata_chat(
            req.message,
            req.session_id,
            req.balance,
            req.language,
        )
        return KhataChatResponse(
            kind=result.get("kind", "chat"),
            reply=result.get("reply", ""),
            card=result.get("card"),
            session_id=result.get("session_id", req.session_id),
            engine=result.get("engine", "ollama"),
        )
    except Exception as e:
        return KhataChatResponse(
            kind="chat",
            reply=f"e-Khata error: {e}",
            card=None,
            session_id=req.session_id,
            engine="error",
        )


@app.post("/khata/clear_session")
def khata_clear_session_endpoint(payload: dict) -> dict:
    sid = str(payload.get("session_id", "")).strip()
    if sid:
        khata_clear_session(sid)
        get_conversation_manager().clear_session(sid)
    return {"status": "ok", "session_id": sid or None}


@app.post("/v2/chat", response_model=V2ChatResponse)
def v2_chat_endpoint(req: V2ChatRequest) -> V2ChatResponse:
    """e-Khata v2 — conversation manager with reasoner + confirmation flow."""
    try:
        if req.context:
            set_session_context(req.session_id, req.context)
        mgr = get_conversation_manager()
        resp = mgr.handle_message(
            req.message,
            req.session_id,
            balance=req.balance,
            language=req.language,
            context=req.context,
        )
        entry_dict = resp.entry.model_dump() if resp.entry else None
        return V2ChatResponse(
            message=resp.message,
            action=resp.action,
            entry=entry_dict,
            card=resp.card,
            suggestions=resp.suggestions,
            insight=resp.insight,
            metadata=resp.metadata,
            session_id=resp.session_id,
        )
    except Exception as e:
        return V2ChatResponse(
            message=f"e-Khata v2 error: {e}",
            action="chat",
            session_id=req.session_id,
            metadata={"error": str(e)},
        )


@app.delete("/v2/session/{session_id}")
def v2_clear_session(session_id: str) -> dict:
    get_conversation_manager().clear_session(session_id)
    khata_clear_session(session_id)
    return {"status": "ok", "session_id": session_id}


@app.post("/khata/feedback")
def khata_feedback_endpoint(req: KhataFeedbackRequest) -> dict:
    """Store confirmed/cancelled entries for LoRA re-training."""
    stored = append_feedback(req.model_dump(exclude_none=True))
    return {"status": "ok", "id": stored["id"], "stats": feedback_stats()}


class KhataFeedbackBulkRequest(BaseModel):
    records: list[KhataFeedbackRequest] = Field(..., max_length=500)


@app.post("/khata/feedback/bulk")
def khata_feedback_bulk_endpoint(req: KhataFeedbackBulkRequest) -> dict:
    """Sync browser localStorage feedback batch to server corpus."""
    payload = [r.model_dump(exclude_none=True) for r in req.records]
    result = append_feedback_bulk(payload)
    return {"status": "ok", **result}


@app.get("/khata/training/stats")
def khata_training_stats() -> dict:
    """Return generated corpus line counts for training pipeline monitoring."""
    from pathlib import Path
    data_dir = ERP_PATH / "data" / "ekhata"
    stats: dict = {"corpus_files": {}}
    for name in (
        "ca-training-corpus-generated.jsonl",
        "lora-instruction-dataset.jsonl",
        "domain-classifier-dataset.jsonl",
        "user-feedback.jsonl",
    ):
        path = data_dir / name
        if path.exists():
            lines = sum(1 for _ in path.open(encoding="utf-8"))
            stats["corpus_files"][name] = lines
        else:
            stats["corpus_files"][name] = 0
    stats["user_feedback"] = feedback_stats()
    stats["model"] = MODEL_NAME
    stats["structured_parse"] = KHATA_STRUCTURED_PARSE
    stats["note"] = "Run npm run generate:ekhata-corpus to refresh; POST /khata/feedback for user entries"
    return stats


@app.post("/reindex")
def reindex(background_tasks: BackgroundTasks) -> dict:
    background_tasks.add_task(embedder.ingest_all)
    return {"status": "reindex started", "erp_path": str(ERP_PATH)}


@app.post("/clear_session")
def clear_session(payload: dict) -> dict:
    return {
        "status": "acknowledged",
        "note": (
            "start a new session_id client-side to get a fresh conversation; "
            "in-memory history is process-local and clears on server restart"
        ),
    }
