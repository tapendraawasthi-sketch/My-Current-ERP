"""ERP context snapshots — staleness rejection (Constitution P0)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FiscalPeriodStatus(BaseModel):
    model_config = ConfigDict(frozen=True)

    is_open: bool
    fiscal_period_id: str | None = None
    closed_at: datetime | None = None
    reason: str | None = None


class ErpContextSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True)

    snapshot_id: str
    tenant_id: str
    company_id: str
    branch_id: str | None = None
    captured_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    erp_schema_version: str = "1.0.0"
    chart_of_accounts_excerpt: dict[str, Any] = Field(default_factory=dict)
    fiscal_period: FiscalPeriodStatus = Field(default_factory=lambda: FiscalPeriodStatus(is_open=True))
    metadata: dict[str, Any] = Field(default_factory=dict)

    def is_stale(self, *, max_age_seconds: float) -> bool:
        age = (datetime.now(timezone.utc) - self.captured_at).total_seconds()
        return age > max_age_seconds
