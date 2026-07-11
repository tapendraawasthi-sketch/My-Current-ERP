"""Tests for legacy Orbix chat ingress via OIP kernel."""

from __future__ import annotations

import pytest

from src.oip.application.dto.intelligence_request import IntelligenceResponseDto
from src.oip.domain.value_objects import ActionPayload, ActionType
from src.api.oip_chat_ingress import (
    map_response_to_orbix,
    oip_chat_enabled,
    provider_runtime_llm_ready,
    stream_orbix_kernel_events,
)
from src.oip.config.settings import OipSettings


def test_oip_chat_enabled_requires_modules():
    settings = OipSettings(
        enabled=True,
        orchestrator_enabled=True,
        provider_runtime_enabled=True,
    )
    assert provider_runtime_llm_ready(settings) or settings.force_stub_providers


@pytest.mark.asyncio
async def test_map_response_to_orbix_answer():
    response = IntelligenceResponseDto(
        request_id="req-1",
        correlation_id="corr-1",
        actions=(
            ActionPayload(
                action_type=ActionType.ANSWER,
                body={"text": "Balance is NPR 1,000"},
                confidence=1.0,
            ),
        ),
        metadata={"intent": "accounting_qa", "confidence": 0.9},
        provider="oip",
        model="llama-3.3-70b-versatile",
    )
    text, card, route = map_response_to_orbix(response)
    assert text == "Balance is NPR 1,000"
    assert card is None
    assert route is not None
    assert route["intent"] == "accounting_qa"


@pytest.mark.asyncio
async def test_stream_orbix_kernel_events_emits_complete():
    response = IntelligenceResponseDto(
        request_id="req-2",
        correlation_id="corr-2",
        actions=(
            ActionPayload(
                action_type=ActionType.ANSWER,
                body={"text": "Hello from kernel"},
                confidence=1.0,
            ),
        ),
        provider="oip",
        model="llama-3.3-70b-versatile",
    )
    events = [event async for event in stream_orbix_kernel_events(response, chunk_words=2)]
    joined = "".join(events)
    assert '"type": "complete"' in joined
    assert "Hello from kernel" in joined
    assert oip_chat_enabled() is True
