"""Orchestrator workflow stage adapters — coordinate bounded contexts via ports."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ....application.dto.stage_result import StageResult
from ....application.dto.workflow_context import WorkflowContext
from ....application.ports.workflow_stage_port import WorkflowStagePort
from ....domain.value_objects import RetryClassification, StageRunStatus, WorkflowStageName
from ......integration.contracts.execution_intent import ExecutionIntent
from ......integration.khata_preprocess import preprocess_erp_message
from .....planner.application.dto.planning_request import PlanningRequestDto
from .....planner.domain.value_objects import PlanningPolicyName
from .....streaming_runtime.domain.value_objects import WorkflowEventType
from ..module_ports import ModulePorts


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ok(stage: str, snapshot: dict | None = None, **meta) -> StageResult:
    return StageResult(stage=stage, status=StageRunStatus.COMPLETED, snapshot=snapshot, metadata=meta)


def _skip(stage: str) -> StageResult:
    return StageResult(stage=stage, status=StageRunStatus.SKIPPED)


def _fail(stage: str, error: str, retryable: bool = False) -> StageResult:
    return StageResult(
        stage=stage,
        status=StageRunStatus.FAILED,
        error=error,
        retry_classification=(
            RetryClassification.RETRYABLE if retryable else RetryClassification.NON_RETRYABLE
        ),
    )


def _memory_content_writes_allowed(context: WorkflowContext) -> bool:
    """MAI-16: gate content memory writes when policy.write_allowed is false."""
    try:
        from src.oip.modules.conversation.application.context_assembly_service import (
            memory_content_writes_allowed,
        )

        return memory_content_writes_allowed(
            context.metadata if isinstance(context.metadata, dict) else None
        )
    except Exception:  # noqa: BLE001
        return True


async def _resolve_execution_intent(ports: ModulePorts, context: WorkflowContext) -> ExecutionIntent | None:
    if not context.plan_ref:
        return None
    cached = context.plan_ref.get("execution_intent")
    if cached:
        return ExecutionIntent.from_dict(cached)
    if ports.plan_repository is None:
        return None
    plan = await ports.plan_repository.get_by_id(
        tenant_id=context.tenant_id,
        plan_id=context.plan_ref["plan_id"],
    )
    return plan.execution_intent if plan else None


def _execution_intent_snapshot(intent: ExecutionIntent | None) -> dict[str, Any] | None:
    return intent.model_dump(mode="json") if intent else None


def _mai03_safe_stage(start: str, *, complete: bool = False, fail: bool = False, **attrs: Any) -> str | None:
    """Best-effort MAI-03 stage emit — never logs message/prompt content."""
    try:
        from src.oip.infrastructure.observability import mai03 as mai03_obs

        if mai03_obs.get_trace_context() is None:
            return None
        rec = mai03_obs.get_trace_recorder()
        if fail:
            rec.record_event(
                start,
                mai03_obs.TraceStatus.FAILED,
                safe_error_code=str(attrs.get("safe_error_code") or "STAGE_FAILED"),
                safe_attributes={k: v for k, v in attrs.items() if k != "safe_error_code"},
            )
            return None
        if complete:
            rec.record_event(
                start,
                mai03_obs.TraceStatus.COMPLETED,
                outcome_code=str(attrs.get("outcome_code") or "OK"),
                component_versions=attrs.get("component_versions") or {},
                safe_attributes={
                    k: v
                    for k, v in attrs.items()
                    if k not in {"outcome_code", "component_versions"}
                },
            )
            return None
        return rec.start_stage(start, safe_attributes=dict(attrs) if attrs else None)
    except Exception:  # noqa: BLE001
        return None


def _mai03_finish(event_id: str | None, *, ok: bool = True, safe_error_code: str | None = None) -> None:
    if not event_id:
        return
    try:
        from src.oip.infrastructure.observability import mai03 as mai03_obs

        rec = mai03_obs.get_trace_recorder()
        if ok:
            rec.complete_stage(event_id, outcome_code="OK")
        else:
            rec.fail_stage(event_id, safe_error_code=safe_error_code or "STAGE_FAILED")
    except Exception:  # noqa: BLE001
        return


class ValidationStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.VALIDATION.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if not context.message.strip():
            return _fail(self.name, "message_required")
        if not context.session_id:
            return _fail(self.name, "session_id_required")
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        result = await self.validate(context)
        return context, result

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return False


class ConversationStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.CONVERSATION.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if self._ports.conversation is None or not self._ports.feature_flags.conversation_module_enabled:
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status == StageRunStatus.SKIPPED:
            return context, validation
        if validation.status == StageRunStatus.FAILED:
            return context, validation
        svc = self._ports.conversation
        assert svc is not None
        conversation = await svc.ensure_conversation(
            tenant_id=context.tenant_id,
            session_id=context.session_id,
            user_id=context.user_id,
            module=context.module,
            correlation_id=context.correlation_id,
            company_id=context.company_id,
            branch_id=context.branch_id,
            conversation_id=context.conversation_id,
        )
        await svc.record_user_message(
            tenant_id=context.tenant_id,
            conversation_id=conversation.conversation_id,
            request_id=context.request_id,
            correlation_id=context.correlation_id,
            content=context.message,
            language=context.language,
        )
        snapshot = {"conversation_id": conversation.conversation_id}
        updated = context.model_copy(
            update={"conversation_id": conversation.conversation_id, "conversation_ref": snapshot}
        )
        return updated, _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        if self._ports.conversation and context.conversation_id:
            await self._ports.lineage_service.append_node(
                tenant_id=context.tenant_id,
                request_id=context.request_id,
                node_type="ConversationFailure",
                payload={"conversation_id": context.conversation_id},
            )
        return _ok(self.name, metadata={"rollback": "append_failure"})

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return True


class SessionStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.SESSION.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if self._ports.session is None or not self._ports.feature_flags.session_module_enabled:
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status != StageRunStatus.COMPLETED:
            return context, validation
        erp_context = self._ports.legacy_session.load_context(context.user_id)
        session = await self._ports.session.open_or_touch(  # type: ignore[union-attr]
            tenant_id=context.tenant_id,
            session_id=context.session_id,
            user_id=context.user_id,
            module=context.module,
            company_id=context.company_id,
            branch_id=context.branch_id,
            conversation_id=context.conversation_id,
            erp_context=erp_context,
        )
        snapshot = {"session_id": session.session_id}
        updated = context.model_copy(update={"session_ref": snapshot})
        return updated, _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return True


class PlanningStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.PLANNING.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if self._ports.planner is None or not self._ports.feature_flags.planner_module_enabled:
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status != StageRunStatus.COMPLETED:
            return context, validation
        policy = PlanningPolicyName.BALANCED
        if context.module == "khata":
            policy = PlanningPolicyName.ACCOUNTING
        elif context.module == "nios":
            policy = PlanningPolicyName.ACCURATE
        dto = PlanningRequestDto(
            request_id=context.request_id,
            correlation_id=context.correlation_id,
            tenant_id=context.tenant_id,
            company_id=context.company_id,
            branch_id=context.branch_id,
            user_id=context.user_id,
            session_id=context.session_id,
            conversation_id=context.conversation_id,
            module=context.module,
            language=context.language,
            message=context.message,
            policy_name=policy,
        )
        try:
            plan = await self._ports.planner.create_plan(dto)  # type: ignore[union-attr]
        except Exception as exc:  # noqa: BLE001
            return context, _fail(self.name, str(exc), retryable=True)
        snapshot = {"plan_id": plan.plan_id}
        intent_snapshot = _execution_intent_snapshot(plan.execution_intent)
        if intent_snapshot:
            snapshot["execution_intent"] = intent_snapshot
        return context.model_copy(update={"plan_ref": snapshot}), _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return True


class RoutingStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.ROUTING.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if self._ports.router is None or not self._ports.feature_flags.router_module_enabled:
            return _skip(self.name)
        if not context.plan_ref or self._ports.plan_repository is None:
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status != StageRunStatus.COMPLETED:
            return context, validation
        plan_entity = await self._ports.plan_repository.get_by_id(  # type: ignore[union-attr]
            tenant_id=context.tenant_id, plan_id=context.plan_ref["plan_id"]
        )
        if plan_entity is None:
            return context, _fail(self.name, "plan_entity_not_found")
        try:
            route = await self._ports.router.create_route_decision(plan=plan_entity)  # type: ignore[union-attr]
        except Exception as exc:  # noqa: BLE001
            return context, _fail(self.name, str(exc), retryable=True)
        snapshot = {"route_id": route.route_id}
        return context.model_copy(update={"route_ref": snapshot}), _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return True


class KnowledgeStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.KNOWLEDGE.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if self._ports.knowledge is None or not self._ports.feature_flags.knowledge_module_enabled:
            return _skip(self.name)
        if not context.message.strip():
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status != StageRunStatus.COMPLETED:
            return context, validation
        # MAI-26: optional as_of filter hint from temporal cues (never legal proof).
        as_of: str | None = None
        temporal_meta: dict[str, Any] = {}
        try:
            if isinstance(context.metadata, dict):
                raw_tcr = context.metadata.get("temporal_cross_ref")
                if isinstance(raw_tcr, dict):
                    temporal_meta = dict(raw_tcr)
            from src.oip.modules.conversation.application.temporal_cross_ref_service import (
                amendment_cues_present,
                resolve_retrieval_as_of,
            )

            as_of = resolve_retrieval_as_of(temporal_meta or None)
            amend_cues = amendment_cues_present(temporal_meta or None)
        except Exception:  # noqa: BLE001
            as_of = None
            amend_cues = False
        try:
            snapshot_obj, bundle = await self._ports.knowledge.retrieve(  # type: ignore[union-attr]
                tenant_id=context.tenant_id,
                request_id=context.request_id,
                correlation_id=context.correlation_id,
                query=context.message,
                company_id=context.company_id,
                as_of=as_of,
            )
        except Exception as exc:  # noqa: BLE001 — knowledge must not block workflow
            return context, _ok(self.name, {"warning": str(exc)})
        snippets = []
        try:
            meta = getattr(bundle, "metadata", None) or {}
            raw_snips = meta.get("snippets") if isinstance(meta, dict) else None
            if isinstance(raw_snips, list):
                snippets = [
                    s for s in raw_snips
                    if isinstance(s, dict) and (s.get("snippet") or s.get("document_id"))
                ][:5]
        except Exception:
            snippets = []
        snapshot = {
            "snapshot_id": snapshot_obj.snapshot_id,
            "bundle_id": bundle.bundle_id,
            "snippets": snippets,
            "as_of": as_of or getattr(snapshot_obj, "as_of", None),
            "as_of_from_temporal_cues": bool(as_of),
            "legal_effective_dates_proven": False,
            "amendment_applied": False,
            "amendment_cues_present": bool(amend_cues),
            "amendment_filter_mode": "CUES_ONLY",
        }
        return context.model_copy(update={"knowledge_ref": snapshot}), _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return True


class MemoryStoreStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.MEMORY_STORE.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if self._ports.memory is None or not self._ports.feature_flags.memory_module_enabled:
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status != StageRunStatus.COMPLETED:
            return context, validation
        if not _memory_content_writes_allowed(context):
            return context, _skip(self.name)
        try:
            memory = await self._ports.memory.store(  # type: ignore[union-attr]
                tenant_id=context.tenant_id,
                request_id=context.request_id,
                correlation_id=context.correlation_id,
                summary=context.message[:500],
                content=context.message,
                memory_type="ConversationMemory",
                source_module="orchestrator",
                company_id=context.company_id,
                conversation_id=context.conversation_id,
                workflow_id=context.workflow_id,
                importance="Medium",
                metadata={"stage": "memory_store", "knowledge_ref": context.knowledge_ref},
            )
        except Exception as exc:  # noqa: BLE001
            return context, _ok(self.name, {"warning": str(exc)})
        snapshot = {"memory_id": memory.memory_id}
        return context.model_copy(update={"memory_store_ref": snapshot}), _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return True


class ExecutionStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.EXECUTION.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if self._ports.provider_runtime is None or not self._ports.feature_flags.provider_runtime_module_enabled:
            return _skip(self.name)
        if not context.route_ref or self._ports.route_repository is None:
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status != StageRunStatus.COMPLETED:
            return context, validation

        meta = context.metadata or {}
        orbix_mode = meta.get("orbix_mode") or "ask"
        client_ctx = meta.get("client_context") or {}
        last_party = (
            client_ctx.get("last_party")
            or client_ctx.get("lastParty")
            or None
        )
        recent_raw = client_ctx.get("recent_parties") or client_ctx.get("lastParties") or []
        recent_parties = [str(p) for p in recent_raw if p] if isinstance(recent_raw, list) else []
        pre_ev = _mai03_safe_stage("DETERMINISTIC_PREPROCESS_STARTED", path="erp_preprocess")
        raw_turn_relation = meta.get("turn_relation")
        turn_relation = (
            raw_turn_relation if isinstance(raw_turn_relation, dict) else None
        )
        raw_rc = meta.get("reference_coreference")
        reference_coreference = raw_rc if isinstance(raw_rc, dict) else None
        raw_router = meta.get("router_decision")
        router_decision = raw_router if isinstance(raw_router, dict) else None
        raw_cp = meta.get("clarification_plan")
        clarification_plan = raw_cp if isinstance(raw_cp, dict) else None
        erp_result = preprocess_erp_message(
            context.message,
            orbix_mode=orbix_mode,
            session_id=context.session_id,
            tenant_id=context.tenant_id,
            company_id=context.company_id or "",
            user_id=context.user_id,
            user_role=client_ctx.get("user_role") or client_ctx.get("role"),
            permissions=client_ctx.get("permissions"),
            has_active_report=bool(client_ctx.get("has_active_report")),
            has_pending_confirmation=bool(client_ctx.get("has_pending_confirmation")),
            draft_id=client_ctx.get("draft_id") or client_ctx.get("active_draft_id"),
            last_party=str(last_party) if last_party else None,
            recent_parties=recent_parties,
            turn_relation=turn_relation,
            reference_coreference=reference_coreference,
            router_decision=router_decision,
            clarification_plan=clarification_plan,
        )
        if erp_result and erp_result.skip_llm:
            _mai03_finish(pre_ev, ok=True)
            _mai03_safe_stage(
                "DETERMINISTIC_PREPROCESS_COMPLETED",
                complete=True,
                outcome_code="SKIP_LLM",
                method=str(erp_result.method or ""),
                intent=str(erp_result.intent or ""),
            )
            snapshot = {
                "source": "erp_preprocess",
                "method": erp_result.method,
                "intent": erp_result.intent,
                "orbix_mode": erp_result.orbix_mode or orbix_mode,
                "operation_class": erp_result.operation_class,
                "draft_id": erp_result.draft_id,
            }
            response_ref: dict[str, Any] = {
                "text": erp_result.text,
                "intent": erp_result.intent,
                "method": erp_result.method,
                "orbix_mode": erp_result.orbix_mode or orbix_mode,
                "operation_class": erp_result.operation_class,
                "capabilities": erp_result.capabilities,
                "error": erp_result.error,
                "report_spec": erp_result.report_spec,
                "draft_id": erp_result.draft_id,
            }
            if erp_result.card:
                response_ref["card"] = erp_result.card
            return (
                context.model_copy(update={"response_ref": response_ref, "execution_ref": snapshot}),
                _ok(self.name, snapshot, erp_deterministic=True),
            )
        _mai03_finish(pre_ev, ok=True)
        _mai03_safe_stage(
            "DETERMINISTIC_PREPROCESS_COMPLETED",
            complete=True,
            outcome_code="CONTINUE_PROVIDER",
        )

        route = await self._ports.route_repository.get_by_id(  # type: ignore[union-attr]
            tenant_id=context.tenant_id, route_id=context.route_ref["route_id"]
        )
        if route is None:
            return context, _fail(self.name, "route_not_found")

        # MAI-24: forward knowledge-source governance before grounding consume.
        knowledge_source_governance: dict[str, Any] = {}
        try:
            if isinstance(context.metadata, dict):
                raw_ksg = context.metadata.get("knowledge_source_governance")
                if isinstance(raw_ksg, dict):
                    knowledge_source_governance = dict(raw_ksg)
            if knowledge_source_governance:
                route = route.model_copy(
                    update={
                        "policy_decisions": {
                            **dict(route.policy_decisions or {}),
                            "knowledge_source_governance": knowledge_source_governance,
                        }
                    }
                )
        except Exception:  # noqa: BLE001
            knowledge_source_governance = {}

        # MAI-25: forward extraction / OCR plan (never authorizes OCR execution).
        try:
            extraction_ocr_plan: dict[str, Any] = {}
            if isinstance(context.metadata, dict):
                raw_eop = context.metadata.get("extraction_ocr_plan")
                if isinstance(raw_eop, dict):
                    extraction_ocr_plan = dict(raw_eop)
            if extraction_ocr_plan:
                # Fail-closed: strip any accidental execution authorization.
                extraction_ocr_plan["ocr_execution_authorized"] = False
                extraction_ocr_plan["is_execution_authority"] = False
                route = route.model_copy(
                    update={
                        "policy_decisions": {
                            **dict(route.policy_decisions or {}),
                            "extraction_ocr_plan": extraction_ocr_plan,
                        }
                    }
                )
        except Exception:  # noqa: BLE001
            pass

        # MAI-26: forward temporal / cross-ref cues (as_of hint; never legal proof).
        try:
            temporal_cross_ref: dict[str, Any] = {}
            if isinstance(context.metadata, dict):
                raw_tcr = context.metadata.get("temporal_cross_ref")
                if isinstance(raw_tcr, dict):
                    temporal_cross_ref = dict(raw_tcr)
            if temporal_cross_ref:
                temporal_cross_ref["legal_effective_dates_proven"] = False
                temporal_cross_ref["amendment_applied"] = False
                temporal_cross_ref["amendment_filter_mode"] = "CUES_ONLY"
                temporal_cross_ref["is_execution_authority"] = False
                route = route.model_copy(
                    update={
                        "policy_decisions": {
                            **dict(route.policy_decisions or {}),
                            "temporal_cross_ref": temporal_cross_ref,
                        }
                    }
                )
        except Exception:  # noqa: BLE001
            pass

        # MAI-27: forward lexical index readiness (prefer SQLITE FTS; never Ollama).
        lexical_index: dict[str, Any] = {}
        try:
            if isinstance(context.metadata, dict):
                raw_lex = context.metadata.get("lexical_index")
                if isinstance(raw_lex, dict):
                    lexical_index = dict(raw_lex)
            if lexical_index:
                lexical_index["ollama_required"] = False
                lexical_index["vector_backend_required"] = False
                lexical_index["citations_verified"] = False
                lexical_index["is_execution_authority"] = False
                route = route.model_copy(
                    update={
                        "policy_decisions": {
                            **dict(route.policy_decisions or {}),
                            "lexical_index": lexical_index,
                        }
                    }
                )
        except Exception:  # noqa: BLE001
            lexical_index = {}

        # MAI-28: forward vector index (non-prod only; never claim production).
        vector_index: dict[str, Any] = {}
        try:
            if isinstance(context.metadata, dict):
                raw_vec = context.metadata.get("vector_index")
                if isinstance(raw_vec, dict):
                    vector_index = dict(raw_vec)
            if vector_index:
                vector_index["production_eligible"] = False
                vector_index["citations_verified"] = False
                vector_index["is_execution_authority"] = False
                vector_index["lexical_authoritative"] = True
                route = route.model_copy(
                    update={
                        "policy_decisions": {
                            **dict(route.policy_decisions or {}),
                            "vector_index": vector_index,
                        }
                    }
                )
        except Exception:  # noqa: BLE001
            vector_index = {}

        # MAI-29: forward hybrid fusion policy (consume builds candidates; never verify).
        hybrid_fusion: dict[str, Any] = {}
        try:
            if isinstance(context.metadata, dict):
                raw_hyb = context.metadata.get("hybrid_fusion")
                if isinstance(raw_hyb, dict):
                    hybrid_fusion = dict(raw_hyb)
            if hybrid_fusion:
                hybrid_fusion["fusion_executed"] = False
                hybrid_fusion["rerank_authorized"] = False
                hybrid_fusion["evidence_assembled"] = False
                hybrid_fusion["claims_verified"] = False
                hybrid_fusion["citations_verified"] = False
                hybrid_fusion["hybrid_production_eligible"] = False
                hybrid_fusion["is_execution_authority"] = False
                hybrid_fusion["lexical_authoritative"] = True
                route = route.model_copy(
                    update={
                        "policy_decisions": {
                            **dict(route.policy_decisions or {}),
                            "hybrid_fusion": hybrid_fusion,
                        }
                    }
                )
        except Exception:  # noqa: BLE001
            hybrid_fusion = {}

        # MAI-30: forward claim-citation / grounded-answer gate (never verifies).
        claim_citation: dict[str, Any] = {}
        try:
            if isinstance(context.metadata, dict):
                raw_cc = context.metadata.get("claim_citation")
                if isinstance(raw_cc, dict):
                    claim_citation = dict(raw_cc)
            if claim_citation:
                claim_citation["claims_verified"] = False
                claim_citation["citations_verified"] = False
                claim_citation["verifier_executed"] = False
                claim_citation["legal_proof_claimed"] = False
                claim_citation["fake_citation_allowed"] = False
                claim_citation["is_execution_authority"] = False
                route = route.model_copy(
                    update={
                        "policy_decisions": {
                            **dict(route.policy_decisions or {}),
                            "claim_citation": claim_citation,
                        }
                    }
                )
        except Exception:  # noqa: BLE001
            claim_citation = {}

        # Ground the provider prompt with NP Language KB (+ OIP knowledge snippets).
        try:
            from src.nlu.prompt_grounding import build_prompt_grounding

            knowledge_snippets = None
            if isinstance(context.knowledge_ref, dict):
                raw = context.knowledge_ref.get("snippets")
                if isinstance(raw, list):
                    knowledge_snippets = raw
            grounding = build_prompt_grounding(
                context.message,
                knowledge_snippets=knowledge_snippets,
                top_k=5,
                knowledge_source_governance=knowledge_source_governance or None,
                lexical_index=lexical_index or None,
                vector_index=vector_index or None,
                hybrid_fusion=hybrid_fusion or None,
                claim_citation=claim_citation or None,
            )
            grounded_meta = grounding.to_metadata()
            route = route.model_copy(
                update={
                    "policy_decisions": {
                        **dict(route.policy_decisions or {}),
                        "user_message": str(
                            (route.policy_decisions or {}).get("user_message") or context.message
                        ),
                        **grounded_meta,
                        "knowledge_snippets": knowledge_snippets or [],
                    }
                }
            )
        except Exception:
            # Soft-fail: ungrounded execution is better than blocking chat.
            pass

        # MAI-11: forward response-register policy into provider metadata (always).
        try:
            response_register: dict[str, Any] = {}
            if isinstance(context.metadata, dict):
                raw_rr = context.metadata.get("response_register")
                if isinstance(raw_rr, dict):
                    response_register = dict(raw_rr)
            if not response_register and context.message:
                from src.oip.modules.language_runtime.application.language_analyzer import (
                    analyze_language,
                )
                from src.oip.modules.language_runtime.response_register.application.prompt_directive import (
                    bundle_to_metadata,
                )
                from src.oip.modules.language_runtime.response_register.application.response_register_service import (
                    build_response_register_bundle,
                )

                frame = analyze_language(context.message)
                response_register = bundle_to_metadata(
                    build_response_register_bundle(frame)
                )
            if response_register:
                route = route.model_copy(
                    update={
                        "policy_decisions": {
                            **dict(route.policy_decisions or {}),
                            "response_register": response_register,
                        }
                    }
                )
        except Exception:  # noqa: BLE001
            pass

        # MAI-23: forward prompt-registry refs into provider metadata.
        try:
            prompt_registry: dict[str, Any] = {}
            if isinstance(context.metadata, dict):
                raw_pr = context.metadata.get("prompt_registry")
                if isinstance(raw_pr, dict):
                    prompt_registry = dict(raw_pr)
            if prompt_registry:
                route = route.model_copy(
                    update={
                        "policy_decisions": {
                            **dict(route.policy_decisions or {}),
                            "prompt_registry": prompt_registry,
                        }
                    }
                )
        except Exception:  # noqa: BLE001
            pass

        # MAI-16: forward context assembly into provider metadata; optional RO recall.
        try:
            from src.oip.modules.conversation.application.context_assembly_service import (
                project_readonly_recall_summaries,
                select_readonly_recall_query,
            )

            context_assembly: dict[str, Any] = {}
            if isinstance(context.metadata, dict):
                raw_ca = context.metadata.get("context_assembly")
                if isinstance(raw_ca, dict):
                    context_assembly = dict(raw_ca)
            recall_meta: dict[str, Any] | None = None
            if context_assembly and self._ports.memory is not None:
                query = select_readonly_recall_query(
                    {"context_assembly": context_assembly},
                    context.message,
                )
                if query:
                    try:
                        memories = await self._ports.memory.recall(
                            tenant_id=context.tenant_id,
                            request_id=context.request_id,
                            correlation_id=context.correlation_id,
                            query=query,
                            company_id=context.company_id,
                            conversation_id=context.conversation_id,
                            workflow_id=context.workflow_id,
                            limit=5,
                        )
                        recall_meta = project_readonly_recall_summaries(memories)
                    except Exception:  # noqa: BLE001
                        recall_meta = {
                            "result_count": 0,
                            "summaries": [],
                            "read_only": True,
                            "memory_writes": 0,
                            "warning": "RECALL_SOFT_FAIL",
                        }
            if context_assembly or recall_meta:
                pd = dict(route.policy_decisions or {})
                if context_assembly:
                    pd["context_assembly"] = context_assembly
                if recall_meta is not None:
                    pd["context_assembly_recall"] = recall_meta
                route = route.model_copy(update={"policy_decisions": pd})
        except Exception:  # noqa: BLE001
            pass

        # MAI-22 slice 2: overlay annotated provider cascade onto the route.
        try:
            from src.oip.modules.conversation.application.provider_cascade_service import (
                apply_provider_cascade_to_route,
            )

            raw_pc = meta.get("provider_cascade") if isinstance(meta, dict) else None
            provider_cascade = raw_pc if isinstance(raw_pc, dict) else None
            route = apply_provider_cascade_to_route(route, provider_cascade)
        except Exception:  # noqa: BLE001
            # Soft-fail: keep router cascade rather than blocking chat.
            pass

        model_ev = _mai03_safe_stage("MODEL_REQUEST_STARTED")
        try:
            execution = await self._ports.provider_runtime.start_execution(route=route)  # type: ignore[union-attr]
        except Exception as exc:  # noqa: BLE001
            _mai03_finish(model_ev, ok=False, safe_error_code="MODEL_REQUEST_FAILED")
            return context, _fail(self.name, str(exc), retryable=True)
        _mai03_finish(model_ev, ok=True)
        model_name = "unavailable"
        model_provider = "unavailable"
        try:
            model_provider = str(getattr(route, "provider", None) or "unavailable")
            model_name = str(getattr(route, "model", None) or getattr(route, "model_name", None) or "unavailable")
        except Exception:  # noqa: BLE001
            pass
        _mai03_safe_stage(
            "MODEL_REQUEST_COMPLETED",
            complete=True,
            outcome_code="MODEL_OK",
            component_versions={
                "model_provider": model_provider,
                "model_name": model_name,
            },
        )
        snapshot = {"execution_id": execution.execution_id}
        updates: dict[str, Any] = {"execution_ref": snapshot}
        output_text = ""
        if execution.result and execution.result.output_text:
            output_text = execution.result.output_text.strip()
        if output_text:
            updates["response_ref"] = {"text": output_text}
        return context.model_copy(update=updates), _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        if self._ports.provider_runtime and context.execution_ref:
            await self._ports.provider_runtime.cancel_execution(
                tenant_id=context.tenant_id,
                execution_id=context.execution_ref["execution_id"],
                reason="workflow_rollback",
            )
        return _ok(self.name, metadata={"rollback": "cancel_execution"})

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return True


class MemoryUpdateStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.MEMORY_UPDATE.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if self._ports.memory is None or not self._ports.feature_flags.memory_module_enabled:
            return _skip(self.name)
        if not context.execution_ref:
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status != StageRunStatus.COMPLETED:
            return context, validation
        if not _memory_content_writes_allowed(context):
            return context, _skip(self.name)
        memory_id = (context.memory_store_ref or {}).get("memory_id")
        if not memory_id:
            return context, _skip(self.name)
        try:
            memory = await self._ports.memory.update(  # type: ignore[union-attr]
                tenant_id=context.tenant_id,
                correlation_id=context.correlation_id,
                request_id=context.request_id,
                memory_id=memory_id,
                metadata={
                    "execution_id": context.execution_ref.get("execution_id"),
                    "stage": "memory_update",
                },
            )
            await self._ports.memory.store(  # type: ignore[union-attr]
                tenant_id=context.tenant_id,
                request_id=context.request_id,
                correlation_id=context.correlation_id,
                summary=f"Execution {context.execution_ref.get('execution_id')} completed",
                content=str(context.execution_ref),
                memory_type="ExecutionMemory",
                source_module="orchestrator",
                company_id=context.company_id,
                conversation_id=context.conversation_id,
                workflow_id=context.workflow_id,
                importance="High",
            )
        except Exception as exc:  # noqa: BLE001
            return context, _ok(self.name, {"warning": str(exc)})
        snapshot = {"memory_id": memory.memory_id, "execution_id": context.execution_ref.get("execution_id")}
        return context.model_copy(update={"memory_update_ref": snapshot}), _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return True


class QualityStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.QUALITY.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if self._ports.quality_gate is None or not self._ports.feature_flags.quality_gate_module_enabled:
            return _skip(self.name)
        if not context.execution_ref:
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status != StageRunStatus.COMPLETED:
            return context, validation
        try:
            validation_context: dict[str, Any] = {}
            execution_intent = await _resolve_execution_intent(self._ports, context)
            intent_snapshot = _execution_intent_snapshot(execution_intent)
            if intent_snapshot:
                validation_context["execution_intent"] = intent_snapshot
            evaluation = await self._ports.quality_gate.start_evaluation(  # type: ignore[union-attr]
                execution_id=context.execution_ref["execution_id"],
                tenant_id=context.tenant_id,
                validation_context=validation_context or None,
            )
        except Exception as exc:  # noqa: BLE001
            return context, _fail(self.name, str(exc), retryable=False)
        snapshot = {
            "evaluation_id": evaluation.evaluation_id,
            "decision": evaluation.decision.outcome.value if evaluation.decision else None,
        }
        if evaluation.decision and evaluation.decision.outcome.value in ("block", "fail"):
            return context.model_copy(update={"quality_ref": snapshot}), _fail(
                self.name, "quality_blocked", retryable=False
            )
        return context.model_copy(update={"quality_ref": snapshot}), _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return False


class ActionStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.ACTION.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if self._ports.action_runtime is None or not self._ports.feature_flags.action_runtime_module_enabled:
            return _skip(self.name)
        if not context.quality_ref or not context.quality_ref.get("evaluation_id"):
            return _skip(self.name)
        decision = context.quality_ref.get("decision")
        if decision not in ("pass", "pass_with_warning"):
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status != StageRunStatus.COMPLETED:
            return context, validation
        execution_intent = await _resolve_execution_intent(self._ports, context)
        if execution_intent is None:
            return context, _fail(self.name, "execution_intent_missing", retryable=False)
        if execution_intent.read_only or not execution_intent.mutating:
            return context, _skip(self.name)
        try:
            action = await self._ports.action_runtime.propose_action(  # type: ignore[union-attr]
                evaluation_id=context.quality_ref["evaluation_id"],
                tenant_id=context.tenant_id,
                execution_intent=execution_intent,
                auto_execute=True,
            )
        except Exception as exc:  # noqa: BLE001
            return context, _fail(self.name, str(exc), retryable=True)
        snapshot = {"action_id": action.action_id, "status": action.status.value}
        return context.model_copy(update={"action_ref": snapshot}), _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        if self._ports.action_runtime and context.action_ref:
            try:
                await self._ports.action_runtime.cancel_action(
                    tenant_id=context.tenant_id,
                    action_id=context.action_ref["action_id"],
                    reason="workflow_rollback",
                )
            except Exception:  # noqa: BLE001
                pass
        return _ok(self.name, metadata={"rollback": "compensation"})

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return True


class MemoryConsolidationStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.MEMORY_CONSOLIDATION.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if self._ports.memory is None or not self._ports.feature_flags.memory_module_enabled:
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status != StageRunStatus.COMPLETED:
            return context, validation
        if not _memory_content_writes_allowed(context):
            return context, _skip(self.name)
        try:
            memories = await self._ports.memory.consolidate(  # type: ignore[union-attr]
                tenant_id=context.tenant_id,
                correlation_id=context.correlation_id,
                request_id=context.request_id,
                workflow_id=context.workflow_id,
                conversation_id=context.conversation_id,
                company_id=context.company_id,
            )
        except Exception as exc:  # noqa: BLE001
            return context, _ok(self.name, {"warning": str(exc)})
        snapshot = {"consolidated_count": len(memories), "memory_ids": [m.memory_id for m in memories]}
        return context.model_copy(update={"memory_consolidation_ref": snapshot}), _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return False


class StreamingStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.STREAMING.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        if (
            self._ports.streaming_runtime is None
            or not self._ports.feature_flags.streaming_runtime_module_enabled
        ):
            return _skip(self.name)
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        validation = await self.validate(context)
        if validation.status != StageRunStatus.COMPLETED:
            return context, validation
        workflow_id = context.workflow_id
        try:
            session = await self._ports.streaming_runtime.open_stream(  # type: ignore[union-attr]
                workflow_id=workflow_id,
                tenant_id=context.tenant_id,
                request_id=context.request_id,
                client_id=f"orchestrator-{context.workflow_id[:8]}",
                conversation_id=context.conversation_id,
                company_id=context.company_id,
                execution_id=context.execution_ref.get("execution_id") if context.execution_ref else None,
            )
            await self._ports.streaming_runtime.ingest_workflow_event(  # type: ignore[union-attr]
                workflow_id=workflow_id,
                tenant_id=context.tenant_id,
                request_id=context.request_id,
                event_type=WorkflowEventType.WORKFLOW_STARTED,
                payload={"source": "orchestrator"},
                conversation_id=context.conversation_id,
                company_id=context.company_id,
            )
        except Exception as exc:  # noqa: BLE001 — streaming must not fail workflow
            return context, _ok(self.name, {"warning": str(exc)})
        snapshot = {"stream_id": session.stream_id}
        return context.model_copy(update={"stream_ref": snapshot}), _ok(self.name, snapshot)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        if self._ports.streaming_runtime and context.stream_ref:
            try:
                await self._ports.streaming_runtime.close_stream(
                    tenant_id=context.tenant_id,
                    stream_id=context.stream_ref["stream_id"],
                )
            except Exception:  # noqa: BLE001
                pass
        return _ok(self.name, metadata={"rollback": "close_stream"})

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return False


class FinalizeStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.FINALIZE.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        response_ref = {
            "plan_id": (context.plan_ref or {}).get("plan_id"),
            "route_id": (context.route_ref or {}).get("route_id"),
            "knowledge_snapshot_id": (context.knowledge_ref or {}).get("snapshot_id"),
            "memory_store_id": (context.memory_store_ref or {}).get("memory_id"),
            "execution_id": (context.execution_ref or {}).get("execution_id"),
            "memory_update_id": (context.memory_update_ref or {}).get("memory_id"),
            "evaluation_id": (context.quality_ref or {}).get("evaluation_id"),
            "action_id": (context.action_ref or {}).get("action_id"),
            "memory_consolidation": context.memory_consolidation_ref,
            "stream_id": (context.stream_ref or {}).get("stream_id"),
        }
        if context.response_ref and context.response_ref.get("text"):
            response_ref["text"] = context.response_ref["text"]
        if self._ports.conversation and context.conversation_id and context.response_ref:
            assistant_text = context.response_ref.get("text", "")
            if assistant_text:
                await self._ports.conversation.record_assistant_message(
                    tenant_id=context.tenant_id,
                    conversation_id=context.conversation_id,
                    request_id=context.request_id,
                    correlation_id=context.correlation_id,
                    content=assistant_text,
                    language=context.language,
                )
        return context.model_copy(update={"response_ref": response_ref}), _ok(self.name, response_ref)

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return False


class PersistenceStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.PERSISTENCE.value

    def __init__(self, ports: ModulePorts, repository) -> None:
        self._ports = ports
        self._repository = repository

    async def validate(self, context: WorkflowContext) -> StageResult:
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        return context, _ok(self.name, {"persisted": True})

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return False


class PublicationStageAdapter(WorkflowStagePort):
    name = WorkflowStageName.PUBLICATION.value

    def __init__(self, ports: ModulePorts) -> None:
        self._ports = ports

    async def validate(self, context: WorkflowContext) -> StageResult:
        return _ok(self.name)

    async def execute(self, context: WorkflowContext) -> tuple[WorkflowContext, StageResult]:
        await self._ports.outbox_dispatcher.dispatch_pending(limit=50)
        return context, _ok(self.name, {"dispatched": True})

    async def rollback(self, context: WorkflowContext) -> StageResult:
        return _skip(self.name)

    def metrics(self) -> dict[str, Any]:
        return {"stage": self.name}

    def supports_retry(self) -> bool:
        return False
