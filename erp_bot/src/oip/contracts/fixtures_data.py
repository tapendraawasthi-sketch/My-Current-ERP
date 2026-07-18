"""Shared MAI-02 contract fixtures (synthetic, no real PII)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.oip.contracts.common import (
    ConfidenceV1,
    MoneyV1,
    ProvenanceKind,
    SourceSpanV1,
)
from src.oip.contracts.dialogue import IntentCandidateV1, TurnRelationKind, TurnRelationV1
from src.oip.contracts.draft_preview import (
    DraftReferenceV1,
    JournalEffectV1,
    JournalSide,
    PreviewV1,
    ReceiptStatus,
    ReceiptV1,
)
from src.oip.contracts.event_frame import (
    DurationFieldValueV1,
    EventFrameV1,
    FrameStatus,
    LifecycleState,
    UnknownNumberFieldValueV1,
)
from src.oip.contracts.common import DurationV1
from src.oip.contracts.evidence import ClaimV1, EvidenceClass, EvidenceItemV1
from src.oip.contracts.language import AnalysisStatus, LanguageFrameV1
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    ClientTurnPayloadV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.contracts.response import (
    AIResponseEnvelopeV1,
    AnswerPayloadV1,
    ClarificationPayloadV1,
    ConflictPayloadV1,
    DegradedPayloadV1,
    DraftPayloadV1,
    ErrorPayloadV1,
    PreviewPayloadV1,
    ReceiptPayloadV1,
    ResponseStatusV1,
    ResponseTypeV1,
    SafeRefusalPayloadV1,
)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def _ts() -> datetime:
    return datetime(2026, 7, 14, 12, 0, 0, tzinfo=timezone.utc)


def trusted_demo() -> TrustedScopeV1:
    return TrustedScopeV1(
        principal_id="user-demo-001",
        tenant_id="tenant-demo-001",
        company_id="company-demo-001",
        roles=("accountant",),
        permissions=("oip:read",),
        authentication_method="jwt",
        policy_version="mai-01.1.0",
    )


def draft_ref(draft_id: str = "draft-demo-001") -> DraftReferenceV1:
    return DraftReferenceV1(
        draft_id=draft_id,
        tenant_scope_reference="tenant-demo-001",
        company_scope_reference="company-demo-001",
        owner_principal_reference="user-demo-001",
        conversation_id="conv-demo-001",
        created_at=_ts(),
    )


def build_all_fixtures() -> dict[str, dict[str, Any]]:
    scope = trusted_demo()
    fixtures: dict[str, dict[str, Any]] = {}

    fixtures["01_ask_english"] = {
        "valid": True,
        "kind": "ClientTurnPayloadV1",
        "data": ClientTurnPayloadV1(
            message="What is my cash balance?",
            conversation_id="conv-demo-001",
            mode=InteractionModeV1.ASK,
        ).model_dump(mode="json"),
    }
    fixtures["02_ask_devanagari"] = {
        "valid": True,
        "kind": "ClientTurnPayloadV1",
        "data": ClientTurnPayloadV1(
            message="मेरो नगद मौज्दात कति छ?",
            conversation_id="conv-demo-001",
            mode=InteractionModeV1.ASK,
            locale_hint="ne",
        ).model_dump(mode="json"),
    }
    fixtures["03_ask_romanized"] = {
        "valid": True,
        "kind": "ClientTurnPayloadV1",
        "data": ClientTurnPayloadV1(
            message="mero cash balance kati cha?",
            conversation_id="conv-demo-001",
            mode=InteractionModeV1.ASK,
            locale_hint="ne-romanized",
        ).model_dump(mode="json"),
    }
    fixtures["04_ask_codemix"] = {
        "valid": True,
        "kind": "ClientTurnPayloadV1",
        "data": ClientTurnPayloadV1(
            message="Ram Traders बाट ५ maina को rice किनें",
            conversation_id="conv-demo-001",
            mode=InteractionModeV1.ASK,
        ).model_dump(mode="json"),
    }
    fixtures["05_accountant_draft"] = {
        "valid": True,
        "kind": "CanonicalAIRequestV1",
        "data": CanonicalAIRequestV1(
            request_id="req-demo-005",
            correlation_id="corr-demo-005",
            conversation_id="conv-demo-001",
            message_id="msg-demo-005",
            trusted_scope=scope,
            mode=InteractionModeV1.ACCOUNTANT,
            raw_text="Purchase 10 kg rice from ABC Suppliers for 5000 NPR",
            created_at=_ts(),
        ).model_dump(mode="json"),
    }
    fixtures["06_ambiguous_number"] = {
        "valid": True,
        "kind": "EventFrameV1",
        "data": EventFrameV1(
            frame_id="frame-demo-006",
            event_type="unknown",
            lifecycle_state=LifecycleState.UNKNOWN,
            status=FrameStatus.PARTIAL,
            values=(
                UnknownNumberFieldValueV1(
                    field_name="ambiguous_number",
                    surface_number="5",
                    original_surface="5",
                    unit_hint=None,
                    provenance=ProvenanceKind.INFERRED_CANDIDATE,
                    source_span=SourceSpanV1(start_offset=0, end_offset=1, original_text="5"),
                ),
            ),
            ambiguous_fields=("ambiguous_number",),
        ).model_dump(mode="json"),
    }
    fixtures["07_duration_vs_money"] = {
        "valid": True,
        "kind": "EventFrameV1",
        "data": EventFrameV1(
            frame_id="frame-demo-007",
            event_type="unknown",
            lifecycle_state=LifecycleState.UNKNOWN,
            status=FrameStatus.PARTIAL,
            values=(
                DurationFieldValueV1(
                    field_name="period",
                    original_surface="5 maina",
                    normalized_value=DurationV1(value="5", unit="month"),
                    provenance=ProvenanceKind.EXPLICIT,
                    source_span=SourceSpanV1(start_offset=0, end_offset=7, original_text="5 maina"),
                ),
            ),
        ).model_dump(mode="json"),
    }
    fixtures["08_clarification"] = {
        "valid": True,
        "kind": "AIResponseEnvelopeV1",
        "data": AIResponseEnvelopeV1(
            response_id="resp-demo-008",
            request_id="req-demo-008",
            conversation_id="conv-demo-001",
            response_type=ResponseTypeV1.CLARIFICATION,
            status=ResponseStatusV1.REQUIRES_INPUT,
            user_visible_text="Which supplier?",
            structured_payload=ClarificationPayloadV1(
                draft_id="draft-demo-001",
                missing_fields=("supplier",),
                questions=("Which supplier?",),
            ),
            created_at=_ts(),
        ).model_dump(mode="json"),
    }
    fixtures["09_draft"] = {
        "valid": True,
        "kind": "AIResponseEnvelopeV1",
        "data": AIResponseEnvelopeV1(
            response_id="resp-demo-009",
            request_id="req-demo-009",
            conversation_id="conv-demo-001",
            response_type=ResponseTypeV1.DRAFT,
            user_visible_text="Draft ready",
            structured_payload=DraftPayloadV1(draft=draft_ref()),
            created_at=_ts(),
        ).model_dump(mode="json"),
    }
    preview = PreviewV1(
        preview_id="prev-demo-010",
        draft_reference=draft_ref(),
        preview_hash="hash-demo-010",
        summary="Purchase preview",
        journal_effects=(
            JournalEffectV1(
                account_id="acc-inventory",
                account_display_name="Inventory",
                side=JournalSide.DEBIT,
                amount=MoneyV1(amount="5000.00", currency="NPR"),
            ),
            JournalEffectV1(
                account_id="acc-payable",
                account_display_name="Accounts Payable",
                side=JournalSide.CREDIT,
                amount=MoneyV1(amount="5000.00", currency="NPR"),
            ),
        ),
        totals={"grand_total": "5000.00", "currency": "NPR"},
        created_at=_ts(),
    )
    fixtures["10_preview"] = {
        "valid": True,
        "kind": "AIResponseEnvelopeV1",
        "data": AIResponseEnvelopeV1(
            response_id="resp-demo-010",
            request_id="req-demo-010",
            conversation_id="conv-demo-001",
            response_type=ResponseTypeV1.PREVIEW,
            status=ResponseStatusV1.REQUIRES_INPUT,
            user_visible_text="Confirm purchase?",
            structured_payload=PreviewPayloadV1(preview=preview),
            created_at=_ts(),
        ).model_dump(mode="json"),
    }
    fixtures["11_receipt"] = {
        "valid": True,
        "kind": "AIResponseEnvelopeV1",
        "data": AIResponseEnvelopeV1(
            response_id="resp-demo-011",
            request_id="req-demo-011",
            conversation_id="conv-demo-001",
            response_type=ResponseTypeV1.RECEIPT,
            user_visible_text="Posted locally",
            structured_payload=ReceiptPayloadV1(
                receipt=ReceiptV1(
                    receipt_id="rcpt-demo-011",
                    command_id="cmd-demo-011",
                    idempotency_key="idem-demo-011",
                    draft_reference=draft_ref(),
                    authority_source="dexie_domain",
                    connector_or_domain_source="khata_confirm",
                    status=ReceiptStatus.POSTED_LOCAL,
                    sync_state="local_only",
                    authoritative_record_ids=("voucher-demo-011",),
                    observed_at=_ts(),
                )
            ),
            created_at=_ts(),
        ).model_dump(mode="json"),
    }
    fixtures["12_receipt_sync_pending"] = {
        "valid": True,
        "kind": "AIResponseEnvelopeV1",
        "data": AIResponseEnvelopeV1(
            response_id="resp-demo-012",
            request_id="req-demo-012",
            conversation_id="conv-demo-001",
            response_type=ResponseTypeV1.RECEIPT,
            user_visible_text="Queued for sync",
            structured_payload=ReceiptPayloadV1(
                receipt=ReceiptV1(
                    receipt_id="rcpt-demo-012",
                    command_id="cmd-demo-012",
                    idempotency_key="idem-demo-012",
                    draft_reference=draft_ref(),
                    authority_source="dexie_domain",
                    connector_or_domain_source="khata_confirm",
                    status=ReceiptStatus.SYNC_PENDING,
                    sync_state="pending",
                    observed_at=_ts(),
                )
            ),
            created_at=_ts(),
        ).model_dump(mode="json"),
    }
    fixtures["13_conflict"] = {
        "valid": True,
        "kind": "AIResponseEnvelopeV1",
        "data": AIResponseEnvelopeV1(
            response_id="resp-demo-013",
            request_id="req-demo-013",
            conversation_id="conv-demo-001",
            response_type=ResponseTypeV1.CONFLICT,
            status=ResponseStatusV1.FAILED,
            user_visible_text="Sync conflict",
            structured_payload=ConflictPayloadV1(
                conflict_code="SYNC_CONFLICT",
                safe_message="Local and remote versions differ.",
            ),
            created_at=_ts(),
        ).model_dump(mode="json"),
    }
    fixtures["14_safe_refusal"] = {
        "valid": True,
        "kind": "AIResponseEnvelopeV1",
        "data": AIResponseEnvelopeV1(
            response_id="resp-demo-014",
            request_id="req-demo-014",
            conversation_id="conv-demo-001",
            response_type=ResponseTypeV1.SAFE_REFUSAL,
            status=ResponseStatusV1.REFUSED,
            user_visible_text="Ask mode cannot post.",
            structured_payload=SafeRefusalPayloadV1(
                reason_code="ASK_MODE_READONLY",
                safe_message="Ask mode cannot post.",
            ),
            created_at=_ts(),
        ).model_dump(mode="json"),
    }
    fixtures["15_degraded"] = {
        "valid": True,
        "kind": "AIResponseEnvelopeV1",
        "data": AIResponseEnvelopeV1(
            response_id="resp-demo-015",
            request_id="req-demo-015",
            conversation_id="conv-demo-001",
            response_type=ResponseTypeV1.DEGRADED,
            status=ResponseStatusV1.DEGRADED,
            user_visible_text="Provider offline",
            structured_payload=DegradedPayloadV1(
                reason_code="PROVIDER_OFFLINE",
                safe_message="Provider offline",
            ),
            created_at=_ts(),
        ).model_dump(mode="json"),
    }
    fixtures["16_error"] = {
        "valid": True,
        "kind": "AIResponseEnvelopeV1",
        "data": AIResponseEnvelopeV1(
            response_id="resp-demo-016",
            request_id="req-demo-016",
            conversation_id="conv-demo-001",
            response_type=ResponseTypeV1.ERROR,
            status=ResponseStatusV1.FAILED,
            user_visible_text="Something went wrong.",
            structured_payload=ErrorPayloadV1(
                error_code="GENERAL_ERROR",
                safe_message="Something went wrong.",
            ),
            created_at=_ts(),
        ).model_dump(mode="json"),
    }
    evidence = EvidenceItemV1(
        evidence_id="ev-demo-017",
        evidence_class=EvidenceClass.ERP_SNAPSHOT,
        source_id="ledger-cash",
        document_version_or_snapshot="snap-1",
        extracted_text_or_fact="Cash balance NPR 12000.00",
        acquired_at=_ts(),
    )
    fixtures["17_evidence_answer"] = {
        "valid": True,
        "kind": "AIResponseEnvelopeV1",
        "data": AIResponseEnvelopeV1(
            response_id="resp-demo-017",
            request_id="req-demo-017",
            conversation_id="conv-demo-001",
            response_type=ResponseTypeV1.ANSWER,
            user_visible_text="Cash balance is NPR 12000.00",
            structured_payload=AnswerPayloadV1(
                propositions=("Cash balance is NPR 12000.00",),
                evidence_ids=("ev-demo-017",),
            ),
            citations=("ev-demo-017",),
            created_at=_ts(),
        ).model_dump(mode="json"),
        "evidence": evidence.model_dump(mode="json"),
        "claim": ClaimV1(
            claim_id="claim-demo-017",
            canonical_proposition="Cash balance is NPR 12000.00",
            evidence_ids=("ev-demo-017",),
            confidence=ConfidenceV1(value=0.9, method="erp_snapshot"),
        ).model_dump(mode="json"),
    }
    fixtures["18_unsupported_schema_version"] = {
        "valid": False,
        "kind": "ClientTurnPayloadV1",
        "data": {
            "schema_version": "99.0.0",
            "message": "hello",
            "conversation_id": "conv-demo-001",
        },
        "error_code": "UNSUPPORTED_SCHEMA_VERSION",
    }
    fixtures["19_invalid_response_payload_mismatch"] = {
        "valid": False,
        "kind": "AIResponseEnvelopeV1",
        "data": {
            "schema_version": "1.0.0",
            "response_id": "resp-bad",
            "request_id": "req-bad",
            "conversation_id": "conv-demo-001",
            "response_type": "RECEIPT",
            "status": "SUCCESS",
            "language": "en",
            "user_visible_text": "nope",
            "structured_payload": {"payload_type": "ANSWER", "propositions": []},
            "citations": [],
            "warnings": [],
            "suggested_safe_actions": [],
            "created_at": _ts().isoformat(),
        },
        "error_code": "RESPONSE_PAYLOAD_MISMATCH",
    }
    fixtures["20_legacy_request_conversion"] = {
        "valid": True,
        "kind": "legacy_request",
        "data": {
            "message": "Show purchase draft for सूर्य ट्रेडर्स",
            "session_id": "sess-legacy-020",
            "orbix_mode": "accountant",
            "context": {"tenant_id": "spoof-tenant", "company_id": "spoof-company"},
        },
    }
    fixtures["language_frame_not_run"] = {
        "valid": True,
        "kind": "LanguageFrameV1",
        "data": LanguageFrameV1.not_run("नेपाली र English mix").model_dump(mode="json"),
    }
    fixtures["turn_relation_unknown"] = {
        "valid": True,
        "kind": "TurnRelationV1",
        "data": TurnRelationV1(relation=TurnRelationKind.UNKNOWN).model_dump(mode="json"),
    }
    fixtures["intent_unknown"] = {
        "valid": True,
        "kind": "IntentCandidateV1",
        "data": IntentCandidateV1(intent_id="unknown").model_dump(mode="json"),
    }
    return fixtures


def write_fixtures() -> Path:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    all_fx = build_all_fixtures()
    for name, payload in all_fx.items():
        path = FIXTURES_DIR / f"{name}.json"
        path.write_text(
            json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
            encoding="utf-8",
            newline="\n",
        )
    index = {"schema_version": "1.0.0", "fixtures": sorted(all_fx.keys())}
    (FIXTURES_DIR / "index.json").write_text(
        json.dumps(index, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return FIXTURES_DIR


if __name__ == "__main__":
    write_fixtures()
    print(f"wrote fixtures to {FIXTURES_DIR}")
