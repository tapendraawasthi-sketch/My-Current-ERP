"""Schema version registry for MAI-02 contracts."""

from __future__ import annotations

from dataclasses import dataclass

CURRENT_SCHEMA_VERSION = "1.0.0"
SUPPORTED_MAJOR = frozenset({1})
SUPPORTED_VERSIONS = frozenset({"1.0.0"})


class UnsupportedSchemaVersionError(ValueError):
    def __init__(self, version: str) -> None:
        self.version = version
        super().__init__(f"UNSUPPORTED_SCHEMA_VERSION: {version}")


def parse_schema_version(version: str) -> tuple[int, int, int]:
    parts = str(version).strip().split(".")
    if len(parts) != 3 or not all(p.isdigit() for p in parts):
        raise UnsupportedSchemaVersionError(version)
    major, minor, patch = (int(p) for p in parts)
    if major not in SUPPORTED_MAJOR:
        raise UnsupportedSchemaVersionError(version)
    return major, minor, patch


@dataclass(frozen=True)
class ContractRegistry:
    current_version: str = CURRENT_SCHEMA_VERSION

    def list_supported(self) -> tuple[str, ...]:
        return tuple(sorted(SUPPORTED_VERSIONS))

    def assert_supported(self, version: str) -> str:
        parse_schema_version(version)
        # Accept same major for forward minor/patch within published set or 1.x compatible.
        major, _, _ = parse_schema_version(version)
        if major != 1:
            raise UnsupportedSchemaVersionError(version)
        return version

    def select_adapter_name(self, version: str) -> str:
        self.assert_supported(version)
        return "v1"


_REGISTRY = ContractRegistry()


def get_contract_registry() -> ContractRegistry:
    return _REGISTRY
