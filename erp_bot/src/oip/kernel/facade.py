"""Intelligence Kernel Facade — single ingress (Constitution Phase 0B)."""

from __future__ import annotations

import os
import time
from typing import Any

from ..application.bus.command_bus import CommandBus
from ..application.commands import SubmitIntelligenceRequestCommand
from ..application.dto.intelligence_request import IntelligenceRequestDto, IntelligenceResponseDto
from ..application.ports.inbound.intelligence_ingress_port import IntelligenceIngressPort
from ..application.services.audit_service import AuditService
from ..application.services.lineage_service import LineageService
from ..config.settings import FeatureFlags
from ..infrastructure.messaging.outbox_dispatcher import OutboxDispatcher
from ..infrastructure.observability.correlation import bind_trace, clear_trace
from ..infrastructure.observability.logging import log_event
from ..infrastructure.observability.tracing import span
from ..modules.orchestrator.application.services.orchestrator_service import OrchestratorService
from ..shared.ids import CorrelationId, TenantId

_OIP_CHAT_DEBUG = os.getenv("OIP_CHAT_DEBUG", "false").lower() in {"1", "true", "yes"}


class IntelligenceKernelFacade(IntelligenceIngressPort):
    """
    Orchestrates intelligence requests through the Orchestrator execution engine.
    All production traffic uses the native OIP pipeline (native or shadow diagnostic mode).
    """

    def __init__(
        self,
        *,
        command_bus: CommandBus,
        outbox_dispatcher: OutboxDispatcher,
        audit_service: AuditService,
        lineage_service: LineageService,
        feature_flags: FeatureFlags,
        orchestrator_service: OrchestratorService | None = None,
        **_: Any,
    ) -> None:
        self._command_bus = command_bus
        self._outbox_dispatcher = outbox_dispatcher
        self._audit = audit_service
        self._lineage = lineage_service
        self._orchestrator = orchestrator_service
        self._flags = feature_flags

    async def submit(self, request: IntelligenceRequestDto) -> IntelligenceResponseDto:
        bind_trace(request_id=request.request_id, correlation_id=request.correlation_id)
        started = time.perf_counter()
        try:
            with span("intelligence.submit", module=request.module, tenant_id=request.tenant_id):
                await self._record_shadow_start(request)
                if _OIP_CHAT_DEBUG:
                    log_event(
                        "oip.kernel.submit",
                        request_id=request.request_id,
                        question=request.question,
                        module=request.module,
                    )

                if not self._orchestrator or not self._flags.orchestrator_module_enabled:
                    raise RuntimeError("orchestrator_required_for_native_execution")

                _, response = await self._orchestrator.execute_workflow(request=request)
                if response is None:
                    raise RuntimeError("orchestrator_returned_no_response")

                await self._command_bus.dispatch(
                    SubmitIntelligenceRequestCommand(
                        tenant_id=TenantId(request.tenant_id),
                        correlation_id=CorrelationId(request.correlation_id),
                        idempotency_key=request.idempotency_key,
                        session_id=request.session_id,
                        user_id=request.user_id,
                        company_id=request.company_id,
                        branch_id=request.branch_id,
                        module=request.module,
                        language=request.language,
                        message=request.question,
                    )
                )

                await self._record_shadow_complete(request, response)
                await self._outbox_dispatcher.dispatch_pending(limit=50)
                log_event(
                    "intelligence.completed",
                    tenant_id=request.tenant_id,
                    module=request.module,
                    latency_ms=int((time.perf_counter() - started) * 1000),
                )
                return response
        finally:
            clear_trace()

    async def health(self) -> dict[str, Any]:
        return {
            "status": "ok",
            "kernel": "oip",
            "version": "0.1.0",
            "orchestrator_module": self._flags.orchestrator_module_enabled,
            "execution_mode": self._flags.execution_mode,
            "native_execution_default": True,
            "legacy_delegation": self._flags.legacy_delegation,
            "shadow_audit": self._flags.shadow_audit_writes,
            "shadow_lineage": self._flags.shadow_lineage_writes,
            "conversation_module": self._flags.conversation_module_enabled,
            "shadow_conversation": self._flags.shadow_conversation_writes,
            "session_module": self._flags.session_module_enabled,
            "shadow_session": self._flags.shadow_session_writes,
            "planner_module": self._flags.planner_module_enabled,
            "shadow_planner": self._flags.shadow_planner_writes,
            "router_module": self._flags.router_module_enabled,
            "shadow_router": self._flags.shadow_router_writes,
            "provider_runtime_module": self._flags.provider_runtime_module_enabled,
            "shadow_provider_runtime": self._flags.shadow_provider_runtime_writes,
            "quality_gate_module": self._flags.quality_gate_module_enabled,
            "shadow_quality": self._flags.shadow_quality_writes,
            "l3_quality_enabled": self._flags.l3_quality_enabled,
            "action_runtime_module": self._flags.action_runtime_module_enabled,
            "shadow_action_runtime": self._flags.shadow_action_runtime_writes,
            "streaming_enabled": self._flags.streaming_enabled,
            "streaming_runtime_module": self._flags.streaming_runtime_module_enabled,
        }

    async def _record_shadow_start(self, request: IntelligenceRequestDto) -> None:
        if self._flags.shadow_lineage_writes:
            await self._lineage.append_node(
                tenant_id=request.tenant_id,
                request_id=request.request_id,
                node_type="Request",
                payload={"module": request.module, "session_id": request.session_id},
            )
        if self._flags.shadow_audit_writes:
            await self._audit.record(
                tenant_id=request.tenant_id,
                request_id=request.request_id,
                correlation_id=request.correlation_id,
                event_name="intelligence.request.received",
                payload_redacted={
                    "module": request.module,
                    "message_length": len(request.question),
                },
            )

    async def _record_shadow_complete(
        self,
        request: IntelligenceRequestDto,
        response: IntelligenceResponseDto,
    ) -> None:
        if self._flags.shadow_lineage_writes:
            await self._lineage.append_node(
                tenant_id=request.tenant_id,
                request_id=request.request_id,
                node_type="Response",
                payload={"action_count": len(response.actions)},
            )
        if self._flags.shadow_audit_writes:
            await self._audit.record(
                tenant_id=request.tenant_id,
                request_id=request.request_id,
                correlation_id=request.correlation_id,
                event_name="intelligence.response.completed",
                payload_redacted={
                    "action_count": len(response.actions),
                    "latency_ms": response.latency_ms,
                },
            )
