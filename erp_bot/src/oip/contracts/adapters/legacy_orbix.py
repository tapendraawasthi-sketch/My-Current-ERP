"""Legacy Orbix/OIP compatibility adapters — boundary only."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from ..common import MoneyV1
from ..draft_preview import (
    DraftReferenceV1,
    DraftStatus,
    JournalEffectV1,
    JournalSide,
    PreviewStatus,
    PreviewV1,
    ReceiptStatus,
    ReceiptV1,
)
from ..errors import ContractErrorCode, ContractValidationError
from ..registry import CURRENT_SCHEMA_VERSION, get_contract_registry
from ..request import (
    CanonicalAIRequestV1,
    ClientTurnPayloadV1,
    InputChannelV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from ..response import (
    AIResponseEnvelopeV1,
    ActionProgressPayloadV1,
    AnswerPayloadV1,
    ChoicePayloadV1,
    ClarificationPayloadV1,
    ConflictPayloadV1,
    DegradedPayloadV1,
    DraftPayloadV1,
    ErrorPayloadV1,
    PreviewPayloadV1,
    ReceiptPayloadV1,
    ReportPayloadV1,
    ResponseStatusV1,
    ResponseTypeV1,
    SafeRefusalPayloadV1,
)
from ..sse import (
    AnswerDeltaPayload,
    CompletePayload,
    ErrorEventPayload,
    RoutePayload,
    SSEEventEnvelopeV1,
    SSEEventTypeV1,
)


def _obs(adapter: str, detail: str = "") -> dict[str, str]:
    """Redacted adapter observability stub (trace/metric hook)."""
    return {"adapter": adapter, "legacy": "true", "detail": detail[:80]}


class LegacyOrbixClientRequestAdapter:
    """Map historical Orbix chat body → ClientTurnPayloadV1 (+ later TrustedScope inject)."""

    ADAPTER_NAME = "LegacyOrbixClientRequestAdapter"
    DEPRECATED = False  # active consumers still depend on this

    def to_client_payload(self, body: dict[str, Any]) -> tuple[ClientTurnPayloadV1, dict[str, str]]:
        try:
            schema = body.get("schema_version") or CURRENT_SCHEMA_VERSION
            # Accept legacy "1.0" as 1.0.0
            if schema == "1.0":
                schema = "1.0.0"
            get_contract_registry().assert_supported(schema)

            message = body.get("message") or body.get("question") or ""
            if not str(message).strip():
                raise ContractValidationError(
                    ContractErrorCode.LEGACY_ADAPTER_FAILED,
                    "message is required",
                    field="message",
                )

            session_id = body.get("session_id") or body.get("conversation_id")
            mode_raw = body.get("orbix_mode") or body.get("mode") or "ask"
            mode = InteractionModeV1.ACCOUNTANT if str(mode_raw).lower() == "accountant" else InteractionModeV1.ASK

            context = dict(body.get("context") or {})
            # Strip identity from becoming trusted — move selectors only.
            selectors: dict[str, Any] = {"_resource_selector_only": True}
            for key in ("tenant_id", "company_id"):
                if key in context:
                    selectors[key] = context.pop(key)
                if key in body and key not in ("message",):
                    # Body-level tenant/company are selectors if present.
                    selectors[key] = body.get(key)

            # Remove forbidden identity keys from context forever.
            for forbidden in (
                "principal_id",
                "roles",
                "permissions",
                "authentication_method",
                "user_id",
                "trusted_scope",
                "execution_allowed",
            ):
                context.pop(forbidden, None)

            payload = ClientTurnPayloadV1(
                schema_version=schema,
                message=str(message),
                conversation_id=body.get("conversation_id"),
                session_id=str(session_id) if session_id else None,
                mode=mode,
                input_channel=InputChannelV1.TEXT,
                locale_hint=body.get("locale") or body.get("language"),
                client_context={**context, **selectors} if selectors.get("tenant_id") or selectors.get("company_id") else context,
                active_ui_context=dict(body.get("active_ui_context") or {}),
                active_draft_reference=body.get("draft_id") or context.get("draft_id"),
                client_message_id=body.get("client_message_id"),
                idempotency_key=body.get("idempotency_key"),
            )
            return payload, _obs(self.ADAPTER_NAME, "ok")
        except ContractValidationError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ContractValidationError(
                ContractErrorCode.LEGACY_ADAPTER_FAILED,
                f"legacy request conversion failed: {exc}",
            ) from exc

    def assemble_canonical(
        self,
        client: ClientTurnPayloadV1,
        *,
        trusted: TrustedScopeV1,
        request_id: str | None = None,
        correlation_id: str | None = None,
    ) -> CanonicalAIRequestV1:
        rid = request_id or str(uuid4())
        cid = correlation_id or rid
        return CanonicalAIRequestV1(
            schema_version=CURRENT_SCHEMA_VERSION,
            request_id=rid,
            correlation_id=cid,
            conversation_id=client.resolved_conversation_id(),
            message_id=client.client_message_id or str(uuid4()),
            trusted_scope=trusted,
            mode=client.mode,
            raw_text=client.message,
            input_channel=client.input_channel,
            locale_hint=client.locale_hint,
            active_ui_context=dict(client.active_ui_context),
            active_draft_reference=client.active_draft_reference,
            created_at=datetime.now(timezone.utc),
        )


class LegacyExecutionFlagAdapter:
    """execution_allowed is derived from MAI-01 policy only — never from model/body."""

    ADAPTER_NAME = "LegacyExecutionFlagAdapter"

    def derive(self, *, policy_allows: bool, mode: str) -> bool:
        if str(mode).lower() == "ask":
            return False
        return bool(policy_allows)

    def strip_from_model_output(self, payload: dict[str, Any]) -> dict[str, Any]:
        out = dict(payload)
        out.pop("execution_allowed", None)
        return out


class LegacyDraftCardAdapter:
    """Map legacy confirmation card → PreviewV1 / DraftReference without recalculating amounts."""

    ADAPTER_NAME = "LegacyDraftCardAdapter"

    def card_to_preview(
        self,
        card: dict[str, Any],
        *,
        trusted: TrustedScopeV1,
        conversation_id: str,
    ) -> PreviewV1:
        draft_id = str(card.get("draft_id") or card.get("id") or "")
        if not draft_id:
            raise ContractValidationError(
                ContractErrorCode.INVALID_DRAFT_REFERENCE,
                "card missing draft_id",
                field="draft_id",
            )
        draft = DraftReferenceV1(
            draft_id=draft_id,
            draft_version=str(card.get("draft_version") or "1"),
            event_type=str(card.get("transaction_type") or card.get("type") or "unknown"),
            tenant_scope_reference=trusted.tenant_id,
            company_scope_reference=trusted.company_id,
            owner_principal_reference=trusted.principal_id,
            conversation_id=conversation_id,
            status=DraftStatus.PREVIEWED,
        )
        journal_effects: list[JournalEffectV1] = []
        journal = card.get("journal") or {}
        entries = journal.get("entries") if isinstance(journal, dict) else None
        if isinstance(entries, list):
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                debit = entry.get("debit")
                credit = entry.get("credit")
                # Preserve string amounts exactly — do not recalculate.
                if debit not in (None, "", 0, "0"):
                    amt = debit if isinstance(debit, str) else str(debit)
                    journal_effects.append(
                        JournalEffectV1(
                            account_id=str(entry.get("account_id") or entry.get("account_code") or "unknown"),
                            account_display_name=str(entry.get("account_name") or ""),
                            side=JournalSide.DEBIT,
                            amount=MoneyV1(amount=amt, currency=str(card.get("currency") or "NPR")),
                        )
                    )
                if credit not in (None, "", 0, "0"):
                    amt = credit if isinstance(credit, str) else str(credit)
                    journal_effects.append(
                        JournalEffectV1(
                            account_id=str(entry.get("account_id") or entry.get("account_code") or "unknown"),
                            account_display_name=str(entry.get("account_name") or ""),
                            side=JournalSide.CREDIT,
                            amount=MoneyV1(amount=amt, currency=str(card.get("currency") or "NPR")),
                        )
                    )
        totals = card.get("totals") if isinstance(card.get("totals"), dict) else {}
        return PreviewV1(
            preview_id=str(card.get("preview_id") or f"prev-{draft_id}"),
            draft_reference=draft,
            preview_version=str(card.get("preview_version") or "1"),
            preview_hash=str(card.get("preview_hash") or card.get("hash") or f"legacy-{draft_id}"),
            summary=str(card.get("summary") or card.get("narration") or ""),
            journal_effects=tuple(journal_effects),
            totals={k: (v if not isinstance(v, float) else str(v)) for k, v in totals.items()},
            warnings=tuple(str(w) for w in (card.get("warnings") or [])),
            status=PreviewStatus.READY,
        )


class LegacyReportSpecAdapter:
    ADAPTER_NAME = "LegacyReportSpecAdapter"

    def to_report_payload(self, report_spec: dict[str, Any]) -> ReportPayloadV1:
        return ReportPayloadV1(report_spec=dict(report_spec))


_LEGACY_RESPONSE_TYPE_MAP: dict[str, ResponseTypeV1] = {
    "normal_answer": ResponseTypeV1.ANSWER,
    "capability_answer": ResponseTypeV1.ANSWER,
    "accounting_explanation": ResponseTypeV1.ANSWER,
    "erp_data_result": ResponseTypeV1.ANSWER,
    "report_result": ResponseTypeV1.REPORT,
    "report_updated": ResponseTypeV1.REPORT,
    "mode_restriction": ResponseTypeV1.SAFE_REFUSAL,
    "clarification_required": ResponseTypeV1.CLARIFICATION,
    "transaction_draft": ResponseTypeV1.DRAFT,
    "transaction_preview": ResponseTypeV1.PREVIEW,
    "journal_preview": ResponseTypeV1.PREVIEW,
    "confirmation_required": ResponseTypeV1.PREVIEW,
    "posting_started": ResponseTypeV1.ACTION_PROGRESS,
    "posting_progress": ResponseTypeV1.ACTION_PROGRESS,
    "posting_completed": ResponseTypeV1.RECEIPT,
    "posting_failed": ResponseTypeV1.ERROR,
    "permission_denied": ResponseTypeV1.SAFE_REFUSAL,
    "validation_error": ResponseTypeV1.ERROR,
    "cancellation_completed": ResponseTypeV1.ANSWER,
    "provider_offline": ResponseTypeV1.DEGRADED,
    "backend_unavailable": ResponseTypeV1.DEGRADED,
    "general_error": ResponseTypeV1.ERROR,
    "ANSWER": ResponseTypeV1.ANSWER,
    "CLARIFICATION": ResponseTypeV1.CLARIFICATION,
    "REPORT": ResponseTypeV1.REPORT,
    "DRAFT": ResponseTypeV1.DRAFT,
    "PREVIEW": ResponseTypeV1.PREVIEW,
    "RECEIPT": ResponseTypeV1.RECEIPT,
    "CONFLICT": ResponseTypeV1.CONFLICT,
    "SAFE_REFUSAL": ResponseTypeV1.SAFE_REFUSAL,
    "DEGRADED": ResponseTypeV1.DEGRADED,
    "ERROR": ResponseTypeV1.ERROR,
}


class LegacyOrbixSseEventAdapter:
    """Egress: canonical / mapped complete events stay compatible with frontend."""

    ADAPTER_NAME = "LegacyOrbixSseEventAdapter"

    def complete_dict_to_envelope(
        self,
        complete: dict[str, Any],
        *,
        conversation_id: str,
        trusted: TrustedScopeV1 | None = None,
        sequence_number: int = 0,
    ) -> tuple[SSEEventEnvelopeV1, dict[str, Any]]:
        """Validate canonical COMPLETE; also produce legacy complete dict for wire."""
        response = self.legacy_complete_to_response(complete, conversation_id=conversation_id, trusted=trusted)
        event = SSEEventEnvelopeV1(
            event_id=str(uuid4()),
            request_id=str(complete.get("request_id") or response.request_id),
            conversation_id=conversation_id,
            sequence_number=sequence_number,
            event_type=SSEEventTypeV1.COMPLETE,
            timestamp=datetime.now(timezone.utc),
            payload=CompletePayload(response=response),
        )
        legacy_out = self.response_to_legacy_complete(response, complete)
        return event, legacy_out

    def legacy_complete_to_response(
        self,
        complete: dict[str, Any],
        *,
        conversation_id: str,
        trusted: TrustedScopeV1 | None = None,
    ) -> AIResponseEnvelopeV1:
        # Strip model-controlled authority.
        LegacyExecutionFlagAdapter().strip_from_model_output(complete)
        raw_type = str(complete.get("response_type") or "normal_answer")
        rtype = _LEGACY_RESPONSE_TYPE_MAP.get(raw_type, ResponseTypeV1.ANSWER)
        text = str(complete.get("message") or "")
        request_id = str(complete.get("request_id") or uuid4())
        response_id = str(complete.get("message_id") or uuid4())
        scope = trusted or TrustedScopeV1(
            principal_id="unknown",
            tenant_id="unknown",
            authentication_method="none",
        )

        payload: Any
        status = ResponseStatusV1.SUCCESS
        if rtype is ResponseTypeV1.CLARIFICATION:
            err = complete.get("error") if isinstance(complete.get("error"), dict) else {}
            payload = ClarificationPayloadV1(
                draft_id=complete.get("draft_id") or err.get("draft_id"),
                missing_fields=tuple(err.get("missing_fields") or []),
                ambiguous_fields=tuple(err.get("ambiguous_fields") or []),
            )
            status = ResponseStatusV1.REQUIRES_INPUT
        elif rtype is ResponseTypeV1.REPORT:
            spec = complete.get("report_spec") if isinstance(complete.get("report_spec"), dict) else {}
            payload = LegacyReportSpecAdapter().to_report_payload(spec)
        elif rtype is ResponseTypeV1.PREVIEW:
            card = complete.get("card") if isinstance(complete.get("card"), dict) else {}
            if not card and complete.get("draft_id"):
                card = {"draft_id": complete["draft_id"]}
            preview = LegacyDraftCardAdapter().card_to_preview(
                card, trusted=scope, conversation_id=conversation_id
            )
            payload = PreviewPayloadV1(preview=preview)
            status = ResponseStatusV1.REQUIRES_INPUT
        elif rtype is ResponseTypeV1.DRAFT:
            draft_id = str(complete.get("draft_id") or (complete.get("card") or {}).get("draft_id") or "draft-unknown")
            draft = DraftReferenceV1(
                draft_id=draft_id,
                tenant_scope_reference=scope.tenant_id,
                company_scope_reference=scope.company_id,
                owner_principal_reference=scope.principal_id,
                conversation_id=conversation_id,
            )
            payload = DraftPayloadV1(draft=draft)
        elif rtype is ResponseTypeV1.RECEIPT:
            draft_id = str(complete.get("draft_id") or "draft-unknown")
            draft = DraftReferenceV1(
                draft_id=draft_id,
                tenant_scope_reference=scope.tenant_id,
                company_scope_reference=scope.company_id,
                owner_principal_reference=scope.principal_id,
                conversation_id=conversation_id,
            )
            # Distinguish sync-pending vs synced from metadata if present.
            meta = complete.get("metadata") if isinstance(complete.get("metadata"), dict) else {}
            sync_pending = bool(meta.get("sync_pending"))
            receipt = ReceiptV1(
                receipt_id=str(complete.get("posting_id") or complete.get("receipt_id") or f"rcpt-{draft_id}"),
                command_id=str(complete.get("command_id") or request_id),
                idempotency_key=str(complete.get("idempotency_key") or request_id),
                draft_reference=draft,
                authority_source=str(complete.get("authority_source") or "dexie_domain"),
                connector_or_domain_source=str(complete.get("connector") or "khata_confirm"),
                status=ReceiptStatus.SYNC_PENDING if sync_pending else ReceiptStatus.POSTED_LOCAL,
                sync_state="pending" if sync_pending else "local_only",
                authoritative_record_ids=tuple(
                    str(x) for x in (complete.get("authoritative_record_ids") or [])
                ),
            )
            payload = ReceiptPayloadV1(receipt=receipt)
        elif rtype is ResponseTypeV1.SAFE_REFUSAL:
            payload = SafeRefusalPayloadV1(
                reason_code=str((complete.get("error") or {}).get("code") or "REFUSED"),
                safe_message=text or "Request refused by policy.",
            )
            status = ResponseStatusV1.REFUSED
        elif rtype is ResponseTypeV1.ACTION_PROGRESS:
            payload = ActionProgressPayloadV1(
                stage=str(complete.get("stage") or "progress"),
                label=text or "",
            )
            status = ResponseStatusV1.PARTIAL
        elif rtype is ResponseTypeV1.CHOICE:
            payload = ChoicePayloadV1(prompt=text or "", choices=tuple(complete.get("choices") or ()))
            status = ResponseStatusV1.REQUIRES_INPUT
        elif rtype is ResponseTypeV1.DEGRADED:
            payload = DegradedPayloadV1(
                reason_code="PROVIDER_DEGRADED",
                safe_message=text or "Service degraded.",
            )
            status = ResponseStatusV1.DEGRADED
        elif rtype is ResponseTypeV1.ERROR:
            err = complete.get("error") if isinstance(complete.get("error"), dict) else {}
            payload = ErrorPayloadV1(
                error_code=str(err.get("code") or err.get("error_code") or "GENERAL_ERROR"),
                safe_message=text or str(err.get("message") or "An error occurred."),
            )
            status = ResponseStatusV1.FAILED
        elif rtype is ResponseTypeV1.CONFLICT:
            payload = ConflictPayloadV1(
                conflict_code="SYNC_CONFLICT",
                safe_message=text or "Conflict detected.",
            )
        else:
            payload = AnswerPayloadV1(propositions=(text,) if text else ())

        return AIResponseEnvelopeV1(
            response_id=response_id,
            request_id=request_id,
            conversation_id=conversation_id,
            response_type=rtype,
            status=status,
            user_visible_text=text,
            structured_payload=payload,
            policy_reference=complete.get("policy_reference"),
            created_at=datetime.now(timezone.utc),
        )

    def response_to_legacy_complete(
        self,
        response: AIResponseEnvelopeV1,
        seed: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Emit historical complete SSE shape for frontend compatibility."""
        seed = dict(seed or {})
        # Reverse map canonical → closest legacy type when seed lacked one.
        reverse = {
            ResponseTypeV1.ANSWER: "normal_answer",
            ResponseTypeV1.CLARIFICATION: "clarification_required",
            ResponseTypeV1.REPORT: "report_result",
            ResponseTypeV1.DRAFT: "transaction_draft",
            ResponseTypeV1.PREVIEW: "transaction_preview",
            ResponseTypeV1.RECEIPT: "posting_completed",
            ResponseTypeV1.SAFE_REFUSAL: "mode_restriction",
            ResponseTypeV1.DEGRADED: "provider_offline",
            ResponseTypeV1.ERROR: "general_error",
            ResponseTypeV1.CONFLICT: "general_error",
            ResponseTypeV1.ACTION_PROGRESS: "posting_progress",
            ResponseTypeV1.CHOICE: "clarification_required",
        }
        out = {
            "type": "complete",
            "schema_version": "1.0",  # wire legacy marker; canonical is 1.0.0 internally
            "canonical_schema_version": CURRENT_SCHEMA_VERSION,
            "request_id": response.request_id,
            "message": response.user_visible_text,
            "response_type": seed.get("response_type") or reverse.get(response.response_type, "normal_answer"),
            "status": seed.get("status") or "success",
            "card": seed.get("card"),
            "draft_id": seed.get("draft_id"),
            "report_spec": seed.get("report_spec"),
            "error": seed.get("error"),
            "route": seed.get("route"),
            "action": seed.get("action"),
            "orbix_mode": seed.get("orbix_mode"),
            "operation_class": seed.get("operation_class"),
            "metadata": seed.get("metadata") or {},
            # Never emit model-controlled execution_allowed on wire from canonical.
        }
        return out

    def token_to_answer_delta(
        self,
        *,
        text: str,
        request_id: str,
        conversation_id: str,
        sequence_number: int,
        event_id: str | None = None,
    ) -> SSEEventEnvelopeV1:
        return SSEEventEnvelopeV1(
            event_id=event_id or str(uuid4()),
            request_id=request_id,
            conversation_id=conversation_id,
            sequence_number=sequence_number,
            event_type=SSEEventTypeV1.ANSWER_DELTA,
            timestamp=datetime.now(timezone.utc),
            payload=AnswerDeltaPayload(text=text),
        )

    def route_event(
        self,
        route: dict[str, Any],
        *,
        request_id: str,
        conversation_id: str,
        sequence_number: int,
    ) -> SSEEventEnvelopeV1:
        return SSEEventEnvelopeV1(
            event_id=str(uuid4()),
            request_id=request_id,
            conversation_id=conversation_id,
            sequence_number=sequence_number,
            event_type=SSEEventTypeV1.ROUTE,
            timestamp=datetime.now(timezone.utc),
            payload=RoutePayload(route=route),
        )

    def error_event(
        self,
        *,
        error_code: str,
        safe_message: str,
        request_id: str,
        conversation_id: str,
        sequence_number: int,
    ) -> SSEEventEnvelopeV1:
        return SSEEventEnvelopeV1(
            event_id=str(uuid4()),
            request_id=request_id,
            conversation_id=conversation_id,
            sequence_number=sequence_number,
            event_type=SSEEventTypeV1.ERROR,
            timestamp=datetime.now(timezone.utc),
            payload=ErrorEventPayload(error_code=error_code, safe_message=safe_message),
        )


def trusted_scope_from_mai01(
    *,
    principal_id: str,
    tenant_id: str,
    company_id: str | None,
    roles: tuple[str, ...] = (),
    permissions: tuple[str, ...] = (),
    authentication_method: str,
    policy_version: str = "mai-01.1.0",
) -> TrustedScopeV1:
    """Only call with MAI-01 authenticated context — never from client body alone."""
    if not principal_id or not tenant_id or not authentication_method:
        raise ContractValidationError(
            ContractErrorCode.CLIENT_TRUSTED_SCOPE_FORBIDDEN,
            "TrustedScope requires authenticated principal",
        )
    return TrustedScopeV1(
        principal_id=principal_id,
        tenant_id=tenant_id,
        company_id=company_id or None,
        roles=roles,
        permissions=permissions,
        authentication_method=authentication_method,
        policy_version=policy_version,
    )
