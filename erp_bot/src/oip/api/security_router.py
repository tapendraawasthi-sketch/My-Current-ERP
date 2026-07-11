"""Authentication endpoints — token issue, refresh, revoke."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..infrastructure.di.container import get_container
from ..infrastructure.security.jwt_service import JwtAuthError
from ..infrastructure.security.session_context import current_principal
from .dependencies import get_optional_principal, require_authenticated_principal

router = APIRouter(prefix="/auth", tags=["oip-security"])


class TokenRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    tenant_id: str = Field(..., min_length=1)
    company_id: str = Field(..., min_length=1)
    role: str = Field(default="accountant")
    session_id: str = Field(default="")
    username: str = ""


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10)


class RevokeRequest(BaseModel):
    access_token: str = Field(..., min_length=10)


@router.post("/token")
async def issue_token(req: TokenRequest) -> dict[str, Any]:
    container = await get_container()
    session_id = req.session_id or f"sess-{req.user_id[:8]}"
    access = container.jwt_service.issue_access_token(
        user_id=req.user_id,
        tenant_id=req.tenant_id,
        company_id=req.company_id,
        role=req.role,
        session_id=session_id,
        username=req.username or req.user_id,
    )
    refresh = await container.jwt_service.issue_refresh_token(
        user_id=req.user_id,
        tenant_id=req.tenant_id,
        company_id=req.company_id,
        role=req.role,
        session_id=session_id,
        username=req.username or req.user_id,
    )
    return {"access_token": access, "refresh_token": refresh, "token_type": "Bearer"}


@router.post("/refresh")
async def refresh_token(req: RefreshRequest) -> dict[str, Any]:
    container = await get_container()
    try:
        access, refresh = await container.jwt_service.refresh_access_token(req.refresh_token)
    except JwtAuthError as exc:
        await container.security_event_service.auth_failure(reason=str(exc))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    principal = current_principal()
    if principal:
        await container.security_event_service.token_refresh(
            user_id=principal.user_id,
            tenant_id=principal.tenant_id,
        )
    return {"access_token": access, "refresh_token": refresh, "token_type": "Bearer"}


@router.post("/revoke")
async def revoke_token(
    req: RevokeRequest,
    _principal=Depends(require_authenticated_principal),
) -> dict[str, str]:
    container = await get_container()
    await container.jwt_service.revoke_access_token(req.access_token, reason="user_revoked")
    return {"status": "revoked"}


@router.get("/me")
async def current_user(principal=Depends(get_optional_principal)) -> dict[str, Any]:
    if principal is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication_required")
    return {
        "user_id": principal.user_id,
        "tenant_id": principal.tenant_id,
        "company_id": principal.company_id,
        "role": principal.role,
        "permissions": list(principal.permissions),
        "auth_method": principal.auth_method.value,
    }
