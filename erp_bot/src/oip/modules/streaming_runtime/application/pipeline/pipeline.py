"""Streaming Runtime pipeline orchestrator."""

from __future__ import annotations

from ...domain.entities import StreamingSession
from ...domain.value_objects import WorkflowEventType
from .context import StreamPipelineContext
from .stages import StreamStage


class StreamingRuntimePipeline:
    def __init__(self, stages: tuple[StreamStage, ...]) -> None:
        self._stages = stages

    @property
    def stage_names(self) -> tuple[str, ...]:
        return tuple(stage.name for stage in self._stages)

    async def execute(
        self,
        *,
        session: StreamingSession,
        event_type: WorkflowEventType,
        payload: dict,
        request_id: str,
    ) -> StreamPipelineContext:
        context = StreamPipelineContext(
            session=session,
            event_type=event_type,
            raw_payload=payload,
            request_id=request_id,
        )
        for stage in self._stages:
            context = await stage.run(context)
        return context
