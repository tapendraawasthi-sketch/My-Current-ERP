"""Dynamic connector registry — no switch statements."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .value_objects import ConnectorType


class ConnectorDriver(Protocol):
    connector_type: str

    async def execute_command(
        self,
        *,
        connector_id: str,
        command_type: str,
        payload: dict,
        config: dict,
    ) -> dict: ...

    async def execute_query(
        self,
        *,
        connector_id: str,
        query_type: str,
        payload: dict,
        config: dict,
    ) -> dict: ...

    async def health_check(self, *, connector_id: str, config: dict) -> dict: ...


@dataclass(frozen=True)
class ConnectorTypeDefinition:
    connector_type: ConnectorType
    driver_name: str
    description: str


class ConnectorRegistry:
    def __init__(self) -> None:
        self._types: dict[str, ConnectorTypeDefinition] = {}
        self._drivers: dict[str, ConnectorDriver] = {}

    def register_type(self, definition: ConnectorTypeDefinition) -> None:
        self._types[definition.connector_type.value] = definition

    def register_driver(self, driver: ConnectorDriver) -> None:
        self._drivers[driver.connector_type] = driver

    def resolve_driver_name(self, connector_type: ConnectorType | str) -> str | None:
        key = connector_type.value if isinstance(connector_type, ConnectorType) else connector_type
        definition = self._types.get(key)
        if definition is not None:
            return definition.driver_name
        if key in self._drivers:
            return key
        lowered = key.lower()
        for candidate in self._types.values():
            if candidate.driver_name.lower() == lowered or candidate.connector_type.value.lower() == lowered:
                return candidate.driver_name
        return None

    def get_driver(self, connector_type: ConnectorType | str) -> ConnectorDriver | None:
        name = self.resolve_driver_name(connector_type)
        return self._drivers.get(name) if name else None

    def list_types(self) -> tuple[ConnectorTypeDefinition, ...]:
        return tuple(self._types.values())


def create_default_connector_registry() -> ConnectorRegistry:
    registry = ConnectorRegistry()
    definitions = (
        ConnectorTypeDefinition(ConnectorType.MOCK, "mock", "Development mock connector"),
        ConnectorTypeDefinition(ConnectorType.SQLITE, "sqlite", "SQLite local connector"),
        ConnectorTypeDefinition(ConnectorType.POSTGRESQL, "postgresql", "PostgreSQL connector"),
        ConnectorTypeDefinition(ConnectorType.MYSQL, "mysql", "MySQL connector"),
        ConnectorTypeDefinition(ConnectorType.SQL_SERVER, "sqlserver", "SQL Server connector"),
        ConnectorTypeDefinition(ConnectorType.REST, "rest", "REST API connector"),
        ConnectorTypeDefinition(ConnectorType.GRAPHQL, "graphql", "GraphQL connector"),
        ConnectorTypeDefinition(ConnectorType.SUTRA, "sutra", "Sutra ERP production connector"),
        ConnectorTypeDefinition(ConnectorType.OFFLINE, "offline", "Offline queue connector"),
        ConnectorTypeDefinition(ConnectorType.REPLAY, "replay", "Replay stored executions"),
    )
    for definition in definitions:
        registry.register_type(definition)
    return registry
