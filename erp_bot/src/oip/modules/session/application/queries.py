"""Session module queries."""

from __future__ import annotations

from ....application.queries import Query
from ....shared.ids import SessionId


class GetSessionQuery(Query):
    query_type: str = "oip.query.session.get.v1"
    session_id: SessionId
