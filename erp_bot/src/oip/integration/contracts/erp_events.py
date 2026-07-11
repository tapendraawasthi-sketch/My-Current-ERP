"""ERP domain event contracts — OEC → OIP."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ErpEventType(str, Enum):
    VOUCHER_POSTED = "oec.event.voucher.posted.v1"
    VOUCHER_CREATED = "oec.event.voucher.created.v1"
    FISCAL_PERIOD_CLOSED = "oec.event.fiscal.period_closed.v1"
    COMPANY_SETTINGS_CHANGED = "oec.event.company.settings_changed.v1"
    INVENTORY_ADJUSTED = "oec.event.inventory.adjusted.v1"


class ErpDomainEventEnvelope(BaseModel):
    model_config = ConfigDict(frozen=True)

    contract_version: str = "1.0.0"
    event_id: str
    event_type: ErpEventType
    tenant_id: str
    company_id: str
    branch_id: str | None = None
    sequence_number: int = 0
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payload: dict[str, Any] = Field(default_factory=dict)
