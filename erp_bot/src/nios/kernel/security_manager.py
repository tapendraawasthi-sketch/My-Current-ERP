"""Kernel SecurityManager — tenant isolation, permissions, approval gates."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class SecurityContext:
    tenant_id: str | None
    company_id: str | None
    user_id: str | None
    roles: list[str]


@dataclass
class SecurityDecision:
    allowed: bool
    reason: str
    requires_approval: bool = False


# Capabilities requiring elevated permission or approval
ELEVATED_CAPS = {
    "cap.governance.approval",
    "cap.ocr.invoice",
    "cap.erp.voucher_post",
    "cap.tax.vat_filing",
    "cap.compliance.audit_trail",
}

APPROVAL_THRESHOLD_AMOUNT = 500_000


class SecurityManager:
    """Tenant isolation and permission checks — nothing bypasses kernel."""

    def authorize_capability(
        self,
        cap_id: str,
        ctx: SecurityContext,
        *,
        payload: dict | None = None,
    ) -> SecurityDecision:
        if not ctx.tenant_id and cap_id.startswith("cap.erp"):
            return SecurityDecision(False, "ERP capabilities require tenant context")

        if cap_id in ELEVATED_CAPS and "admin" not in ctx.roles and "accountant" not in ctx.roles:
            if cap_id == "cap.ocr.invoice":
                return SecurityDecision(True, "OCR allowed for authenticated users", requires_approval=False)
            return SecurityDecision(
                True,
                "Elevated capability — approval recommended",
                requires_approval=True,
            )

        amount = float((payload or {}).get("amount", 0))
        if amount >= APPROVAL_THRESHOLD_AMOUNT:
            return SecurityDecision(
                True,
                f"Amount Rs.{amount:,.0f} exceeds approval threshold",
                requires_approval=True,
            )

        return SecurityDecision(True, "Authorized")

    def redact_pii(self, text: str) -> str:
        import re
        text = re.sub(r"\b\d{9}\b", "[PAN]", text)
        text = re.sub(r"\b98\d{8}\b", "[PHONE]", text)
        return text

    def isolate_tenant(self, tenant_id: str | None, data: dict[str, Any]) -> dict[str, Any]:
        if not tenant_id:
            return data
        return {**data, "_tenant_scope": tenant_id}


security_manager = SecurityManager()
