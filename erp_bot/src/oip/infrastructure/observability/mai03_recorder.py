"""MAI-03 TraceEventV1 + TraceRecorder + sinks."""

from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import uuid4

from .mai03_context import TraceContextV1, get_trace_context
from .mai03_identity import TRACE_SCHEMA_VERSION, new_opaque_id
from .mai03_redaction import REDACTION_VERSION, validate_safe_event
from .mai03_stages import TERMINAL_STAGES, TraceStage, TraceStatus, assert_known_stage


@dataclass
class TraceEventV1:
    schema_version: str
    trace_id: str
    request_id: str
    event_id: str
    parent_event_id: str | None
    stage: TraceStage
    status: TraceStatus
    started_at: datetime
    completed_at: datetime | None
    duration_ms: int | None
    route: str | None
    component: str
    operation: str | None
    outcome_code: str | None
    safe_error_code: str | None
    tenant_scope_reference: str | None
    company_scope_reference: str | None
    principal_reference: str | None
    conversation_reference: str | None
    component_versions: dict[str, str]
    metrics: dict[str, float | int]
    safe_attributes: dict[str, Any]
    redaction_version: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "trace_id": self.trace_id,
            "request_id": self.request_id,
            "event_id": self.event_id,
            "parent_event_id": self.parent_event_id,
            "stage": self.stage.value,
            "status": self.status.value,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": self.duration_ms,
            "route": self.route,
            "component": self.component,
            "operation": self.operation,
            "outcome_code": self.outcome_code,
            "safe_error_code": self.safe_error_code,
            "tenant_scope_reference": self.tenant_scope_reference,
            "company_scope_reference": self.company_scope_reference,
            "principal_reference": self.principal_reference,
            "conversation_reference": self.conversation_reference,
            "component_versions": dict(self.component_versions),
            "metrics": dict(self.metrics),
            "safe_attributes": dict(self.safe_attributes),
            "redaction_version": self.redaction_version,
        }


class TraceSinkPort(Protocol):
    def emit(self, event: dict[str, Any]) -> None: ...

    def query(
        self, trace_reference: str, *, trusted_scope: dict[str, str]
    ) -> dict[str, Any] | None: ...

    def health(self) -> dict[str, Any]: ...


class InMemoryTraceSink:
    """Bounded test/dev sink — NOT durable production observability."""

    def __init__(self, capacity: int = 500) -> None:
        self._events: deque[dict[str, Any]] = deque(maxlen=capacity)
        self._lock = threading.Lock()

    def emit(self, event: dict[str, Any]) -> None:
        with self._lock:
            self._events.append(dict(event))

    def query(self, trace_reference: str, *, trusted_scope: dict[str, str]) -> dict[str, Any] | None:
        with self._lock:
            matches = [
                e
                for e in self._events
                if e.get("safe_attributes", {}).get("trace_reference") == trace_reference
                or (
                    e.get("trace_id")
                    and trace_reference.endswith(_short(e.get("request_id", "")))
                )
            ]
        if not matches:
            return None
        tenant = trusted_scope.get("tenant_id")
        for e in matches:
            ref = e.get("tenant_scope_reference")
            if tenant and ref and ref != tenant:
                return None  # deny without existence leak → treat as missing
        return {
            "trace_reference": trace_reference,
            "event_count": len(matches),
            "events": matches[-50:],
            "sink": "in_memory",
        }

    def health(self) -> dict[str, Any]:
        return {"ok": True, "sink": "in_memory", "durable": False, "count": len(self._events)}

    def clear(self) -> None:
        with self._lock:
            self._events.clear()

    def all_events(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._events)


def _short(value: str) -> str:
    return str(value).replace("-", "")[:8]


class StructuredLogTraceSink:
    """Production-safe foundation: sanitized structured logs only."""

    def emit(self, event: dict[str, Any]) -> None:
        from .logging import logger
        import json

        logger.info(json.dumps({"event": "mai03.trace", **event}, default=str))

    def query(self, trace_reference: str, *, trusted_scope: dict[str, str]) -> dict[str, Any] | None:
        return None  # not queryable

    def health(self) -> dict[str, Any]:
        return {"ok": True, "sink": "structured_log", "durable": False, "queryable": False}


@dataclass
class _OpenStage:
    stage: TraceStage
    event_id: str
    started_at: datetime
    start_perf: float
    parent_event_id: str | None = None
    component: str = "oip"
    operation: str | None = None
    route: str | None = None
    component_versions: dict[str, str] = field(default_factory=dict)
    safe_attributes: dict[str, Any] = field(default_factory=dict)


class TraceRecorder:
    def __init__(self, sinks: list[TraceSinkPort] | None = None) -> None:
        self._sinks = list(sinks or [])
        self._open: dict[str, _OpenStage] = {}
        self._terminal_emitted = False
        self._lock = threading.Lock()

    def add_sink(self, sink: TraceSinkPort) -> None:
        self._sinks.append(sink)

    def _ctx(self) -> TraceContextV1:
        ctx = get_trace_context()
        if ctx is None:
            raise RuntimeError("TRACE_CONTEXT_MISSING")
        return ctx

    def _emit(self, event: TraceEventV1) -> None:
        payload = validate_safe_event(event.to_dict())
        for sink in self._sinks:
            try:
                sink.emit(payload)
            except Exception:  # noqa: BLE001 — sink failure must not break request
                continue

    def start_stage(
        self,
        stage: str | TraceStage,
        *,
        component: str = "oip",
        operation: str | None = None,
        route: str | None = None,
        component_versions: dict[str, str] | None = None,
        safe_attributes: dict[str, Any] | None = None,
    ) -> str:
        st = assert_known_stage(stage)
        ctx = self._ctx()
        event_id = new_opaque_id()
        now = datetime.now(timezone.utc)
        open_stage = _OpenStage(
            stage=st,
            event_id=event_id,
            started_at=now,
            start_perf=time.perf_counter(),
            component=component,
            operation=operation,
            route=route,
            component_versions=dict(component_versions or {}),
            safe_attributes={
                **(safe_attributes or {}),
                "trace_reference": ctx.trace_reference,
            },
        )
        with self._lock:
            self._open[event_id] = open_stage
        self._emit(
            TraceEventV1(
                schema_version=TRACE_SCHEMA_VERSION,
                trace_id=ctx.trace_id,
                request_id=ctx.request_id,
                event_id=event_id,
                parent_event_id=None,
                stage=st,
                status=TraceStatus.STARTED,
                started_at=now,
                completed_at=None,
                duration_ms=None,
                route=route,
                component=component,
                operation=operation,
                outcome_code=None,
                safe_error_code=None,
                tenant_scope_reference=ctx.tenant_scope_reference,
                company_scope_reference=ctx.company_scope_reference,
                principal_reference=ctx.principal_reference,
                conversation_reference=ctx.conversation_reference,
                component_versions=dict(component_versions or {}),
                metrics={},
                safe_attributes=dict(open_stage.safe_attributes),
                redaction_version=REDACTION_VERSION,
            )
        )
        return event_id

    def _finish(
        self,
        event_id: str,
        status: TraceStatus,
        *,
        outcome_code: str | None = None,
        safe_error_code: str | None = None,
        metrics: dict[str, float | int] | None = None,
        component_versions: dict[str, str] | None = None,
        safe_attributes: dict[str, Any] | None = None,
    ) -> None:
        ctx = self._ctx()
        with self._lock:
            open_stage = self._open.pop(event_id, None)
            if status in {TraceStatus.COMPLETED, TraceStatus.FAILED, TraceStatus.CANCELLED} and open_stage and open_stage.stage in TERMINAL_STAGES:
                if self._terminal_emitted:
                    return
                self._terminal_emitted = True
            elif open_stage and open_stage.stage in TERMINAL_STAGES:
                if self._terminal_emitted and status != TraceStatus.STARTED:
                    return
                if status != TraceStatus.STARTED:
                    self._terminal_emitted = True
        if open_stage is None:
            # Allow terminal without start for fail-closed cases.
            if assert_known_stage is not None:
                pass
            duration_ms = 0
            started = datetime.now(timezone.utc)
            stage = TraceStage.REQUEST_FAILED
            component = "oip"
            operation = None
            route = None
            versions: dict[str, str] = {}
            attrs: dict[str, Any] = {"trace_reference": ctx.trace_reference}
            eid = event_id or new_opaque_id()
        else:
            duration_ms = max(0, int((time.perf_counter() - open_stage.start_perf) * 1000))
            started = open_stage.started_at
            stage = open_stage.stage
            component = open_stage.component
            operation = open_stage.operation
            route = open_stage.route
            versions = dict(open_stage.component_versions)
            attrs = dict(open_stage.safe_attributes)
            eid = open_stage.event_id
        if component_versions:
            versions.update(component_versions)
        if safe_attributes:
            attrs.update(safe_attributes)
        attrs["trace_reference"] = ctx.trace_reference
        completed = datetime.now(timezone.utc)
        self._emit(
            TraceEventV1(
                schema_version=TRACE_SCHEMA_VERSION,
                trace_id=ctx.trace_id,
                request_id=ctx.request_id,
                event_id=eid,
                parent_event_id=None,
                stage=stage,
                status=status,
                started_at=started,
                completed_at=completed,
                duration_ms=duration_ms,
                route=route,
                component=component,
                operation=operation,
                outcome_code=outcome_code,
                safe_error_code=safe_error_code,
                tenant_scope_reference=ctx.tenant_scope_reference,
                company_scope_reference=ctx.company_scope_reference,
                principal_reference=ctx.principal_reference,
                conversation_reference=ctx.conversation_reference,
                component_versions=versions,
                metrics=dict(metrics or {"duration_ms": duration_ms}),
                safe_attributes=attrs,
                redaction_version=REDACTION_VERSION,
            )
        )

    def complete_stage(self, event_id: str, **kwargs: Any) -> None:
        self._finish(event_id, TraceStatus.COMPLETED, **kwargs)

    def fail_stage(self, event_id: str, *, safe_error_code: str, **kwargs: Any) -> None:
        self._finish(event_id, TraceStatus.FAILED, safe_error_code=safe_error_code, **kwargs)

    def cancel_stage(self, event_id: str, **kwargs: Any) -> None:
        self._finish(event_id, TraceStatus.CANCELLED, **kwargs)

    def record_event(
        self,
        stage: str | TraceStage,
        status: TraceStatus,
        *,
        safe_error_code: str | None = None,
        outcome_code: str | None = None,
        duration_ms: int | None = None,
        component: str = "oip",
        component_versions: dict[str, str] | None = None,
        safe_attributes: dict[str, Any] | None = None,
        route: str | None = None,
        operation: str | None = None,
    ) -> None:
        st = assert_known_stage(stage)
        ctx = self._ctx()
        if st in TERMINAL_STAGES:
            with self._lock:
                if self._terminal_emitted:
                    return
                self._terminal_emitted = True
        now = datetime.now(timezone.utc)
        dur = 0 if duration_ms is None else max(0, int(duration_ms))
        attrs = {**(safe_attributes or {}), "trace_reference": ctx.trace_reference}
        self._emit(
            TraceEventV1(
                schema_version=TRACE_SCHEMA_VERSION,
                trace_id=ctx.trace_id,
                request_id=ctx.request_id,
                event_id=new_opaque_id(),
                parent_event_id=None,
                stage=st,
                status=status,
                started_at=now,
                completed_at=now if status != TraceStatus.STARTED else None,
                duration_ms=dur if status != TraceStatus.STARTED else None,
                route=route,
                component=component,
                operation=operation,
                outcome_code=outcome_code,
                safe_error_code=safe_error_code,
                tenant_scope_reference=ctx.tenant_scope_reference,
                company_scope_reference=ctx.company_scope_reference,
                principal_reference=ctx.principal_reference,
                conversation_reference=ctx.conversation_reference,
                component_versions=dict(component_versions or {}),
                metrics={"duration_ms": dur} if dur is not None else {},
                safe_attributes=attrs,
                redaction_version=REDACTION_VERSION,
            )
        )

    def reset_terminal_guard(self) -> None:
        with self._lock:
            self._terminal_emitted = False
            self._open.clear()


# Process-wide default sinks (tests replace/clear).
_MEMORY_SINK = InMemoryTraceSink()
_LOG_SINK = StructuredLogTraceSink()
_RECORDER = TraceRecorder(sinks=[_MEMORY_SINK, _LOG_SINK])


def get_trace_recorder() -> TraceRecorder:
    return _RECORDER


def get_memory_trace_sink() -> InMemoryTraceSink:
    return _MEMORY_SINK


def reset_trace_recorder_for_tests() -> None:
    _MEMORY_SINK.clear()
    _RECORDER.reset_terminal_guard()
