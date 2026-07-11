"""Legacy Orbix chat ingress — canonical path through IntelligenceKernelFacade."""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

from ..oip.application.dto.intelligence_request import IntelligenceRequestDto, IntelligenceResponseDto
from ..oip.config.settings import OipSettings, get_oip_settings
from ..oip.domain.value_objects import ActionType
from ..oip.infrastructure.di.container import get_container
from ..oip.modules.router.application.queries import GetProviderHealthQuery
from ..oip.shared.ids import TenantId, new_correlation_id, new_request_id


def oip_chat_enabled() -> bool:
    settings = get_oip_settings()
    return settings.enabled and settings.orchestrator_enabled and settings.provider_runtime_enabled


def provider_runtime_active(settings: OipSettings | None = None) -> bool:
    """True when production should not depend on a local Ollama daemon."""
    cfg = settings or get_oip_settings()
    return cfg.enabled and cfg.provider_runtime_enabled


def provider_runtime_llm_ready(settings: OipSettings | None = None) -> bool:
    cfg = settings or get_oip_settings()
    if not provider_runtime_active(cfg):
        return False
    if cfg.provider_offline_mode:
        return False
    if cfg.force_stub_providers:
        return True
    return bool(
        cfg.openai_api_key
        or cfg.anthropic_api_key
        or cfg.google_api_key
        or cfg.groq_api_key
        or cfg.ollama_base_url
    )


async def build_intelligence_request(
    *,
    message: str,
    session_id: str,
    context: dict[str, Any] | None = None,
    module: str = "orbix",
    language: str | None = None,
) -> IntelligenceRequestDto:
    settings = get_oip_settings()
    request_id = str(new_request_id())
    correlation_id = str(new_correlation_id())
    metadata: dict[str, Any] = {}
    if context:
        metadata["client_context"] = context
    company_id = settings.default_service_company_id or "company-a"
    return IntelligenceRequestDto(
        request_id=request_id,
        correlation_id=correlation_id,
        idempotency_key=request_id,
        tenant_id=settings.default_service_tenant_id,
        company_id=company_id,
        user_id="orbix-user",
        session_id=session_id,
        conversation_id=session_id,
        module=module,
        language=language,
        question=message,
        metadata=metadata,
    )


async def submit_chat(message: str, session_id: str, *, context: dict[str, Any] | None = None) -> IntelligenceResponseDto:
    container = await get_container()
    request = await build_intelligence_request(message=message, session_id=session_id, context=context)
    return await container.kernel.submit(request)


def map_response_to_orbix(
    response: IntelligenceResponseDto,
) -> tuple[str, dict[str, Any] | None, dict[str, Any] | None]:
    text = ""
    card: dict[str, Any] | None = None
    for action in response.actions:
        if action.action_type == ActionType.ANSWER:
            text = str(action.body.get("text") or text)
        elif action.action_type == ActionType.CLARIFICATION:
            text = str(action.body.get("text") or text)
        elif action.action_type == ActionType.JOURNAL_ENTRY and action.requires_confirmation:
            card = dict(action.body)
    metadata = dict(response.metadata or {})
    route_info: dict[str, Any] | None = None
    if metadata.get("intent") or metadata.get("routing_policy"):
        route_info = {
            "intent": metadata.get("intent", "general_qa"),
            "confidence": float(metadata.get("confidence", 0.85)),
            "method": "oip",
            "reasoning": metadata.get("reasoning"),
        }
    if not text and metadata.get("text"):
        text = str(metadata["text"])
    return text.strip(), card, route_info


def sse_json(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, default=str)}\n\n"


async def stream_orbix_kernel_events(
    response: IntelligenceResponseDto,
    *,
    chunk_words: int = 3,
) -> AsyncIterator[str]:
    yield sse_json({"type": "thinking_start"})
    text, card, route_info = map_response_to_orbix(response)
    if route_info:
        yield sse_json({"type": "route", "route": route_info})
    if text:
        words = text.split()
        for index in range(0, len(words), chunk_words):
            token = " ".join(words[index : index + chunk_words])
            if index + chunk_words < len(words):
                token += " "
            yield sse_json({"type": "token", "content": token})
    yield sse_json({"type": "thinking_done"})
    yield sse_json(
        {
            "type": "complete",
            "message": text,
            "card": card,
            "route": route_info,
            "action": "confirm" if card else "chat",
            "provider": response.provider or response.metadata.get("provider_id"),
            "model": response.model,
            "provider_runtime": True,
        }
    )


async def provider_runtime_status_payload() -> dict[str, Any]:
    settings = get_oip_settings()
    enabled = provider_runtime_active(settings)
    llm_ready = provider_runtime_llm_ready(settings)
    payload: dict[str, Any] = {
        "status": "online",
        "mode": "oip" if enabled else "legacy",
        "stack": "oip kernel → orchestrator → provider runtime",
        "provider_runtime_enabled": enabled,
        "provider_runtime_ready": llm_ready,
        "llm_ready": llm_ready,
        "khata_llm": llm_ready,
        "force_stub_providers": settings.force_stub_providers,
        "configured_provider": settings.default_provider or None,
        "default_model": settings.default_model or None,
        "streaming": True,
        "conversation_memory": True,
        "orbix_kernel_stream": enabled,
    }
    if not enabled:
        payload["llm_ready"] = False
        payload["khata_llm"] = False
        return payload

    try:
        container = await get_container()
        kernel_health = await container.kernel.health()
        payload["kernel"] = kernel_health
        provider_id = settings.default_provider or None
        if provider_id:
            health = await container.query_bus.dispatch(
                GetProviderHealthQuery(
                    tenant_id=TenantId(settings.default_service_tenant_id),
                    provider_id=provider_id,
                )
            )
            payload["provider_health"] = health
            provider_record = health.get("health") or {}
            payload["resolved_provider"] = provider_id
            payload["provider_availability"] = provider_record.get("availability")
            payload["provider_circuit_state"] = provider_record.get("circuit_state")
    except Exception as exc:  # noqa: BLE001
        payload["provider_runtime_ready"] = False
        payload["llm_ready"] = False
        payload["khata_llm"] = False
        payload["provider_runtime_error"] = str(exc)
    return payload
