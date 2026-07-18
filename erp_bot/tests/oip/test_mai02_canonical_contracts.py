"""MAI-02 canonical contract tests."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from pydantic import ValidationError

from src.oip.contracts.adapters.legacy_orbix import (
    LegacyExecutionFlagAdapter,
    LegacyOrbixClientRequestAdapter,
    LegacyOrbixSseEventAdapter,
    trusted_scope_from_mai01,
)
from src.oip.contracts.common import MoneyV1, ProvenanceKind, SourceSpanV1
from src.oip.contracts.dialogue import IntentCandidateV1, TurnRelationKind, TurnRelationV1
from src.oip.contracts.draft_preview import (
    DraftReferenceV1,
    PreviewV1,
    ReceiptStatus,
    ReceiptV1,
)
from src.oip.contracts.errors import ContractErrorCode, ContractValidationError
from src.oip.contracts.event_frame import (
    DurationFieldValueV1,
    EventFrameV1,
    UnknownNumberFieldValueV1,
)
from src.oip.contracts.common import DurationV1
from src.oip.contracts.fixtures_data import FIXTURES_DIR, build_all_fixtures, write_fixtures
from src.oip.contracts.language import AnalysisStatus, LanguageFrameV1
from src.oip.contracts.plan_tools import ReadOrMutation, ToolCallV1, register_tool_schema
from src.oip.contracts.registry import CURRENT_SCHEMA_VERSION, UnsupportedSchemaVersionError, parse_schema_version
from src.oip.contracts.request import CanonicalAIRequestV1, ClientTurnPayloadV1, InteractionModeV1, TrustedScopeV1
from src.oip.contracts.response import (
    AIResponseEnvelopeV1,
    AnswerPayloadV1,
    ErrorPayloadV1,
    PreviewPayloadV1,
    ReceiptPayloadV1,
    ResponseTypeV1,
)
from src.oip.contracts.sse import (
    AnswerDeltaPayload,
    CompletePayload,
    SSEEventEnvelopeV1,
    SSEEventTypeV1,
    assert_monotonic_sequences,
)

KINDS = {
    "ClientTurnPayloadV1": ClientTurnPayloadV1,
    "CanonicalAIRequestV1": CanonicalAIRequestV1,
    "LanguageFrameV1": LanguageFrameV1,
    "TurnRelationV1": TurnRelationV1,
    "IntentCandidateV1": IntentCandidateV1,
    "EventFrameV1": EventFrameV1,
    "AIResponseEnvelopeV1": AIResponseEnvelopeV1,
    "PreviewV1": PreviewV1,
    "ReceiptV1": ReceiptV1,
}


@pytest.fixture(scope="module", autouse=True)
def _ensure_fixtures() -> None:
    write_fixtures()


def test_schema_version_current() -> None:
    assert CURRENT_SCHEMA_VERSION == "1.0.0"
    parse_schema_version("1.0.0")
    with pytest.raises(UnsupportedSchemaVersionError):
        parse_schema_version("99.0.0")


def test_money_rejects_float() -> None:
    with pytest.raises(ValidationError):
        MoneyV1(amount=12.5, currency="NPR")
    m = MoneyV1(amount="12.50", currency="NPR")
    assert m.amount == "12.50"
    assert "12.50" in m.model_dump_json()


def test_client_payload_cannot_embed_trusted_scope() -> None:
    with pytest.raises((ValidationError, ContractValidationError)):
        ClientTurnPayloadV1(
            message="hi",
            conversation_id="c1",
            client_context={"principal_id": "attacker", "permissions": ["erp:command:execute"]},
        )


def test_trusted_scope_only_from_helper() -> None:
    scope = trusted_scope_from_mai01(
        principal_id="u1",
        tenant_id="t1",
        company_id="c1",
        authentication_method="jwt",
    )
    assert scope.principal_id == "u1"
    with pytest.raises(ContractValidationError) as ei:
        trusted_scope_from_mai01(
            principal_id="",
            tenant_id="t1",
            company_id=None,
            authentication_method="jwt",
        )
    assert ei.value.code is ContractErrorCode.CLIENT_TRUSTED_SCOPE_FORBIDDEN


def test_response_type_payload_mismatch_rejected() -> None:
    with pytest.raises((ValidationError, ContractValidationError)):
        AIResponseEnvelopeV1(
            response_id="r1",
            request_id="q1",
            conversation_id="c1",
            response_type=ResponseTypeV1.RECEIPT,
            structured_payload=AnswerPayloadV1(),
            user_visible_text="x",
            created_at=datetime.now(timezone.utc),
        )


def test_execution_allowed_forbidden_on_canonical_response() -> None:
    with pytest.raises((ValidationError, ContractValidationError)):
        AIResponseEnvelopeV1.model_validate(
            {
                "schema_version": "1.0.0",
                "response_id": "r1",
                "request_id": "q1",
                "conversation_id": "c1",
                "response_type": "ANSWER",
                "status": "SUCCESS",
                "language": "en",
                "user_visible_text": "hi",
                "structured_payload": {"payload_type": "ANSWER", "propositions": []},
                "citations": [],
                "warnings": [],
                "suggested_safe_actions": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "execution_allowed": True,
            }
        )


def test_legacy_execution_flag_from_policy_only() -> None:
    adapter = LegacyExecutionFlagAdapter()
    assert adapter.derive(policy_allows=True, mode="ask") is False
    assert adapter.derive(policy_allows=True, mode="accountant") is True
    assert adapter.derive(policy_allows=False, mode="accountant") is False
    cleaned = adapter.strip_from_model_output({"execution_allowed": True, "message": "x"})
    assert "execution_allowed" not in cleaned


def test_preview_is_not_receipt() -> None:
    draft = DraftReferenceV1(
        draft_id="d1",
        tenant_scope_reference="t1",
        owner_principal_reference="u1",
        conversation_id="c1",
        created_at=datetime.now(timezone.utc),
    )
    preview = PreviewV1(
        preview_id="p1",
        draft_reference=draft,
        preview_hash="h1",
        created_at=datetime.now(timezone.utc),
    )
    assert preview.is_receipt is False
    with pytest.raises((ValidationError, ContractValidationError)):
        PreviewV1.model_validate(
            {
                **preview.model_dump(mode="json"),
                "receipt_id": "r-fake",
            }
        )


def test_sync_pending_not_synced() -> None:
    draft = DraftReferenceV1(
        draft_id="d1",
        tenant_scope_reference="t1",
        owner_principal_reference="u1",
        conversation_id="c1",
        created_at=datetime.now(timezone.utc),
    )
    with pytest.raises((ValidationError, ContractValidationError)):
        ReceiptV1(
            receipt_id="r1",
            command_id="cmd",
            idempotency_key="idem",
            draft_reference=draft,
            authority_source="dexie",
            connector_or_domain_source="khata",
            status=ReceiptStatus.SYNC_PENDING,
            sync_state="synced",
            observed_at=datetime.now(timezone.utc),
        )


def test_error_excludes_stack() -> None:
    with pytest.raises((ValidationError, ContractValidationError)):
        ErrorPayloadV1.model_validate(
            {
                "payload_type": "ERROR",
                "error_code": "X",
                "safe_message": "oops",
                "stack_trace": "Traceback...",
            }
        )


def test_language_frame_not_run_no_fabrication() -> None:
    frame = LanguageFrameV1.not_run("hello नेपाली")
    assert frame.analysis_status is AnalysisStatus.NOT_RUN
    assert frame.raw_text == "hello नेपाली"
    assert frame.span_annotations == ()


def test_turn_relation_unknown_not_purchase() -> None:
    rel = TurnRelationV1(relation=TurnRelationKind.UNKNOWN)
    assert rel.relation is TurnRelationKind.UNKNOWN
    assert "purchase" not in rel.relation.value.lower()
    confirm = TurnRelationV1(relation=TurnRelationKind.CONFIRMATION_INTENT)
    assert confirm.is_execution_authority is False


def test_intent_score_not_authorization() -> None:
    intent = IntentCandidateV1(intent_id="unknown", score=0.99, required_capability="erp:command:execute")
    assert intent.grants_capability is False


def test_eventframe_duration_and_unknown_number() -> None:
    frame = EventFrameV1(
        frame_id="f1",
        values=(
            DurationFieldValueV1(
                field_name="period",
                original_surface="5 maina",
                normalized_value=DurationV1(value="5", unit="month"),
                provenance=ProvenanceKind.EXPLICIT,
                source_span=SourceSpanV1(start_offset=0, end_offset=7, original_text="5 maina"),
            ),
            UnknownNumberFieldValueV1(
                field_name="n",
                surface_number="5",
                original_surface="5",
                provenance=ProvenanceKind.INFERRED_CANDIDATE,
            ),
        ),
        missing_required_fields=("party",),
        ambiguous_fields=("n",),
    )
    assert frame.values[0].value_type == "duration"
    assert frame.values[1].value_type == "unknown_number"
    assert frame.values[1].provenance is ProvenanceKind.INFERRED_CANDIDATE
    assert "party" in frame.missing_required_fields
    assert frame.authorizes_posting is False
    with pytest.raises((ValidationError, ContractValidationError)):
        EventFrameV1.model_validate({"frame_id": "f2", "receipt_id": "r1"})


def test_empty_mutation_tool_schema_invalid() -> None:
    register_tool_schema("erp.bad_mutate", "1.0.0", {"type": "object", "properties": {}, "mutation": True})
    with pytest.raises((ValidationError, ContractValidationError)):
        ToolCallV1(
            tool_call_id="tc1",
            tool_name="erp.bad_mutate",
            tool_schema_version="1.0.0",
            typed_arguments={},
            read_or_mutation=ReadOrMutation.MUTATION,
        )


def test_legacy_request_adapter_injects_trusted_scope() -> None:
    adapter = LegacyOrbixClientRequestAdapter()
    client, obs = adapter.to_client_payload(
        {
            "message": "test",
            "session_id": "s1",
            "orbix_mode": "ask",
            "context": {"tenant_id": "spoof", "principal_id": "attacker"},
        }
    )
    assert "principal_id" not in client.client_context or client.client_context.get("_resource_selector_only")
    assert "attacker" not in json.dumps(client.model_dump())
    scope = trusted_scope_from_mai01(
        principal_id="real-user",
        tenant_id="real-tenant",
        company_id="real-co",
        authentication_method="jwt",
    )
    canonical = adapter.assemble_canonical(client, trusted=scope, request_id="r1", correlation_id="c1")
    assert isinstance(canonical, CanonicalAIRequestV1)
    assert canonical.trusted_scope.principal_id == "real-user"
    assert canonical.trusted_scope.tenant_id == "real-tenant"
    assert obs["adapter"] == LegacyOrbixClientRequestAdapter.ADAPTER_NAME


def test_sse_monotonic_and_complete_validated() -> None:
    draft = DraftReferenceV1(
        draft_id="d1",
        tenant_scope_reference="t1",
        owner_principal_reference="u1",
        conversation_id="c1",
        created_at=datetime.now(timezone.utc),
    )
    env = AIResponseEnvelopeV1(
        response_id="r1",
        request_id="q1",
        conversation_id="c1",
        response_type=ResponseTypeV1.ANSWER,
        structured_payload=AnswerPayloadV1(propositions=("hi",)),
        user_visible_text="hi",
        created_at=datetime.now(timezone.utc),
    )
    e1 = SSEEventEnvelopeV1(
        event_id="e1",
        request_id="q1",
        conversation_id="c1",
        sequence_number=0,
        event_type=SSEEventTypeV1.ANSWER_DELTA,
        timestamp=datetime.now(timezone.utc),
        payload=AnswerDeltaPayload(text="hi"),
    )
    e2 = SSEEventEnvelopeV1(
        event_id="e2",
        request_id="q1",
        conversation_id="c1",
        sequence_number=1,
        event_type=SSEEventTypeV1.COMPLETE,
        timestamp=datetime.now(timezone.utc),
        payload=CompletePayload(response=env),
    )
    assert_monotonic_sequences([e1, e2])
    with pytest.raises((ValidationError, ContractValidationError)):
        AnswerDeltaPayload.model_validate({"payload_type": "ANSWER_DELTA", "text": "x", "execution_allowed": True})
    with pytest.raises((ValidationError, ContractValidationError)):
        SSEEventEnvelopeV1(
            event_id="e3",
            request_id="q1",
            conversation_id="c1",
            sequence_number=2,
            event_type=SSEEventTypeV1.COMPLETE,
            timestamp=datetime.now(timezone.utc),
            payload=AnswerDeltaPayload(text="nope"),
        )


def test_legacy_sse_complete_roundtrip() -> None:
    scope = trusted_scope_from_mai01(
        principal_id="u1", tenant_id="t1", company_id="c1", authentication_method="jwt"
    )
    adapter = LegacyOrbixSseEventAdapter()
    event, legacy = adapter.complete_dict_to_envelope(
        {
            "type": "complete",
            "schema_version": "1.0",
            "request_id": "req-1",
            "message": "Hello",
            "response_type": "normal_answer",
            "status": "success",
            "card": None,
        },
        conversation_id="conv-1",
        trusted=scope,
        sequence_number=0,
    )
    assert event.event_type is SSEEventTypeV1.COMPLETE
    assert event.payload.response.response_type is ResponseTypeV1.ANSWER
    assert legacy["type"] == "complete"
    assert "execution_allowed" not in legacy


def test_shared_fixtures_python_validation() -> None:
    write_fixtures()
    for path in sorted(FIXTURES_DIR.glob("*.json")):
        if path.name == "index.json":
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        kind = payload.get("kind")
        data = payload["data"]
        valid = payload.get("valid", True)
        if kind == "legacy_request":
            client, _ = LegacyOrbixClientRequestAdapter().to_client_payload(data)
            assert client.message
            continue
        model = KINDS.get(kind)
        if model is None:
            continue
        if valid:
            model.model_validate(data)
        else:
            with pytest.raises((ValidationError, ContractValidationError, UnsupportedSchemaVersionError)):
                model.model_validate(data)


def test_fixtures_catalog_has_required_cases() -> None:
    fx = build_all_fixtures()
    required = [
        "01_ask_english",
        "02_ask_devanagari",
        "03_ask_romanized",
        "04_ask_codemix",
        "05_accountant_draft",
        "06_ambiguous_number",
        "07_duration_vs_money",
        "08_clarification",
        "09_draft",
        "10_preview",
        "11_receipt",
        "12_receipt_sync_pending",
        "13_conflict",
        "14_safe_refusal",
        "15_degraded",
        "16_error",
        "17_evidence_answer",
        "18_unsupported_schema_version",
        "19_invalid_response_payload_mismatch",
        "20_legacy_request_conversion",
    ]
    for name in required:
        assert name in fx


def test_unicode_roundtrip() -> None:
    text = "Ram Traders बाट ५००० NPR — सूर्य ट्रेडर्स"
    payload = ClientTurnPayloadV1(message=text, conversation_id="c1")
    again = ClientTurnPayloadV1.model_validate(json.loads(payload.model_dump_json()))
    assert again.message == text


def test_schemas_exist_and_parse() -> None:
    schemas = Path(__file__).resolve().parents[2] / "src" / "oip" / "contracts" / "schemas" / "v1"
    files = list(schemas.glob("*.json"))
    assert len(files) >= 16
    for path in files:
        json.loads(path.read_text(encoding="utf-8"))
