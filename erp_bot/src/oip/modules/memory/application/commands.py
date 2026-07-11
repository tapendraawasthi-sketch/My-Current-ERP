"""Memory Runtime commands."""

from __future__ import annotations

from typing import Any

from ....application.commands import Command
from ....shared.ids import RequestId


class StoreMemoryCommand(Command):
    command_type: str = "oip.command.memory.store.v1"
    request_id: RequestId
    summary: str
    content: str = ""
    memory_type: str = "ConversationMemory"
    source_module: str = "api"
    company_id: str | None = None
    conversation_id: str | None = None
    workflow_id: str | None = None
    importance: str = "Medium"
    confidence: float = 0.8
    tags: tuple[str, ...] = ()
    entities: tuple[dict[str, Any], ...] = ()
    metadata: dict[str, Any] = {}


class UpdateMemoryCommand(Command):
    command_type: str = "oip.command.memory.update.v1"
    memory_id: str
    summary: str | None = None
    content: str | None = None
    importance: str | None = None
    confidence: float | None = None
    tags: tuple[str, ...] | None = None
    metadata: dict[str, Any] | None = None


class MergeMemoryCommand(Command):
    command_type: str = "oip.command.memory.merge.v1"
    primary_memory_id: str
    secondary_memory_id: str
    strategy: str = "union"


class ArchiveMemoryCommand(Command):
    command_type: str = "oip.command.memory.archive.v1"
    memory_id: str


class DeleteMemoryCommand(Command):
    command_type: str = "oip.command.memory.delete.v1"
    memory_id: str


class ExpireMemoryCommand(Command):
    command_type: str = "oip.command.memory.expire.v1"
    memory_id: str | None = None
    tenant_wide: bool = False


class PromoteMemoryCommand(Command):
    command_type: str = "oip.command.memory.promote.v1"
    memory_id: str


class DemoteMemoryCommand(Command):
    command_type: str = "oip.command.memory.demote.v1"
    memory_id: str


class ConsolidateMemoryCommand(Command):
    command_type: str = "oip.command.memory.consolidate.v1"
    workflow_id: str | None = None
    conversation_id: str | None = None
    company_id: str | None = None


class RecallMemoryCommand(Command):
    command_type: str = "oip.command.memory.recall.v1"
    request_id: RequestId
    query: str
    mode: str = "Hybrid"
    company_id: str | None = None
    conversation_id: str | None = None
    workflow_id: str | None = None
    limit: int = 20
