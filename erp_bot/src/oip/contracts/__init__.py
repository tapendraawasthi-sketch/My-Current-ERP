"""MAI-02 canonical AI contract package (schema_version 1.0.0).

Canonical authority: Pydantic v2 models here.
JSON Schema is exported deterministically to schemas/v1/.
Legacy Orbix/OIP shapes live only behind adapters/.
"""

from __future__ import annotations

from .registry import (
    CURRENT_SCHEMA_VERSION,
    ContractRegistry,
    UnsupportedSchemaVersionError,
    get_contract_registry,
)
from .errors import ContractErrorCode, ContractValidationError
from .common import (
    ConfidenceV1,
    DateValueV1,
    DurationV1,
    EvidenceReferenceV1,
    IdentifierV1,
    MoneyV1,
    PercentageV1,
    QuantityV1,
    SourceSpanV1,
    TimestampV1,
)
from .request import CanonicalAIRequestV1, ClientTurnPayloadV1, TrustedScopeV1
from .language import LanguageFrameV1, SpanAnnotationV1
from .normalization import NormalizationBundleV1
from .dialogue import IntentCandidateV1, TurnRelationV1
from .event_frame import EventFrameV1
from .plan_tools import PlanV1, ToolCallV1, ToolObservationV1
from .evidence import ClaimV1, EvidenceItemV1
from .draft_preview import DraftReferenceV1, PreviewV1, ReceiptV1
from .response import AIResponseEnvelopeV1
from .sse import SSEEventEnvelopeV1

__all__ = [
    "CURRENT_SCHEMA_VERSION",
    "ContractRegistry",
    "UnsupportedSchemaVersionError",
    "get_contract_registry",
    "ContractErrorCode",
    "ContractValidationError",
    "MoneyV1",
    "QuantityV1",
    "PercentageV1",
    "DurationV1",
    "DateValueV1",
    "TimestampV1",
    "IdentifierV1",
    "SourceSpanV1",
    "ConfidenceV1",
    "EvidenceReferenceV1",
    "ClientTurnPayloadV1",
    "TrustedScopeV1",
    "CanonicalAIRequestV1",
    "LanguageFrameV1",
    "SpanAnnotationV1",
    "NormalizationBundleV1",
    "TurnRelationV1",
    "IntentCandidateV1",
    "EventFrameV1",
    "PlanV1",
    "ToolCallV1",
    "ToolObservationV1",
    "EvidenceItemV1",
    "ClaimV1",
    "DraftReferenceV1",
    "PreviewV1",
    "ReceiptV1",
    "AIResponseEnvelopeV1",
    "SSEEventEnvelopeV1",
]
