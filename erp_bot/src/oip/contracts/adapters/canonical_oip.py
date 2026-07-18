"""CanonicalAIRequestV1 → temporary IntelligenceRequestDto (compatibility only).

CanonicalAIRequestV1 is the authoritative active-boundary contract.
IntelligenceRequestDto is constructed ONLY here for the existing orchestrator.
Identity/authority always come from canonical.trusted_scope (MAI-01), never from body.
"""

from __future__ import annotations

from typing import Any

from ...application.dto.intelligence_request import IntelligenceRequestDto
from ..errors import ContractErrorCode, ContractValidationError
from ..request import CanonicalAIRequestV1
from .legacy_orbix import _obs


class CanonicalOipRequestAdapter:
    """Temporary deprecation target until the orchestrator accepts CanonicalAIRequestV1."""

    ADAPTER_NAME = "CanonicalOipRequestAdapter"
    DEPRECATED = True  # remove when orchestrator boundary speaks V1 natively
    DEPRECATION_NOTE = (
        "IntelligenceRequestDto is a compatibility projection of CanonicalAIRequestV1. "
        "Do not construct IntelligenceRequestDto from untrusted body fields at ingress."
    )

    def to_intelligence_dto(
        self,
        canonical: CanonicalAIRequestV1,
        *,
        module: str = "orbix",
        non_authoritative_annotations: dict[str, Any] | None = None,
    ) -> IntelligenceRequestDto:
        if not isinstance(canonical, CanonicalAIRequestV1):
            raise ContractValidationError(
                ContractErrorCode.INVALID_CONTRACT,
                "CanonicalOipRequestAdapter requires CanonicalAIRequestV1",
            )
        scope = canonical.trusted_scope
        # Strip any spoofed identity keys from annotation bags.
        annotations = dict(non_authoritative_annotations or {})
        for forbidden in (
            "principal_id",
            "tenant_id",
            "company_id",
            "roles",
            "permissions",
            "execution_allowed",
            "trusted_scope",
            "user_id",
            "authentication_method",
        ):
            annotations.pop(forbidden, None)
        # Never allow annotations to re-inject a full canonical blob as authority.
        annotations.pop("canonical_ai_request", None)

        auth_none = scope.authentication_method in {"none", "anonymous"}
        user_id = "" if auth_none and scope.principal_id in {"unauthenticated", "anonymous"} else scope.principal_id

        metadata: dict[str, Any] = {
            "orbix_mode": canonical.mode.value,
            "contract_authority": "CanonicalAIRequestV1",
            "canonical_schema_version": canonical.schema_version,
            "canonical_request_id": canonical.request_id,
            "mai02_request_adapter": _obs(self.ADAPTER_NAME, "canonical_source"),
            "policy_version": scope.policy_version,
            "auth_method": scope.authentication_method,
            "policy_principal": scope.principal_id,
            # Egress helpers for draft refs — derived from trusted scope, not client body.
            "egress_scope_ref": {
                "principal_id": scope.principal_id,
                "tenant_id": scope.tenant_id,
                "company_id": scope.company_id,
                "authentication_method": scope.authentication_method,
                "policy_version": scope.policy_version,
            },
            "active_ui_context": dict(canonical.active_ui_context),
            "client_capabilities": dict(canonical.client_capabilities),
            "conversation_id": canonical.conversation_id,
            "message_id": canonical.message_id,
        }
        if canonical.active_draft_reference:
            metadata["active_draft_reference"] = canonical.active_draft_reference
        if annotations:
            metadata["annotations"] = annotations

        return IntelligenceRequestDto(
            request_id=canonical.request_id,
            correlation_id=canonical.correlation_id,
            idempotency_key=canonical.request_id,
            tenant_id=scope.tenant_id,
            company_id=scope.company_id or "",
            user_id=user_id,
            session_id=canonical.conversation_id,
            conversation_id=canonical.conversation_id,
            module=module,
            language=canonical.locale_hint,
            question=canonical.raw_text,
            metadata=metadata,
            received_at=canonical.created_at,
        )
