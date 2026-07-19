"""Expose the chatbot over HTTP for the widget.

Phase 1 — Conversation Brain:
- Multi-turn conversation with memory
- Streaming responses via SSE
- Warm, natural, tri-lingual (EN/Devanagari/Romanized Nepali)
"""

from __future__ import annotations

import asyncio
import httpx
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
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

from .oip_chat_ingress import (
    map_response_to_orbix,
    oip_chat_enabled,
    provider_runtime_status_payload,
    sse_json,
    stream_orbix_kernel_events,
    submit_chat,
)
from .streaming import router as streaming_router
from ..oip.domain.constitution.ai_stack_mount_policy import (
    secondary_ai_stacks_allowed,
    secondary_stack_denial_payload,
)

app = FastAPI(title="ERP AI Chatbot")

_SECONDARY_AI_STACKS = secondary_ai_stacks_allowed()
if _SECONDARY_AI_STACKS:
    app.include_router(streaming_router)
    print("[SERVER] Legacy /v2/chat/stream mounted (secondary AI stacks allowed)")
else:
    print(
        "[SERVER] Legacy /v2/chat/stream NOT mounted "
        "(ADR_0073 / GAP-P1-001 production strangler)"
    )

# NIOS v3 — Financial Intelligence Platform gateway (secondary; prod-gated)
if _SECONDARY_AI_STACKS:
    try:
        from ..nios.api import router as nios_router

        app.include_router(nios_router)
        print("[SERVER] NIOS v3 router mounted at /nios/v1")
    except Exception as _nios_exc:
        print(f"[SERVER] NIOS v3 unavailable: {_nios_exc}")
else:
    print(
        "[SERVER] NIOS v3 NOT mounted "
        "(ADR_0073 / GAP-P1-001 production strangler)"
    )

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

# Orbix v2 — secondary local reasoning agent (prod-gated; primary is OIP stream).
if _SECONDARY_AI_STACKS:
    try:
        from ..orbix.api import router as orbix_router

        app.include_router(orbix_router)
        print("[SERVER] Orbix v2 router mounted at /orbix/v2")
    except Exception as _orbix_exc:
        print(f"[SERVER] Orbix v2 unavailable: {_orbix_exc}")
else:
    print(
        "[SERVER] Orbix v2 NOT mounted "
        "(ADR_0073 / GAP-P1-001 production strangler)"
    )

# Orbix draft ack (Model B — Dexie posts, Python draft status sync)
try:
    from .orbix_drafts import router as orbix_drafts_router

    app.include_router(orbix_drafts_router)
    print("[SERVER] Orbix drafts router mounted at /orbix/drafts")
except Exception as _drafts_exc:
    print(f"[SERVER] Orbix drafts router unavailable: {_drafts_exc}")

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
    import os

    _is_render = os.getenv("RENDER", "").lower() == "true"

    if _is_render:
        print("[SERVER] Render deploy — skipping file watcher and Chroma ingest (OIP chat only)")
    else:
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
    if os.getenv("R2_STARTUP_VERIFY", "false").lower() in {"1", "true", "yes"}:
        try:
            from backend.storage import startup_verify_r2

            startup_verify_r2()
            print("[SERVER] R2 storage connection verified")
        except Exception as exc:
            print(f"[SERVER] R2 storage verification failed: {exc}")
            raise

    if not _is_render:
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
async def health() -> dict:
    """Lightweight readiness probe for deploy scripts."""
    from ..vectorstore.ca_knowledge_store import get_ca_knowledge_count
    from ..vectorstore.nlu_knowledge_store import get_nlu_knowledge_count
    from ..vectorstore.nepal_knowledge_store import get_nepal_knowledge_count

    if oip_chat_enabled():
        runtime = await provider_runtime_status_payload()
        return {
            "status": "online",
            "mode": runtime.get("mode", "oip"),
            "provider_runtime_enabled": runtime.get("provider_runtime_enabled", False),
            "provider_runtime_ready": runtime.get("provider_runtime_ready", False),
            "llm_ready": runtime.get("llm_ready", False),
            "configured_provider": runtime.get("configured_provider"),
            "default_model": runtime.get("default_model"),
            "resolved_provider": runtime.get("resolved_provider"),
            "provider_health": runtime.get("provider_health"),
            "indexed_files": chroma_store.get_indexed_file_count(),
            "nepal_knowledge_chunks": get_nepal_knowledge_count(),
            "ca_knowledge_chunks": get_ca_knowledge_count(),
            "nlu_knowledge_chunks": get_nlu_knowledge_count(),
        }

    ollama_ok = False
    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        ollama_ok = resp.status_code == 200
    except Exception:
        pass

    return {
        "status": "online",
        "mode": "legacy",
        "ollama": "connected" if ollama_ok else "unreachable",
        "khata_llm": ollama_ok,
        "indexed_files": chroma_store.get_indexed_file_count(),
        "nepal_knowledge_chunks": get_nepal_knowledge_count(),
        "ca_knowledge_chunks": get_ca_knowledge_count(),
        "nlu_knowledge_chunks": get_nlu_knowledge_count(),
        "model": MODEL_NAME,
    }


@app.get("/ready")
async def ready() -> dict:
    """Development readiness — distinguishes API vs provider vs Orbix pipeline."""
    payload: dict = {
        "status": "ready",
        "api": True,
        "database": True,
        "provider": False,
        "orbix_pipeline": False,
        "posting_authority": "dexie_local_first",
        "version": "phase4",
    }
    try:
        if oip_chat_enabled():
            runtime = await provider_runtime_status_payload()
            payload["provider"] = bool(
                runtime.get("llm_ready") or runtime.get("provider_runtime_ready")
            )
            payload["orbix_pipeline"] = bool(runtime.get("provider_runtime_enabled"))
            payload["force_stub_providers"] = runtime.get("force_stub_providers")
            payload["configured_provider"] = runtime.get("configured_provider")
            if not payload["provider"]:
                payload["status"] = "degraded"
        else:
            payload["status"] = "degraded"
            payload["orbix_pipeline"] = False
    except Exception as exc:
        payload["status"] = "degraded"
        payload["error"] = str(exc)[:200]
    return payload


@app.get("/status")
async def status() -> dict:
    if oip_chat_enabled():
        runtime = await provider_runtime_status_payload()
        runtime.update(
            {
                "erp_path": str(ERP_PATH),
                "indexed_files": chroma_store.get_indexed_file_count(),
                "watcher": "active",
                "embed_model": EMBED_MODEL,
            }
        )
        return runtime

    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=10)
        resp.raise_for_status()
        ollama_status = "connected"
    except Exception:
        ollama_status = "unreachable"

    return {
        "status": "online",
        "mode": "legacy",
        "model": CONVERSATIONAL_MODEL,
        "conversational_model": CONVERSATIONAL_MODEL,
        "fast_model": FAST_MODEL,
        "embed_model": EMBED_MODEL,
        "erp_path": str(ERP_PATH),
        "indexed_files": chroma_store.get_indexed_file_count(),
        "ollama": ollama_status,
        "watcher": "active",
        "khata_llm": ollama_status == "connected",
        "llm_ready": ollama_status == "connected",
        "conversation_memory": True,
        "streaming": True,
        "orbix_qwen_stream": True,
        "stack": "legacy ollama stack (offline/tests only)",
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    """Standard chat endpoint — OIP kernel when enabled, legacy agent offline/tests only."""
    try:
        if not req.message.strip():
            return ChatResponse(
                answer="Message cannot be empty.",
                sources=[],
                session_id=req.session_id,
            )

        if oip_chat_enabled():
            response = await submit_chat(req.message, req.session_id)
            text, card, route_info = map_response_to_orbix(response)
            route = RouteInfo(**route_info) if route_info else None
            return ChatResponse(
                answer=text or "No response generated.",
                sources=[],
                session_id=req.session_id,
                route=route,
                card=card,
            )

        # Legacy offline/tests path
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

        if CACHE_ENABLED:
            from .cache import get_response_cache

            get_response_cache().put(
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
            card=result.get("card"),
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
    orbix_mode: str | None = Field(
        default=None,
        description="Operating mode: 'ask' (read-only) or 'accountant' (authorized mutations).",
    )
    conversation_id: str | None = None
    tenant_id: str | None = None
    company_id: str | None = None
    user_id: str | None = None
    request_id: str | None = None


def _merge_stream_context(req: "StreamChatRequest") -> dict:
    ctx = dict(req.context or {})
    if req.tenant_id:
        ctx.setdefault("tenant_id", req.tenant_id)
    if req.company_id:
        ctx.setdefault("company_id", req.company_id)
    if req.user_id:
        ctx.setdefault("user_id", req.user_id)
    if req.conversation_id:
        ctx.setdefault("conversation_id", req.conversation_id)
    if req.request_id:
        ctx.setdefault("request_id", req.request_id)
    if req.orbix_mode:
        ctx["orbix_mode"] = req.orbix_mode
    return ctx


@app.post("/chat/stream")
async def chat_stream(req: StreamChatRequest):
    """Streaming chat — OIP kernel when enabled, legacy agent for offline/tests."""
    if not req.message.strip():
        async def empty_response():
            yield "data: Message cannot be empty.\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(empty_response(), media_type="text/event-stream")

    if oip_chat_enabled():
        async def generate_oip():
            try:
                ctx = _merge_stream_context(req)
                response = await submit_chat(
                    req.message,
                    req.session_id,
                    context=ctx,
                    orbix_mode=req.orbix_mode,
                )
                text, _, _ = map_response_to_orbix(response)
                if text:
                    safe_chunk = text.replace("\n", "\\n")
                    yield f"data: {safe_chunk}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as exc:
                yield f"data: Error: {exc}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(generate_oip(), media_type="text/event-stream")

    history = agent_builder.get_session_history(req.session_id)
    agent_builder.add_to_history(req.session_id, "user", req.message)

    collected_response: list[str] = []

    async def generate():
        try:
            async for chunk in agent_builder.run_agent_stream(req.message, history):
                if chunk:
                    collected_response.append(chunk)
                    safe_chunk = chunk.replace("\n", "\\n")
                    yield f"data: {safe_chunk}\n\n"

            full_response = strip_reasoning("".join(collected_response))
            agent_builder.add_to_history(req.session_id, "assistant", full_response)

            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: Error: {e}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


def _sse_json(data: dict) -> str:
    return sse_json(data)


@app.post("/orbix/chat/stream")
async def orbix_chat_stream(
    req: StreamChatRequest,
    request: Request,
    authorization: str | None = Header(default=None),
):
    """Orbix chat stream — canonical ingress via IntelligenceKernelFacade."""
    # Bind verified JWT/API principal when present (MAI-01).
    try:
        from ..oip.infrastructure.di.container import get_container
        from ..oip.infrastructure.security.session_context import bind_principal
        from ..oip.infrastructure.security.jwt_service import JwtAuthError
        from ..oip.infrastructure.security.api_key_service import ApiKeyAuthError

        container = await get_container()
        api_key = request.headers.get("x-api-key") or request.headers.get("x-oip-api-key")
        if api_key:
            try:
                principal = await container.api_key_service.validate_api_key(api_key)
                bind_principal(principal)
            except ApiKeyAuthError:
                pass
        elif authorization and authorization.lower().startswith("bearer "):
            token = authorization.split(" ", 1)[1].strip()
            try:
                principal = await container.jwt_service.verify_access_token(token)
                bind_principal(principal)
            except JwtAuthError:
                from ..oip.config.settings import get_oip_settings

                if get_oip_settings().auth_required:
                    async def auth_error():
                        yield _sse_json(
                            {
                                "type": "error",
                                "message": "Authentication required.",
                                "error": {"type": "AUTHENTICATION_REQUIRED"},
                            }
                        )

                    return StreamingResponse(
                        auth_error(),
                        media_type="text/event-stream",
                        headers={
                            "Cache-Control": "no-cache",
                            "Connection": "keep-alive",
                            "X-Accel-Buffering": "no",
                        },
                    )
    except Exception:
        from ..oip.config.settings import get_oip_settings

        if get_oip_settings().auth_required:
            async def auth_unavailable():
                yield _sse_json(
                    {
                        "type": "error",
                        "message": "Authentication required.",
                        "error": {"type": "AUTHENTICATION_REQUIRED"},
                    }
                )

            return StreamingResponse(
                auth_unavailable(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

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

    # Validate mode early — invalid values never grant write access
    from ..orbix.mode_policy import ModeValidationError, normalize_orbix_mode

    try:
        resolved_mode = normalize_orbix_mode(req.orbix_mode, invalid_policy="error")
    except ModeValidationError as exc:
        async def invalid_mode():
            yield _sse_json(
                {
                    "type": "error",
                    "message": str(exc),
                    "error": {"type": "validation_error", "fields": ["orbix_mode"]},
                }
            )
        return StreamingResponse(
            invalid_mode(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    ctx = _merge_stream_context(req)
    ctx["orbix_mode"] = resolved_mode
    if req.context:
        set_session_context(req.session_id, ctx)

    from ..oip.infrastructure.observability import mai03 as mai03_obs

    trace_ctx = mai03_obs.start_request_trace(
        headers=request.headers,
        conversation_id=req.session_id,
        route="/orbix/chat/stream",
    )

    async def generate():
        try:
            if oip_chat_enabled():
                response = await submit_chat(
                    req.message,
                    req.session_id,
                    context=ctx,
                    orbix_mode=resolved_mode,
                    headers=request.headers,
                )
                async for event in stream_orbix_kernel_events(
                    response, user_message=req.message
                ):
                    yield event
                return

            # Legacy offline/tests path
            history = agent_builder.get_session_history(req.session_id)
            agent_builder.add_to_history(req.session_id, "user", req.message)
            yield _sse_json(
                {
                    "type": "request_accepted",
                    "trace_reference": trace_ctx.trace_reference,
                    "request_id": trace_ctx.request_id,
                }
            )
            yield _sse_json({"type": "thinking_start"})
            full_message = ""
            card = None
            route_info = None
            async for event in agent_builder.run_routed_agent_stream(
                req.message,
                history,
                session_id=req.session_id,
                context=ctx,
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

            # Ask mode must never return a mutation card on legacy path
            if resolved_mode == "ask":
                card = None

            agent_builder.add_to_history(req.session_id, "assistant", full_message)
            yield _sse_json({"type": "thinking_done"})
            yield _sse_json(
                {
                    "type": "complete",
                    "message": full_message,
                    "card": card,
                    "route": route_info,
                    "action": "confirm" if card else "chat",
                    "orbix_mode": resolved_mode,
                    "trace_reference": trace_ctx.trace_reference,
                }
            )
            mai03_obs.get_trace_recorder().record_event(
                mai03_obs.TraceStage.REQUEST_COMPLETED,
                mai03_obs.TraceStatus.COMPLETED,
                outcome_code="LEGACY_OK",
            )
        except Exception:
            yield _sse_json(
                {
                    "type": "error",
                    "message": "An unexpected error occurred.",
                    "error": {"type": "general_error"},
                    "trace_reference": trace_ctx.trace_reference,
                }
            )
            try:
                mai03_obs.get_trace_recorder().record_event(
                    mai03_obs.TraceStage.REQUEST_FAILED,
                    mai03_obs.TraceStatus.FAILED,
                    safe_error_code="UNEXPECTED_ERROR",
                )
            except Exception:
                pass
        finally:
            mai03_obs.clear_trace_context()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Correlation-ID": trace_ctx.correlation_id,
            "X-Request-ID": trace_ctx.request_id,
            "X-Trace-Reference": trace_ctx.trace_reference,
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
    """e-Khata v2 — conversation manager with reasoner + confirmation flow.

    Secondary stack: denied in production unless break-glass
    MOKXYA_ALLOW_SECONDARY_AI_STACKS=true (ADR_0073 / GAP-P1-001).
    """
    if not secondary_ai_stacks_allowed():
        raise HTTPException(
            status_code=403,
            detail=secondary_stack_denial_payload("LEGACY_V2_CHAT"),
        )
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
