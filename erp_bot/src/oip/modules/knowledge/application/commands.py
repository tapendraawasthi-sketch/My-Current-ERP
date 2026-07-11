"""Knowledge Runtime commands."""

from __future__ import annotations

from typing import Any

from ....application.commands import Command
from ....shared.ids import RequestId


class RetrieveKnowledgeCommand(Command):
    command_type: str = "oip.command.knowledge.retrieve.v1"
    request_id: RequestId
    query: str
    jurisdiction: str = "nepal"
    as_of: str | None = None
    mode: str = "hybrid"
    company_id: str | None = None


class IndexKnowledgeCommand(Command):
    command_type: str = "oip.command.knowledge.index_document.v1"
    collection_id: str
    title: str
    content: str
    authority_level: str = "approved_internal_knowledge"
    jurisdiction: str = "nepal"
    effective_from: str
    effective_to: str | None = None
    company_id: str | None = None
    tags: tuple[str, ...] = ()
    metadata: dict[str, Any] = {}


class ReembedKnowledgeCommand(Command):
    command_type: str = "oip.command.knowledge.reembed.v1"
    collection_id: str | None = None
    campaign_name: str = "default"
