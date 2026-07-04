"""Expose the chatbot over HTTP for the widget."""

from __future__ import annotations

import httpx
from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ..agent import agent_builder
from ..config import (
    BOT_ROOT,
    EMBED_MODEL,
    ERP_PATH,
    KHATA_STRUCTURED_PARSE,
    MODEL_NAME,
    OLLAMA_BASE_URL,
)
from ..ingestion import embedder
from ..vectorstore import chroma_store
from ..watcher.watcher import start_watcher
from ..khata import khata_chat
from ..khata.feedback_store import append_feedback, feedback_stats
from ..khata.khata_chat import clear_session as khata_clear_session

app = FastAPI(title="ERP AI Chatbot")

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


@app.get("/status")
def status() -> dict:
    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        resp.raise_for_status()
        ollama_status = "connected"
    except Exception:
        ollama_status = "unreachable"

    return {
        "status": "online",
        "model": MODEL_NAME,
        "embed_model": EMBED_MODEL,
        "erp_path": str(ERP_PATH),
        "indexed_files": chroma_store.get_indexed_file_count(),
        "ollama": ollama_status,
        "watcher": "active",
        "khata_llm": ollama_status == "connected",
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
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
    return {"status": "ok", "session_id": sid or None}


@app.post("/khata/feedback")
def khata_feedback_endpoint(req: KhataFeedbackRequest) -> dict:
    """Store confirmed/cancelled entries for LoRA re-training."""
    stored = append_feedback(req.model_dump(exclude_none=True))
    return {"status": "ok", "id": stored["id"], "stats": feedback_stats()}


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
