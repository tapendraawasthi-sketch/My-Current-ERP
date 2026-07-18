"""Contract error codes and validation exceptions."""

from __future__ import annotations

from enum import Enum


class ContractErrorCode(str, Enum):
    UNSUPPORTED_SCHEMA_VERSION = "UNSUPPORTED_SCHEMA_VERSION"
    INVALID_CONTRACT = "INVALID_CONTRACT"
    INVALID_RESPONSE_PAYLOAD = "INVALID_RESPONSE_PAYLOAD"
    INVALID_EVENT_FRAME = "INVALID_EVENT_FRAME"
    INVALID_TOOL_ARGUMENTS = "INVALID_TOOL_ARGUMENTS"
    INVALID_EVIDENCE_REFERENCE = "INVALID_EVIDENCE_REFERENCE"
    INVALID_DRAFT_REFERENCE = "INVALID_DRAFT_REFERENCE"
    INVALID_PREVIEW = "INVALID_PREVIEW"
    INVALID_RECEIPT = "INVALID_RECEIPT"
    LEGACY_ADAPTER_FAILED = "LEGACY_ADAPTER_FAILED"
    CLIENT_TRUSTED_SCOPE_FORBIDDEN = "CLIENT_TRUSTED_SCOPE_FORBIDDEN"
    EXECUTION_AUTHORITY_FORBIDDEN = "EXECUTION_AUTHORITY_FORBIDDEN"
    MONEY_FLOAT_FORBIDDEN = "MONEY_FLOAT_FORBIDDEN"
    RESPONSE_PAYLOAD_MISMATCH = "RESPONSE_PAYLOAD_MISMATCH"


class ContractValidationError(ValueError):
    def __init__(self, code: ContractErrorCode, message: str, *, field: str | None = None) -> None:
        self.code = code
        self.field = field
        super().__init__(f"{code.value}: {message}")

    def to_safe_dict(self) -> dict[str, str]:
        payload = {"error": self.code.value, "message": str(self.args[0])}
        if self.field:
            payload["field"] = self.field
        return payload
