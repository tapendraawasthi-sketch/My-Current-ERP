"""Conversation module queries."""

from __future__ import annotations

from pydantic import Field

from ....application.queries import Query
from ....shared.ids import ConversationId, SessionId


class GetConversationQuery(Query):
    query_type: str = "oip.query.conversation.get.v1"
    conversation_id: ConversationId


class GetConversationBySessionQuery(Query):
    query_type: str = "oip.query.conversation.get_by_session.v1"
    session_id: SessionId
    module: str


class GetConversationHistoryQuery(Query):
    query_type: str = "oip.query.conversation.get_history.v1"
    conversation_id: ConversationId
    limit: int = Field(default=100, ge=1, le=500)
    after_sequence: int = Field(default=0, ge=0)
