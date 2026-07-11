"""Query bus — dispatches read-model queries (CQRS)."""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict

from ...shared.exceptions import OipValidationError

QueryHandler = Callable[[Any], Awaitable[Any]]


class QueryBus:
    def __init__(self) -> None:
        self._handlers: Dict[str, QueryHandler] = {}

    def register(self, query_type: str, handler: QueryHandler) -> None:
        if query_type in self._handlers:
            raise OipValidationError(f"Handler already registered for {query_type}")
        self._handlers[query_type] = handler

    async def dispatch(self, query: Any) -> Any:
        query_type = getattr(query, "query_type", query.__class__.__name__)
        handler = self._handlers.get(query_type)
        if handler is None:
            raise OipValidationError(f"No handler registered for query type: {query_type}")
        return await handler(query)
