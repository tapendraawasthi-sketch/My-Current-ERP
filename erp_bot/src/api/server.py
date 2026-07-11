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
    CACHE_ENABLED,
    CONVERSATIONAL_MODEL,
    EMBED_MODEL,
    ERP_PATH,
    FAST_MODEL,
    KHATA_STRUCTURED_PARSE,
    MODEL_NAME,
    OLLAMA_BASE_URL,
    OLLAMA_KEEP_ALIVE,
)
from ..ingestion import embedder
from ..vectorstore import chroma_store
from ..watcher.watcher import start_watcher
from ..bridges.session_data import set_session_context
from ..conversation import get_conversation_manager
from ..khata import khata_chat
from ..khata.feedback_store import append_feedback, append_feedback_bulk, feedback_stats
from ..khata.khata_chat import clear_session as khata_clear_session
from ..llm.reasoning_filter import strip_reasoning

from .streaming import router as streaming_router

app = FastAPI(title="ERP AI Chatbot")
app.include_router(streaming_router)

# NIOS v3 — Financial Intelligence Platform gateway
try:
    from ..nios.api import router as nios_router

    app.include_router(nios_router)
    print("[SERVER] NIOS v3 router mounted at /nios/v1")
except Exception as _nios_exc:
    print(f"[SERVER] NIOS v3 unavailable: {_nios_exc}")

# Cloudflare R2 storage health check
try:
    from backend.api.health_routes import router as storage_health_router

    app.include_router(storage_health_router)
    print("[SERVER] R2 storage health mounted at /storage/health")
except Exception as _storage_exc:
    print(f"[SERVER] R2 storage health unavailable: {_storage_exc}")

# Knowledge document ingestion pipeline
try:
    from backend.knowledge.api import router as knowledge_router
    from backend.knowledge.jobs.worker import start_knowledge_worker

    app.include_router(knowledge_router)
    print("[SERVER] Knowledge pipeline mounted at /knowledge/v1")
except Exception as _knowledge_exc:
    print(f"[SERVER] Knowledge pipeline unavailable: {_knowledge_exc}")

# Orbix v2 — genuine local reasoning agent (plan/tool/verify loop).
try:
    from ..orbix.api import router as orbix_router

    app.include_router(orbix_router)
    print("[SERVER] Orbix v2 router mounted at /orbix/v2")
except Exception as _orbix_exc:  # keep legacy endpoints working if Orbix fails to import
    print(f"[SERVER] Orbix v2 unavailable: {_orbix_exc}")

# OIP — Orbix Intelligence Platform (Constitutional Phase 0)
try:
    from ..oip.api import router as oip_router
    from ..oip.config.settings import get_oip_settings
    from ..oip.infrastructure.di.container import shutdown_container

    if get_oip_settings().enabled:
        from ..oip.api.middleware import SecurityContextMiddleware

        app.add_middleware(SecurityContextMiddleware)
        app.include_router(oip_router)
        print("[SERVER] OIP kernel mounted at /oip/v1")

        @app.on_event("shutdown")
        async def _oip_shutdown() -> None:
            await shutdown_container()
    else:
        print("[SERVER] OIP disabled (OIP_ENABLED=false)")
except Exception as _oip_exc:
    print(f"[SERVER] OIP unavailable: {_oip_exc}")

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

    # Optional R2 connection verification (set R2_STARTUP_VERIFY=true in production)
    import os

    if os.getenv("R2_STARTUP_VERIFY", "false").lower() in {"1", "true", "yes"}:
        try:
            from backend.storage import startup_verify_r2

            startup_verify_r2()
            print("[SERVER] R2 storage connection verified")
        except Exception as exc:
            print(f"[SERVER] R2 storage verification failed: {exc}")
            raise

    try:
        from backend.knowledge.jobs.worker import start_knowledge_worker

        start_knowledge_worker()
        print("[SERVER] Knowledge ingestion worker started")
    except Exception as exc:
        print(f"[SERVER] Knowledge worker warning: {exc}")


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=4000, min_length=1)
    session_id: str


class RouteInfo(BaseModel):
    """Phase 2 — Intent routing information."""
    intent: str
    confidence: float
    method: str
    reasoning: str | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]
    session_id: str
    route: RouteInfo | None = None
    card: dict | None = None  # Phase 4: Khata confirmation card


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
    from ..vectorstore.nepal_knowledge_store import get_nepal_knowledge_count

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
        "nepal_knowledge_chunks": get_nepal_knowledge_count(),
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
        "orbix_qwen_stream": True,
        "stack": "qwen3:4b router + qwen3:32b brain + hybrid RAG",
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """Standard chat endpoint with conversation memory, Phase 2 routing, Phase 6 caching."""
    try:
        if not req.message.strip():
            return ChatResponse(
                answer="Message cannot be empty.",
                sources=[],
                session_id=req.session_id,
            )
        
        # Phase 6: Check cache first
        if CACHE_ENABLED:
            from .cache import get_response_cache
            cache = get_response_cache()
            cached = cache.get(req.message)
            if cached:
                route_info = None
                if cached.get("route"):
                    route_info = RouteInfo(**cached["route"])
                return ChatResponse(
                    answer=strip_reasoning(cached["response"]),
                    sources=cached.get("sources", []),
                    session_id=req.session_id,
                    route=route_info,
                )
        
        result = agent_builder.ask(req.message, req.session_id)
        
        # Build route info if available
        route_info = None
        route_dict = None
        if "route" in result and result["route"]:
            route_dict = {
                "intent": result["route"].get("intent", "unknown"),
                "confidence": result["route"].get("confidence", 0),
                "method": result["route"].get("method", "unknown"),
                "reasoning": result["route"].get("reasoning"),
            }
            route_info = RouteInfo(**route_dict)
        
        # Phase 6: Cache the response
        if CACHE_ENABLED:
            cache.put(
                query=req.message,
                response=result["answer"],
                sources=result.get("sources", []),
                route=route_dict,
            )
        
        return ChatResponse(
            answer=strip_reasoning(result["answer"]),
            sources=result.get("sources", []),
            session_id=req.session_id,
            route=route_info,
            card=result.get("card"),  # Phase 4: Khata confirmation card
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
    context: dict | None = None


@app.post("/chat/stream")
async def chat_stream(req: StreamChatRequest):
    """Streaming chat endpoint using Server-Sent Events (Falcon — plain text)."""
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
            full_response = strip_reasoning("".join(collected_response))
            agent_builder.add_to_history(req.session_id, "assistant", full_response)
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: Error: {e}\n\n"
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


def _sse_json(data: dict) -> str:
    import json
    return f"data: {json.dumps(data, default=str)}\n\n"


@app.post("/orbix/chat/stream")
async def orbix_chat_stream(req: StreamChatRequest):
    """Orbix Qwen-only stream — routed agent with JSON SSE events.
    
    Stack: qwen3:4b router → RAG/khata/tools → qwen3:32b brain → stream tokens.
    """
    if not req.message.strip():
        async def empty_response():
            yield _sse_json({"type": "error", "message": "Message cannot be empty."})
        return StreamingResponse(
            empty_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    history = agent_builder.get_session_history(req.session_id)
    agent_builder.add_to_history(req.session_id, "user", req.message)

    if req.context:
        set_session_context(req.session_id, req.context)

    async def generate():
        yield _sse_json({"type": "thinking_start"})
        full_message = ""
        card = None
        route_info = None
        try:
            async for event in agent_builder.run_routed_agent_stream(
                req.message,
                history,
                session_id=req.session_id,
                context=req.context,
            ):
                if event.get("type") == "route":
                    route_info = event.get("route")
                    yield _sse_json({"type": "route", "route": route_info})
                elif event.get("type") == "token":
                    token = strip_reasoning(str(event.get("content", "")))
                    if token:
                        yield _sse_json({"type": "token", "content": token})
                elif event.get("type") == "complete":
                    full_message = strip_reasoning(str(event.get("message") or ""))
                    card = event.get("card")
                    route_info = event.get("route") or route_info

            agent_builder.add_to_history(req.session_id, "assistant", full_message)
            if CACHE_ENABLED and full_message and not card:
                try:
                    from .cache import get_response_cache
                    get_response_cache().put(
                        req.message,
                        full_message,
                        route=route_info,
                        intent=(route_info or {}).get("intent"),
                    )
                except Exception:
                    pass
            yield _sse_json({"type": "thinking_done"})
            yield _sse_json(
                {
                    "type": "complete",
                    "message": full_message,
                    "card": card,
                    "route": route_info,
                    "action": "confirm" if card else "chat",
                }
            )
        except Exception as exc:
            yield _sse_json({"type": "error", "message": str(exc)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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


class ClassifyRequest(BaseModel):
    message: str = Field(..., max_length=4000, min_length=1)
    use_llm_always: bool = False


@app.post("/classify")
async def classify_intent_endpoint(req: ClassifyRequest) -> dict:
    """Phase 2 — Classify message intent without generating a response.
    
    Useful for testing and debugging the intent router.
    """
    from ..agent.intent_router import classify_intent
    
    result = await classify_intent(req.message, use_llm_always=req.use_llm_always)
    return {
        "message": req.message,
        "intent": result.intent,
        "confidence": result.confidence,
        "method": result.method,
        "reasoning": result.reasoning,
        "needs_rag": result.needs_rag,
        "needs_parser": result.needs_parser,
        "rag_collection": result.rag_collection,
    }


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


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — NEPAL KNOWLEDGE BASE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/knowledge/nepal/stats")
def nepal_knowledge_stats() -> dict:
    """Get statistics about the Nepal accounting/tax knowledge base."""
    from ..vectorstore.nepal_knowledge_store import get_knowledge_stats
    return get_knowledge_stats()


@app.post("/knowledge/nepal/reindex")
def nepal_knowledge_reindex(background_tasks: BackgroundTasks) -> dict:
    """Reindex Nepal knowledge base from markdown files."""
    from ..vectorstore.nepal_knowledge_store import ingest_nepal_knowledge
    
    def _reindex():
        result = ingest_nepal_knowledge(force_reindex=True)
        print(f"[KNOWLEDGE] Nepal reindex complete: {result}")
    
    background_tasks.add_task(_reindex)
    return {"status": "reindex started", "collection": "nepal_knowledge"}


@app.post("/knowledge/nepal/search")
async def nepal_knowledge_search(payload: dict) -> dict:
    """Search the Nepal knowledge base (for testing/debugging).
    
    Body: {"query": "VAT rate in Nepal", "k": 5}
    """
    from ..vectorstore.nepal_knowledge_store import search_nepal_knowledge
    
    query = payload.get("query", "")
    k = payload.get("k", 5)
    
    if not query:
        return {"error": "query is required", "results": []}
    
    results = search_nepal_knowledge(query, k=k)
    return {"query": query, "results": results, "count": len(results)}


@app.post("/clear_session")
def clear_session(payload: dict) -> dict:
    return {
        "status": "acknowledged",
        "note": (
            "start a new session_id client-side to get a fresh conversation; "
            "in-memory history is process-local and clears on server restart"
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — KHATA ENTRY ENGINE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class KhataParseRequest(BaseModel):
    message: str = Field(..., max_length=1000, min_length=1)
    use_llm_always: bool = False
    language: str | None = None


@app.post("/khata/parse")
async def khata_parse_entry(req: KhataParseRequest) -> dict:
    """Phase 4 — Parse a transaction message into a journal entry.
    
    Returns parsed transaction with journal lines, or clarification request.
    """
    from ..khata.entry_engine import parse_khata_entry, generate_confirmation_message
    
    result = await parse_khata_entry(req.message, use_llm_always=req.use_llm_always)
    
    if result.success and result.transaction:
        txn = result.transaction
        lang = req.language or "mixed"
        confirmation = generate_confirmation_message(txn, lang)
        
        return {
            "success": True,
            "kind": "entry",
            "card": txn.to_card(),
            "confirmation": confirmation,
            "is_balanced": txn.is_balanced,
            "method": txn.method,
            "confidence": txn.confidence,
        }
    elif result.clarification_needed:
        return {
            "success": False,
            "kind": "clarify",
            "clarification": result.clarification_needed,
            "card": None,
        }
    else:
        return {
            "success": False,
            "kind": "error",
            "error": result.error or "Could not parse transaction",
            "card": None,
        }


@app.post("/khata/validate")
async def khata_validate_entry(payload: dict) -> dict:
    """Validate a journal entry (check balance, account codes, etc.)."""
    from decimal import Decimal
    
    journal_lines = payload.get("journalLines", [])
    if not journal_lines:
        return {"valid": False, "error": "No journal lines provided"}
    
    total_dr = sum(Decimal(str(l.get("debit", 0))) for l in journal_lines)
    total_cr = sum(Decimal(str(l.get("credit", 0))) for l in journal_lines)
    
    is_balanced = abs(total_dr - total_cr) < Decimal("0.01")
    
    return {
        "valid": is_balanced,
        "total_debit": float(total_dr),
        "total_credit": float(total_cr),
        "difference": float(abs(total_dr - total_cr)),
        "error": None if is_balanced else "Journal entry does not balance (Dr ≠ Cr)",
    }


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6 — CACHE MANAGEMENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/cache/stats")
def cache_stats() -> dict:
    """Get response cache statistics.
    
    Returns hit rate, entry count, and performance metrics.
    """
    if not CACHE_ENABLED:
        return {"enabled": False, "message": "Cache is disabled"}
    
    from .cache import get_response_cache
    cache = get_response_cache()
    stats = cache.get_stats()
    stats["enabled"] = True
    return stats


@app.post("/cache/clear")
def cache_clear() -> dict:
    """Clear all cached responses."""
    if not CACHE_ENABLED:
        return {"status": "skipped", "message": "Cache is disabled"}
    
    from .cache import get_response_cache
    cache = get_response_cache()
    cache.clear()
    return {"status": "ok", "message": "Cache cleared"}


@app.get("/performance")
def performance_info() -> dict:
    """Phase 6 — Performance and latency information for L4 GPU.
    
    Returns expected tokens/sec, latency estimates, and optimization tips.
    """
    from .cache import get_response_cache
    
    cache_stats = {}
    if CACHE_ENABLED:
        cache = get_response_cache()
        cache_stats = cache.get_stats()
    
    return {
        "gpu": "NVIDIA L4 (24GB VRAM)",
        "models": {
            "conversational": {
                "name": CONVERSATIONAL_MODEL,
                "expected_tokens_per_sec": "8-15 t/s (32B Q4) or 15-25 t/s (14B Q4)",
                "first_token_latency": "2-3s (32B) or 1-2s (14B)",
                "context_size": 8192,
            },
            "fast": {
                "name": FAST_MODEL,
                "expected_tokens_per_sec": "40-60 t/s",
                "first_token_latency": "<0.5s",
                "use_case": "Intent routing, quick extractions",
            },
            "embedding": {
                "name": EMBED_MODEL,
                "latency": "<100ms",
                "use_case": "RAG retrieval, cache similarity",
            },
        },
        "optimizations": {
            "cache_enabled": CACHE_ENABLED,
            "cache_stats": cache_stats,
            "keep_alive": OLLAMA_KEEP_ALIVE,
            "streaming": True,
        },
        "tips": [
            "Use streaming to show tokens as they generate — reduces perceived latency",
            "Cache common questions (VAT rate, TDS, etc.) for instant responses",
            "Keep Ollama model loaded with OLLAMA_KEEP_ALIVE=10m",
            "Use fast model (4B) for routing, big model (32B) only for final response",
            "Show 'thinking...' indicator during first-token latency",
            "Batch embedding requests when possible",
        ],
    }
