"""Streaming Runtime commands."""

from __future__ import annotations

from typing import Any

from ....application.commands import Command
from ....shared.ids import RequestId


class OpenStreamCommand(Command):
    command_type: str = "oip.command.streaming_runtime.open_stream.v1"
    workflow_id: str
    request_id: RequestId
    client_id: str
    protocol: str = "sse"
    conversation_id: str | None = None
    company_id: str | None = None
    execution_id: str | None = None


class CloseStreamCommand(Command):
    command_type: str = "oip.command.streaming_runtime.close_stream.v1"
    stream_id: str


class IngestWorkflowEventCommand(Command):
    command_type: str = "oip.command.streaming_runtime.ingest_workflow_event.v1"
    workflow_id: str
    request_id: RequestId
    event_type: str
    payload: dict[str, Any] = {}
    conversation_id: str | None = None
    company_id: str | None = None
    execution_id: str | None = None


class ReconnectStreamCommand(Command):
    command_type: str = "oip.command.streaming_runtime.reconnect_stream.v1"
    stream_id: str
    client_id: str
    last_sequence: int = 0
