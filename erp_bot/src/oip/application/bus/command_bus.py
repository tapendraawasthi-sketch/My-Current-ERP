"""Command bus — dispatches commands to registered handlers (CQRS)."""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, Generic, Type, TypeVar

from ...shared.exceptions import OipValidationError

C = TypeVar("C")
R = TypeVar("R")

CommandHandler = Callable[[Any], Awaitable[Any]]


class CommandBus:
    def __init__(self) -> None:
        self._handlers: Dict[str, CommandHandler] = {}

    def register(self, command_type: str, handler: CommandHandler) -> None:
        if command_type in self._handlers:
            raise OipValidationError(f"Handler already registered for {command_type}")
        self._handlers[command_type] = handler

    async def dispatch(self, command: Any) -> Any:
        command_type = getattr(command, "command_type", command.__class__.__name__)
        handler = self._handlers.get(command_type)
        if handler is None:
            raise OipValidationError(f"No handler registered for command type: {command_type}")
        return await handler(command)
