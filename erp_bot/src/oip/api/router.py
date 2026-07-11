"""OIP HTTP API — constitutional ingress with production security."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..application.dto.intelligence_request import IntelligenceRequestDto
from ..infrastructure.di.container import get_container
from ..infrastructure.security.session_context import bind_principal
from ..infrastructure.security.tenant_guard import resolve_company_id, resolve_tenant_id, resolve_user_id
from ..modules.conversation.application.queries import GetConversationHistoryQuery
from ..modules.planner.api.router import router as planner_router
from ..modules.router.api.router import providers_router, router as router_api_router
from ..modules.provider_runtime.api.router import router as provider_runtime_router
from ..modules.quality_gate.api.router import router as quality_gate_router
from ..modules.action_runtime.api.router import router as action_runtime_router
from ..modules.streaming_runtime.api.router import router as streaming_runtime_router, ws_router as streaming_ws_router
from ..modules.orchestrator.api.router import router as orchestrator_router
from ..modules.knowledge.api.router import router as knowledge_router
from ..modules.memory.api.router import router as memory_router
from ..modules.oec_runtime.api.router import router as oec_router
from ..shared.ids import ConversationId, TenantId, new_correlation_id, new_request_id
from .dependencies import (
    enforce_rate_limit,
    enforce_tenancy,
    get_optional_principal,
    require_authenticated_principal,
    require_permission,
)
from .ops_router import router as ops_router
from .security_router import router as security_router

router = APIRouter(
    prefix="/oip/v1",
    tags=["oip"],
    dependencies=[
        Depends(enforce_rate_limit),
        Depends(enforce_tenancy),
    ],
)
router.include_router(security_router)
router.include_router(ops_router)
router.include_router(planner_router, dependencies=[Depends(require_authenticated_principal)])
router.include_router(router_api_router, dependencies=[Depends(require_authenticated_principal)])
router.include_router(providers_router, dependencies=[Depends(require_authenticated_principal)])
router.include_router(provider_runtime_router, dependencies=[Depends(require_authenticated_principal)])
router.include_router(quality_gate_router, dependencies=[Depends(require_authenticated_principal)])
router.include_router(action_runtime_router, dependencies=[Depends(require_authenticated_principal)])
router.include_router(streaming_runtime_router, dependencies=[Depends(require_authenticated_principal)])
router.include_router(streaming_ws_router, dependencies=[Depends(require_authenticated_principal)])
router.include_router(orchestrator_router, dependencies=[Depends(require_authenticated_principal)])
router.include_router(knowledge_router, dependencies=[Depends(require_authenticated_principal)])
router.include_router(memory_router, dependencies=[Depends(require_authenticated_principal)])
router.include_router(oec_router, dependencies=[Depends(require_authenticated_principal)])


class OipChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str = Field(..., min_length=1)
    tenant_id: str | None = None
    company_id: str | None = None
    branch_id: str | None = None
    user_id: str | None = None
    module: str = Field(default="orbix")
    language: str | None = None
    idempotency_key: str = ""


@router.get("/health")
async def health() -> dict[str, Any]:
    container = await get_container()
    return await container.kernel.health()


@router.post("/intelligence/submit", dependencies=[Depends(require_permission("oip:intelligence:submit"))])
async def submit_intelligence(
    req: OipChatRequest,
    principal=Depends(get_optional_principal),
) -> dict[str, Any]:
    container = await get_container()
    if principal is not None:
        bind_principal(principal)
    request_id = str(new_request_id())
    correlation_id = str(new_correlation_id())
    dto = IntelligenceRequestDto(
        request_id=request_id,
        correlation_id=correlation_id,
        idempotency_key=req.idempotency_key or request_id,
        tenant_id=resolve_tenant_id(req.tenant_id),
        company_id=resolve_company_id(req.company_id),
        branch_id=req.branch_id,
        user_id=resolve_user_id(req.user_id),
        session_id=req.session_id,
        conversation_id=req.session_id,
        module=req.module,
        language=req.language,
        question=req.message,
    )
    response = await container.kernel.submit(dto)
    return response.model_dump(mode="json")


@router.get("/conversations/{conversation_id}", dependencies=[Depends(require_permission("oip:read"))])
async def get_conversation(
    conversation_id: str,
    tenant_id: str | None = None,
    principal=Depends(get_optional_principal),
) -> dict[str, Any]:
    if principal is not None:
        bind_principal(principal)
    container = await get_container()
    from ..modules.conversation.application.queries import GetConversationQuery

    resolved_tenant = resolve_tenant_id(tenant_id)
    conversation = await container.query_bus.dispatch(
        GetConversationQuery(
            tenant_id=TenantId(resolved_tenant),
            conversation_id=ConversationId(conversation_id),
        )
    )
    return {"conversation": conversation}


@router.get("/conversations/{conversation_id}/history", dependencies=[Depends(require_permission("oip:read"))])
async def get_conversation_history(
    conversation_id: str,
    tenant_id: str | None = None,
    limit: int = 100,
    after_sequence: int = 0,
    principal=Depends(get_optional_principal),
) -> dict[str, Any]:
    if principal is not None:
        bind_principal(principal)
    container = await get_container()
    resolved_tenant = resolve_tenant_id(tenant_id)
    header = await container.conversation_service.get_conversation(
        tenant_id=resolved_tenant,
        conversation_id=conversation_id,
    )
    if header is None:
        return {"conversation_id": conversation_id, "conversation": None, "messages": []}
    messages = await container.query_bus.dispatch(
        GetConversationHistoryQuery(
            tenant_id=TenantId(resolved_tenant),
            conversation_id=ConversationId(conversation_id),
            limit=limit,
            after_sequence=after_sequence,
        )
    )
    return {
        "conversation": header.model_dump(mode="json"),
        "messages": messages,
    }
