"""ERP command and query handler registries — no switch statements."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from ......integration.contracts.erp_commands import ErpCommandType
from .sutra_erp_service import SutraErpService

CommandHandler = Callable[[SutraErpService, dict[str, Any]], Awaitable[dict[str, Any]]]
QueryHandler = Callable[[SutraErpService, dict[str, Any]], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class CommandHandlerDefinition:
    command_type: str
    handler: CommandHandler


@dataclass(frozen=True)
class QueryHandlerDefinition:
    query_type: str
    handler: QueryHandler


class ErpCommandHandlerRegistry:
    def __init__(self) -> None:
        self._handlers: dict[str, CommandHandler] = {}

    def register(self, definition: CommandHandlerDefinition) -> None:
        self._handlers[definition.command_type] = definition.handler

    async def dispatch(self, *, command_type: str, service: SutraErpService, payload: dict[str, Any]) -> dict[str, Any]:
        handler = self._handlers.get(command_type)
        if handler is None:
            raise ValueError(f"Unsupported ERP command type: {command_type}")
        return await handler(service, payload)


class ErpQueryHandlerRegistry:
    def __init__(self) -> None:
        self._handlers: dict[str, QueryHandler] = {}

    def register(self, definition: QueryHandlerDefinition) -> None:
        self._handlers[definition.query_type] = definition.handler

    async def dispatch(self, *, query_type: str, service: SutraErpService, payload: dict[str, Any]) -> dict[str, Any]:
        handler = self._handlers.get(query_type)
        if handler is None:
            raise ValueError(f"Unsupported ERP query type: {query_type}")
        return await handler(service, payload)


def create_default_command_registry() -> ErpCommandHandlerRegistry:
    registry = ErpCommandHandlerRegistry()
    definitions = (
        CommandHandlerDefinition(ErpCommandType.POST_JOURNAL_ENTRY.value, lambda s, p: s.post_journal_entry(p)),
        CommandHandlerDefinition(ErpCommandType.APPROVE_PENDING_ACTION.value, lambda s, p: s.approve_pending_action(p)),
    )
    for definition in definitions:
        registry.register(definition)
    return registry


def create_default_query_registry() -> ErpQueryHandlerRegistry:
    registry = ErpQueryHandlerRegistry()
    definitions = (
        QueryHandlerDefinition(ErpCommandType.QUERY_LEDGER_BALANCE.value, lambda s, p: s.query_ledger_balance(p)),
        QueryHandlerDefinition(ErpCommandType.GET_COA_SNAPSHOT.value, lambda s, p: s.get_coa_snapshot(p)),
        QueryHandlerDefinition(ErpCommandType.IS_PERIOD_OPEN.value, lambda s, p: s.is_period_open(p)),
        QueryHandlerDefinition(ErpCommandType.GENERATE_FINANCIAL_REPORT.value, lambda s, p: s.generate_financial_report(p)),
        QueryHandlerDefinition(ErpCommandType.CALCULATE_VAT.value, lambda s, p: s.calculate_vat(p)),
        QueryHandlerDefinition(ErpCommandType.QUERY_PARTY_BALANCE.value, lambda s, p: s.query_party_balance(p)),
    )
    for definition in definitions:
        registry.register(definition)
    return registry
