"""Build streaming runtime pipeline."""

from __future__ import annotations

from ..domain.event_order_registry import create_default_event_order_registry
from ..application.pipeline.pipeline import StreamingRuntimePipeline
from ..application.pipeline.stages import (
    AckStage,
    CleanupStage,
    PersistStage,
    PublishStage,
    ReceiveStage,
    SequenceStage,
    ValidateStage,
)
from ..application.ports.replay_buffer_port import ReplayBufferPort
from ..application.ports.stream_repository_port import StreamRepositoryPort
from ..application.ports.streaming_runtime_ports import StreamingTransportPort


def build_streaming_pipeline(
    *,
    repository: StreamRepositoryPort,
    replay_buffer: ReplayBufferPort,
    transport: StreamingTransportPort,
    shadow_mode: bool = False,
    replay_buffer_size: int = 1000,
) -> StreamingRuntimePipeline:
    order_registry = create_default_event_order_registry()
    stages = (
        ReceiveStage(),
        ValidateStage(order_registry, repository),
        SequenceStage(repository),
        PersistStage(repository, replay_buffer),
        PublishStage(transport, shadow_mode=shadow_mode),
        AckStage(repository),
        CleanupStage(replay_buffer, buffer_size=replay_buffer_size),
    )
    return StreamingRuntimePipeline(stages=stages)
