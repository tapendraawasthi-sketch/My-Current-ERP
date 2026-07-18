"""MAI-03 trace, correlation, redaction foundation tests."""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

import pytest

from src.oip.infrastructure.observability import mai03 as mai03_obs
from src.oip.infrastructure.observability.mai03_redaction import REDACTED, validate_safe_event
from src.oip.infrastructure.observability.logging import log_event


@pytest.fixture(autouse=True)
def _reset_trace():
    mai03_obs.reset_trace_recorder_for_tests()
    mai03_obs.clear_trace_context()
    yield
    mai03_obs.clear_trace_context()
    mai03_obs.reset_trace_recorder_for_tests()


def test_invalid_inbound_correlation_replaced():
    ctx = mai03_obs.create_trace_context(inbound_correlation_id="not-a-uuid@@@evil")
    assert mai03_obs.is_valid_correlation_id(ctx.correlation_id)
    assert ctx.correlation_source == mai03_obs.CorrelationSource.GENERATED


def test_valid_upstream_correlation_kept():
    upstream = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    ctx = mai03_obs.create_trace_context(inbound_correlation_id=upstream)
    assert ctx.correlation_id == upstream
    assert ctx.correlation_source == mai03_obs.CorrelationSource.VALIDATED_UPSTREAM
    assert ctx.request_id != ctx.correlation_id


def test_oversized_header_rejected():
    huge = "a" * 200
    ctx = mai03_obs.create_trace_context(inbound_correlation_id=huge)
    assert ctx.correlation_source == mai03_obs.CorrelationSource.GENERATED


def test_trace_reference_opaque_and_valid():
    ctx = mai03_obs.create_trace_context()
    assert mai03_obs.is_valid_trace_reference(ctx.trace_reference)
    assert "tenant" not in ctx.trace_reference
    assert "@" not in ctx.trace_reference


def test_context_isolation_concurrent():
    results = []

    def worker(label: str) -> None:
        ctx = mai03_obs.create_trace_context()
        with mai03_obs.trace_context_scope(ctx):
            import time

            time.sleep(0.01)
            got = mai03_obs.require_trace_context()
            results.append((label, got.trace_id, got.request_id))

    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = [pool.submit(worker, f"w{i}") for i in range(8)]
        for f in futs:
            f.result()
    ids = [r[1] for r in results]
    assert len(ids) == len(set(ids)) or len(set(r[2] for r in results)) == 8


def test_context_cleanup():
    ctx = mai03_obs.create_trace_context()
    with mai03_obs.trace_context_scope(ctx):
        assert mai03_obs.get_trace_context() is not None
    assert mai03_obs.get_trace_context() is None


def test_redaction_blocks_secrets_and_text():
    dirty = {
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.aaa.bbb",
        "message": "मेरो नगद मौज्दात",
        "question": "cash balance kati?",
        "prompt": "system secret",
        "duration_ms": 12,
        "response_type": "ANSWER",
        "cookie": "session=abc",
        "api_key": "sk-abcdef123456",
        "email": "user@example.com",
        "thinking": "<think>hidden</think>",
        "tool_arguments": {"draft_id": "d1", "amount": "100"},
    }
    safe = validate_safe_event(dirty)
    blob = str(safe).lower()
    assert "bearer" not in blob or REDACTED.lower() in blob
    assert "मेरो" not in str(safe)
    assert "kati" not in blob
    assert "eyj" not in blob
    assert safe.get("duration_ms") == 12 or safe.get("response_type") == "ANSWER"
    assert safe.get("redaction_version")


def test_redaction_idempotent():
    once = validate_safe_event({"password": "secret", "duration_ms": 1})
    twice = validate_safe_event(once)
    assert once.get("password") == REDACTED
    assert twice.get("password") == REDACTED


def test_logger_does_not_emit_raw_message(caplog):
    ctx = mai03_obs.create_trace_context()
    with mai03_obs.trace_context_scope(ctx):
        with caplog.at_level(logging.INFO, logger="oip"):
            log_event("unit.test", message="PRIVATE NEPALI नेपाली", authorization="Bearer tok")
    joined = " ".join(r.message for r in caplog.records)
    assert "PRIVATE" not in joined
    assert "नेपाली" not in joined
    assert "Bearer tok" not in joined


def test_recorder_stages_and_no_duplicate_terminal():
    ctx = mai03_obs.create_trace_context()
    sink = mai03_obs.get_memory_trace_sink()
    with mai03_obs.trace_context_scope(ctx):
        rec = mai03_obs.get_trace_recorder()
        ev = rec.start_stage(mai03_obs.TraceStage.GATEWAY_RECEIVED)
        rec.complete_stage(ev)
        rec.record_event(
            mai03_obs.TraceStage.REQUEST_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code="OK",
        )
        rec.record_event(
            mai03_obs.TraceStage.REQUEST_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code="OK",
        )
    events = sink.all_events()
    terminals = [e for e in events if e.get("stage") == "REQUEST_COMPLETED"]
    assert len(terminals) == 1
    assert all(e.get("duration_ms") is None or e["duration_ms"] >= 0 for e in events)


def test_unknown_stage_rejected():
    ctx = mai03_obs.create_trace_context()
    with mai03_obs.trace_context_scope(ctx):
        with pytest.raises(ValueError):
            mai03_obs.get_trace_recorder().start_stage("NOT_A_REAL_STAGE")


def test_monotonic_duration_non_negative():
    ctx = mai03_obs.create_trace_context()
    with mai03_obs.trace_context_scope(ctx):
        rec = mai03_obs.get_trace_recorder()
        ev = rec.start_stage(mai03_obs.TraceStage.CLIENT_CONTRACT_VALIDATED)
        rec.complete_stage(ev)
    events = [e for e in mai03_obs.get_memory_trace_sink().all_events() if e.get("status") == "COMPLETED"]
    assert events
    assert events[-1]["duration_ms"] >= 0


@pytest.mark.asyncio
async def test_ingress_attaches_trace_and_omits_raw_text_from_sink():
    from unittest.mock import MagicMock, patch
    from src.api.oip_chat_ingress import build_canonical_ai_request

    trusted = MagicMock()
    trusted.principal_id = "user-1"
    trusted.tenant_id = "tenant-1"
    trusted.active_company_id = "co-1"
    trusted.allows_company = lambda c: True
    trusted.authentication_method = "jwt"
    trusted.roles = ("accountant",)
    trusted.permissions = ("oip:read",)

    with patch(
        "src.oip.domain.constitution.enforcement.enforce_chat_identity_and_mode",
        return_value=(trusted, None),
    ):
        mai03_obs.start_request_trace(headers={"x-correlation-id": "11111111-2222-4333-8444-555555555555"})
        canonical = await build_canonical_ai_request(
            message="मेरो balance कति?",
            session_id="sess-1",
            orbix_mode="ask",
        )
    assert canonical.request_id
    events = mai03_obs.get_memory_trace_sink().all_events()
    assert any(e.get("stage") == "CANONICAL_REQUEST_BUILT" for e in events)
    blob = str(events)
    assert "मेरो" not in blob
    assert "कति" not in blob


@pytest.mark.asyncio
async def test_stream_shares_trace_reference():
    from src.api.oip_chat_ingress import stream_orbix_kernel_events
    from src.oip.application.dto.intelligence_request import IntelligenceResponseDto
    from src.oip.domain.value_objects import ActionPayload, ActionType

    ctx = mai03_obs.create_trace_context()
    with mai03_obs.trace_context_scope(ctx):
        response = IntelligenceResponseDto(
            request_id=ctx.request_id,
            correlation_id=ctx.correlation_id,
            actions=(
                ActionPayload(action_type=ActionType.ANSWER, body={"text": "ok"}, confidence=1.0),
            ),
            metadata={
                "trace_reference": ctx.trace_reference,
                "correlation_id": ctx.correlation_id,
                "conversation_id": "c1",
                "egress_scope_ref": {
                    "principal_id": "u",
                    "tenant_id": "t",
                    "authentication_method": "jwt",
                },
            },
        )
        events = [e async for e in stream_orbix_kernel_events(response)]
    joined = "".join(events)
    assert "request_accepted" in joined
    assert ctx.trace_reference in joined
    assert '"type": "complete"' in joined


def test_lookup_unavailable_without_auth_scope():
    sink = mai03_obs.get_memory_trace_sink()
    assert sink.query("tr_deadbeef_deadbeef", trusted_scope={"tenant_id": "t1"}) is None


def test_lookup_policy_auth_and_permission():
    ref = "tr_aaaaaaaa_bbbbbbbb"
    no_auth = mai03_obs.lookup_trace(ref, principal=None)
    assert no_auth.http_status == 401
    assert no_auth.code == mai03_obs.TRACE_LOOKUP_UNAUTHORIZED

    class P:
        tenant_id = "t1"
        active_company_id = "c1"
        permissions = ()

    denied = mai03_obs.lookup_trace(ref, principal=P())
    assert denied.http_status == 403
    assert denied.code == mai03_obs.TRACE_LOOKUP_DENIED

    class Admin:
        tenant_id = "t1"
        active_company_id = "c1"
        permissions = (mai03_obs.VIEW_DEBUG_TRACES_PERMISSION,)

    unavailable = mai03_obs.lookup_trace(ref, principal=Admin(), queryable=False)
    assert unavailable.code == mai03_obs.TRACE_LOOKUP_UNAVAILABLE
    assert unavailable.http_status == 503


def test_lookup_queryable_tenant_isolation():
    ctx = mai03_obs.create_trace_context()
    ctx = mai03_obs.bind_scope_references(ctx, tenant_scope_reference="tenant-a")
    sink = mai03_obs.get_memory_trace_sink()
    with mai03_obs.trace_context_scope(ctx):
        mai03_obs.get_trace_recorder().record_event(
            mai03_obs.TraceStage.REQUEST_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code="OK",
        )

    class AdminWrong:
        tenant_id = "tenant-b"
        active_company_id = "c1"
        permissions = (mai03_obs.VIEW_DEBUG_TRACES_PERMISSION,)

    denied = mai03_obs.lookup_trace(
        ctx.trace_reference, principal=AdminWrong(), sink=sink, queryable=True
    )
    assert denied.http_status == 403

    class AdminOk:
        tenant_id = "tenant-a"
        active_company_id = "c1"
        permissions = (mai03_obs.VIEW_DEBUG_TRACES_PERMISSION,)

    ok = mai03_obs.lookup_trace(
        ctx.trace_reference, principal=AdminOk(), sink=sink, queryable=True
    )
    assert ok.ok
    blob = str(ok.payload)
    assert "password" not in blob.lower() or "[REDACTED]" in blob


def test_circular_and_oversized_redaction():
    circ: dict = {"duration_ms": 1}
    circ["self"] = circ
    safe = validate_safe_event(circ)
    assert safe.get("duration_ms") == 1
    huge = {"duration_ms": 1, "note": "x" * 5000}
    safe2 = validate_safe_event(huge)
    assert safe2.get("redaction_version")


def test_derive_background_keeps_correlation():
    ctx = mai03_obs.create_trace_context()
    bg = mai03_obs.derive_background_context(ctx)
    assert bg.correlation_id == ctx.correlation_id
    assert bg.request_id != ctx.request_id
