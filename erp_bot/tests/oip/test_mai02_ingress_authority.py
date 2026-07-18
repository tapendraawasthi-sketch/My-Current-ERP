"""MAI-02 closure: CanonicalAIRequestV1 is authoritative before orchestrator."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.api.oip_chat_ingress import (
    build_canonical_ai_request,
    build_intelligence_request,
    stream_orbix_kernel_events,
    submit_chat,
)
from src.oip.application.dto.intelligence_request import IntelligenceRequestDto, IntelligenceResponseDto
from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import CanonicalAIRequestV1, InteractionModeV1
from src.oip.domain.value_objects import ActionPayload, ActionType
from src.oip.shared.exceptions import OipForbiddenError


def _trusted_principal(**kwargs: Any) -> MagicMock:
    p = MagicMock()
    p.principal_id = kwargs.get("principal_id", "user-real")
    p.tenant_id = kwargs.get("tenant_id", "tenant-real")
    p.active_company_id = kwargs.get("company_id", "company-real")
    p.allows_company = lambda cid: cid in {p.active_company_id, "company-real"}
    p.authentication_method = "jwt"
    p.roles = ("accountant",)
    p.permissions = ("oip:read",)
    return p


@pytest.mark.asyncio
async def test_build_canonical_before_dto_and_identity_from_trusted_scope():
    trusted = _trusted_principal()
    with patch(
        "src.oip.domain.constitution.enforcement.enforce_chat_identity_and_mode",
        return_value=(trusted, None),
    ):
        canonical = await build_canonical_ai_request(
            message="मेरो cash balance कति?",
            session_id="sess-ne-1",
            context={"tenant_id": "spoof-tenant", "company_id": "spoof-co", "principal_id": "attacker"},
            orbix_mode="ask",
        )
    assert isinstance(canonical, CanonicalAIRequestV1)
    assert canonical.raw_text == "मेरो cash balance कति?"
    assert canonical.trusted_scope.principal_id == "user-real"
    assert canonical.trusted_scope.tenant_id == "tenant-real"
    assert "attacker" not in canonical.trusted_scope.principal_id
    assert canonical.mode is InteractionModeV1.ASK

    dto = CanonicalOipRequestAdapter().to_intelligence_dto(canonical, module="orbix")
    assert dto.question == canonical.raw_text
    assert dto.tenant_id == "tenant-real"
    assert dto.user_id == "user-real"
    assert dto.request_id == canonical.request_id
    assert dto.correlation_id == canonical.correlation_id
    assert dto.conversation_id == canonical.conversation_id
    assert (dto.metadata or {}).get("contract_authority") == "CanonicalAIRequestV1"
    # Not a passive full-canonical metadata sidecar
    assert "canonical_ai_request" not in (dto.metadata or {})


@pytest.mark.asyncio
async def test_body_identity_cannot_override_trusted_scope_in_dto():
    trusted = _trusted_principal()
    with patch(
        "src.oip.domain.constitution.enforcement.enforce_chat_identity_and_mode",
        return_value=(trusted, None),
    ):
        dto = await build_intelligence_request(
            message="hello",
            session_id="s1",
            context={
                "tenant_id": "evil-tenant",
                "roles": ["admin"],
                "permissions": ["erp:command:execute"],
                "execution_allowed": True,
                "principal_id": "evil",
            },
            orbix_mode="accountant",
        )
    assert dto.tenant_id == "tenant-real"
    assert dto.user_id == "user-real"
    assert "execution_allowed" not in (dto.metadata or {})
    assert (dto.metadata or {}).get("orbix_mode") == "accountant"


@pytest.mark.asyncio
async def test_unsupported_schema_never_reaches_orchestrator():
    trusted = _trusted_principal()
    with patch(
        "src.oip.domain.constitution.enforcement.enforce_chat_identity_and_mode",
        return_value=(trusted, None),
    ):
        with pytest.raises(OipForbiddenError):
            await build_canonical_ai_request(
                message="hi",
                session_id="s1",
                schema_version="99.0.0",
            )


@pytest.mark.asyncio
async def test_empty_message_never_reaches_orchestrator():
    trusted = _trusted_principal()
    with patch(
        "src.oip.domain.constitution.enforcement.enforce_chat_identity_and_mode",
        return_value=(trusted, None),
    ):
        with pytest.raises(OipForbiddenError):
            await build_canonical_ai_request(message="   ", session_id="s1")


@pytest.mark.asyncio
async def test_submit_chat_passes_dto_originating_from_canonical(monkeypatch: pytest.MonkeyPatch):
    trusted = _trusted_principal()
    captured: dict[str, Any] = {}

    async def fake_submit(dto: IntelligenceRequestDto) -> IntelligenceResponseDto:
        captured["dto"] = dto
        return IntelligenceResponseDto(
            request_id=dto.request_id,
            correlation_id=dto.correlation_id,
            actions=(
                ActionPayload(action_type=ActionType.ANSWER, body={"text": "ok"}, confidence=1.0),
            ),
            metadata=dict(dto.metadata or {}),
        )

    kernel = MagicMock()
    kernel.submit = AsyncMock(side_effect=fake_submit)
    container = MagicMock()
    container.kernel = kernel

    async def fake_container():
        return container

    monkeypatch.setattr("src.api.oip_chat_ingress.get_container", fake_container)
    with patch(
        "src.oip.domain.constitution.enforcement.enforce_chat_identity_and_mode",
        return_value=(trusted, None),
    ):
        result = await submit_chat(
            "Romanized: kati cha balance?",
            "conv-rome-1",
            context={"tenant_id": "spoof"},
            orbix_mode="ask",
        )
    dto = captured["dto"]
    assert isinstance(dto, IntelligenceRequestDto)
    assert dto.question == "Romanized: kati cha balance?"
    assert dto.tenant_id == "tenant-real"
    assert (dto.metadata or {}).get("contract_authority") == "CanonicalAIRequestV1"
    assert result.request_id == dto.request_id
    kernel.submit.assert_awaited_once()


@pytest.mark.asyncio
async def test_dto_cannot_be_built_without_canonical_instance():
    with pytest.raises(Exception):
        CanonicalOipRequestAdapter().to_intelligence_dto(  # type: ignore[arg-type]
            {"request_id": "x"},  # not CanonicalAIRequestV1
            module="orbix",
        )


@pytest.mark.asyncio
async def test_stream_complete_is_mai02_validated():
    response = IntelligenceResponseDto(
        request_id="req-stream-1",
        correlation_id="corr-1",
        actions=(
            ActionPayload(action_type=ActionType.ANSWER, body={"text": "Hello नेपाली"}, confidence=1.0),
        ),
        metadata={
            "orbix_mode": "ask",
            "conversation_id": "conv-1",
            "egress_scope_ref": {
                "principal_id": "user-real",
                "tenant_id": "tenant-real",
                "company_id": "company-real",
                "authentication_method": "jwt",
                "policy_version": "mai-01.1.0",
            },
        },
        provider="oip",
        model="stub",
    )
    events = [e async for e in stream_orbix_kernel_events(response, chunk_words=10)]
    joined = "".join(events)
    assert '"type": "complete"' in joined
    assert '"mai02_validated": true' in joined
    complete_lines = [e for e in events if '"type": "complete"' in e]
    payload = json.loads(complete_lines[-1].removeprefix("data: ").strip())
    assert "नेपाली" in payload["message"]
    assert payload.get("execution_allowed") is None



@pytest.mark.asyncio
async def test_stream_strips_model_execution_allowed_nested():
    response = IntelligenceResponseDto(
        request_id="req-stream-2",
        correlation_id="corr-2",
        actions=(
            ActionPayload(action_type=ActionType.ANSWER, body={"text": "x"}, confidence=1.0),
        ),
        metadata={
            "conversation_id": "c2",
            "error": {"type": "clarification_required", "execution_allowed": True, "draft_id": "d1", "missing_fields": ["q"]},
            "egress_scope_ref": {
                "principal_id": "u",
                "tenant_id": "t",
                "authentication_method": "jwt",
            },
        },
    )
    events = [e async for e in stream_orbix_kernel_events(response)]
    complete_lines = [e for e in events if '"type": "complete"' in e]
    assert complete_lines
    payload = json.loads(complete_lines[-1].removeprefix("data: ").strip())
    err = payload.get("error") or {}
    assert err.get("execution_allowed") is None or err.get("execution_allowed") is False
    assert payload.get("mai02_validated") is True


@pytest.mark.asyncio
async def test_ids_and_unicode_survive_adapter_roundtrip():
    trusted = _trusted_principal()
    text = "सूर्य ट्रेडर्स बाट ५ maina rice — NPR १२००"
    with patch(
        "src.oip.domain.constitution.enforcement.enforce_chat_identity_and_mode",
        return_value=(trusted, None),
    ):
        canonical = await build_canonical_ai_request(
            message=text,
            session_id="sess-unicode",
            language="ne",
            orbix_mode="ask",
        )
        dto = CanonicalOipRequestAdapter().to_intelligence_dto(canonical, module="orbix")
    assert canonical.raw_text == text
    assert dto.question == text
    assert dto.session_id == canonical.conversation_id
    assert dto.request_id == canonical.request_id
    assert dto.correlation_id == canonical.correlation_id
    assert dto.language == "ne"
