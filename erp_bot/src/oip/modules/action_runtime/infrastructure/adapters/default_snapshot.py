"""Default ERP snapshot adapter."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any

from ...application.ports.action_runtime_ports import ERPQueryPort, SnapshotPort
from ...domain.value_objects import ErpContextSnapshot


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DefaultSnapshotAdapter(SnapshotPort):
    def __init__(self, erp_query: ERPQueryPort) -> None:
        self._erp_query = erp_query

    async def capture(
        self,
        *,
        tenant_id: str,
        company_id: str,
        branch_id: str | None,
        user_id: str,
        ttl_seconds: int = 300,
    ) -> ErpContextSnapshot:
        gateway_snapshot = await self._erp_query.get_context_snapshot(
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            user_id=user_id,
        )
        content = f"{tenant_id}:{company_id}:{branch_id}:{gateway_snapshot.snapshot_id}"
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        return ErpContextSnapshot(
            snapshot_id=gateway_snapshot.snapshot_id,
            version=gateway_snapshot.erp_schema_version,
            captured_at=gateway_snapshot.captured_at.isoformat(),
            ttl_seconds=ttl_seconds,
            content_hash=content_hash,
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_period_id=gateway_snapshot.fiscal_period.fiscal_period_id,
            fiscal_period_open=gateway_snapshot.fiscal_period.is_open,
            currency_code=str(gateway_snapshot.metadata.get("currency_code", "NPR")),
            metadata=dict(gateway_snapshot.metadata),
        )

    async def validate_snapshot(
        self,
        *,
        snapshot: ErpContextSnapshot,
        context: dict[str, Any],
    ) -> tuple[bool, str]:
        if context.get("snapshot_expired") or snapshot.is_stale():
            return False, "ERP snapshot is stale or expired"
        expected_hash = context.get("expected_snapshot_hash")
        if expected_hash and expected_hash != snapshot.content_hash:
            return False, "ERP snapshot hash mismatch"
        if context.get("company_missing"):
            return False, "Company does not exist in snapshot"
        if context.get("branch_missing"):
            return False, "Branch does not exist in snapshot"
        if context.get("currency_missing"):
            return False, "Currency does not exist in snapshot"
        if not snapshot.fiscal_period_open and not context.get("ignore_fiscal"):
            return False, "Fiscal period closed in snapshot"
        return True, ""
