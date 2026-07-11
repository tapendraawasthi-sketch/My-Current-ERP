"""ERP command contracts — OIP → OEC via Integration Gateway."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ErpCommandType(str, Enum):
    POST_JOURNAL_ENTRY = "oec.command.journal.post.v1"
    QUERY_LEDGER_BALANCE = "oec.command.ledger.balance.v1"
    QUERY_PARTY_BALANCE = "oec.command.party.balance.v1"
    GET_COA_SNAPSHOT = "oec.command.coa.snapshot.v1"
    IS_PERIOD_OPEN = "oec.command.fiscal.is_period_open.v1"
    GENERATE_FINANCIAL_REPORT = "oec.command.report.generate.v1"
    CALCULATE_VAT = "oec.command.vat.calculate.v1"
    APPROVE_PENDING_ACTION = "oec.command.approval.approve.v1"


class ErpCommandEnvelope(BaseModel):
    model_config = ConfigDict(frozen=True)

    contract_version: str = "1.0.0"
    command_id: str
    command_type: ErpCommandType
    tenant_id: str
    company_id: str
    branch_id: str | None = None
    idempotency_key: str
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payload: dict[str, Any] = Field(default_factory=dict)
