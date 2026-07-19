"""Client payload vs trusted server request."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import Field, field_validator, model_validator

from .common import ContractBase, TimestampV1, default_schema_version
from .errors import ContractErrorCode, ContractValidationError
from .context_assembly import ContextAssemblyBundleV1
from .dialogue import TurnRelationV1
from .language import LanguageFrameV1
from .object_reference import ObjectReferenceBundleV1
from .reference_coreference import ReferenceCoreferenceBundleV1
from .registry import get_contract_registry
from .clarification_plan import ClarificationPlanBundleV1
from .event_frame import EventFrameV1
from .typed_plan import TypedPlanBundleV1
from .provider_cascade import ProviderCascadeBundleV1
from .prompt_registry import PromptRegistryBundleV1
from .knowledge_source_governance import KnowledgeSourceGovernanceBundleV1
from .structural_segmentation import StructuralSegmentationBundleV1
from .extraction_ocr_plan import ExtractionOcrPlanBundleV1
from .temporal_cross_ref import TemporalCrossRefBundleV1
from .lexical_index import LexicalIndexBundleV1
from .vector_index import VectorIndexBundleV1
from .hybrid_fusion import HybridFusionBundleV1
from .claim_citation import ClaimCitationBundleV1
from .domain_port_mapping import DomainPortMappingBundleV1
from .durable_versioned_draft import DurableVersionedDraftBundleV1
from .deterministic_preview_edit_loop import DeterministicPreviewEditLoopBundleV1
from .explicit_confirmation_oec_dispatch import ExplicitConfirmationOecDispatchBundleV1
from .offline_sync_conflict_reversal import OfflineSyncConflictReversalBundleV1
from .legal_question_research import LegalQuestionResearchBundleV1
from .core_nepal_tax_knowledge_pilot import CoreNepalTaxKnowledgePilotBundleV1
from .tax_calculator_rule_integration import TaxCalculatorRuleIntegrationBundleV1
from .nfrs_nas_policy_disclosure_pilot import NfrsNasPolicyDisclosurePilotBundleV1
from .financial_close_adjustment_assistance import (
    FinancialCloseAdjustmentAssistanceBundleV1,
)
from .broader_nepal_business_law_domain_release import (
    BroaderNepalBusinessLawDomainReleaseBundleV1,
)
from .judicial_decision_intelligence import (
    JudicialDecisionIntelligenceBundleV1,
)
from .continuous_change_intelligence import (
    ContinuousChangeIntelligenceBundleV1,
)
from .security_tenant_red_team import SecurityTenantRedTeamBundleV1
from .load_latency_failover import LoadLatencyFailoverBundleV1
from .backup_restore_disaster_lifecycle import (
    BackupRestoreDisasterLifecycleBundleV1,
)
from .human_review_pilot_operations import (
    HumanReviewPilotOperationsBundleV1,
)
from .governed_improvement_fine_tuning import (
    GovernedImprovementFineTuningBundleV1,
)
from .production_capability_release import (
    ProductionCapabilityReleaseBundleV1,
)
from .nepali_english_speech_channel import (
    NepaliEnglishSpeechChannelBundleV1,
)
from .private_user_document_intelligence import (
    PrivateUserDocumentIntelligenceBundleV1,
)
from .event_spec_registry import EventSpecRegistryBundleV1
from .router_decision import RouterDecisionBundleV1


class InteractionModeV1(str, Enum):
    ASK = "ask"
    ACCOUNTANT = "accountant"


class InputChannelV1(str, Enum):
    TEXT = "text"
    VOICE = "voice"
    UI = "ui"
    UNKNOWN = "unknown"


_FORBIDDEN_CLIENT_IDENTITY_KEYS = frozenset(
    {
        "principal_id",
        "tenant_id",
        "company_id",
        "roles",
        "permissions",
        "authentication_method",
        "user_id",
        "trusted_scope",
        "execution_allowed",
    }
)


class ClientTurnPayloadV1(ContractBase):
    """Untrusted client-controlled fields only."""

    schema_version: str = Field(default_factory=default_schema_version)
    message: str = Field(min_length=1, max_length=20000)
    conversation_id: str | None = Field(default=None, min_length=1, max_length=128)
    session_id: str | None = Field(default=None, min_length=1, max_length=128)  # legacy alias
    mode: InteractionModeV1 = InteractionModeV1.ASK
    input_channel: InputChannelV1 = InputChannelV1.TEXT
    locale_hint: str | None = None
    client_context: dict[str, Any] = Field(default_factory=dict)
    active_ui_context: dict[str, Any] = Field(default_factory=dict)
    active_draft_reference: str | None = None
    client_message_id: str | None = None
    idempotency_key: str | None = None

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @model_validator(mode="after")
    def _no_identity(self) -> ClientTurnPayloadV1:
        # Top-level forbidden keys already outside model; inspect client_context.
        for key in _FORBIDDEN_CLIENT_IDENTITY_KEYS:
            if key in self.client_context:
                # Allow resource selectors only under namespaced key for adapters.
                if key in {"tenant_id", "company_id"} and self.client_context.get(
                    "_resource_selector_only"
                ):
                    continue
                raise ContractValidationError(
                    ContractErrorCode.CLIENT_TRUSTED_SCOPE_FORBIDDEN,
                    f"client payload must not establish {key}",
                    field=key,
                )
        if not self.conversation_id and not self.session_id:
            raise ValueError("conversation_id or session_id is required")
        return self

    def resolved_conversation_id(self) -> str:
        return self.conversation_id or self.session_id or ""


class TrustedScopeV1(ContractBase):
    """Built only from MAI-01 authenticated context."""

    schema_version: str = Field(default_factory=default_schema_version)
    principal_id: str = Field(min_length=1, max_length=128)
    tenant_id: str = Field(min_length=1, max_length=128)
    company_id: str | None = None
    branch_id: str | None = None
    fiscal_context: dict[str, Any] | None = None
    roles: tuple[str, ...] = ()
    permissions: tuple[str, ...] = ()
    authentication_method: str = Field(min_length=1, max_length=64)
    policy_version: str = Field(default="mai-01.1.0")

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)


class CanonicalAIRequestV1(ContractBase):
    schema_version: str = Field(default_factory=default_schema_version)
    request_id: str = Field(min_length=1, max_length=128)
    correlation_id: str = Field(min_length=1, max_length=128)
    conversation_id: str = Field(min_length=1, max_length=128)
    message_id: str = Field(min_length=1, max_length=128)
    trusted_scope: TrustedScopeV1
    mode: InteractionModeV1
    raw_text: str = Field(min_length=1, max_length=20000)
    input_channel: InputChannelV1 = InputChannelV1.TEXT
    locale_hint: str | None = None
    timezone: str = "Asia/Kathmandu"
    client_capabilities: dict[str, Any] = Field(default_factory=dict)
    active_ui_context: dict[str, Any] = Field(default_factory=dict)
    active_draft_reference: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # MAI-05: optional typed LanguageFrame (None when analysis not attached).
    language_frame: LanguageFrameV1 | None = None
    # MAI-13: candidate-only conversation object references (never merges drafts).
    object_reference_bundle: ObjectReferenceBundleV1 | None = None
    # MAI-14: turn-relation decision (annotation only; never merge authority).
    turn_relation: TurnRelationV1 | None = None
    # MAI-15: reference/coreference/correction candidates (never applied).
    reference_coreference_bundle: ReferenceCoreferenceBundleV1 | None = None
    # MAI-16: context assembly candidates + memory policy (annotation only).
    context_assembly_bundle: ContextAssemblyBundleV1 | None = None
    # MAI-17: hierarchical router + OOD (annotation only; never execution authority).
    router_decision_bundle: RouterDecisionBundleV1 | None = None
    # MAI-18: event specification registry candidates.
    event_spec_registry_bundle: EventSpecRegistryBundleV1 | None = None
    # MAI-18 slice 2: EventFrame skeleton from selected spec (no value extraction).
    event_frame: EventFrameV1 | None = None
    # MAI-20: information-gain clarification plan (annotation only).
    clarification_plan_bundle: ClarificationPlanBundleV1 | None = None
    # MAI-21: typed PlanV1 annotation (no tool execution).
    typed_plan_bundle: TypedPlanBundleV1 | None = None
    # MAI-22: provider cascade annotation (no model invocation).
    provider_cascade_bundle: ProviderCascadeBundleV1 | None = None
    # MAI-23: prompt template + structured-output schema refs (annotation only).
    prompt_registry_bundle: PromptRegistryBundleV1 | None = None
    # MAI-24: knowledge source / document governance (annotation only).
    knowledge_source_governance_bundle: KnowledgeSourceGovernanceBundleV1 | None = None
    # MAI-25: structural segmentation candidates (no OCR / extraction mutate).
    structural_segmentation_bundle: StructuralSegmentationBundleV1 | None = None
    # MAI-25 slice 2: extraction / OCR plan (never executes OCR).
    extraction_ocr_plan_bundle: ExtractionOcrPlanBundleV1 | None = None
    # MAI-26: temporal / amendment / cross-reference cues (never proven/applied).
    temporal_cross_ref_bundle: TemporalCrossRefBundleV1 | None = None
    # MAI-27: lexical index readiness (no MATCH query / no mutations).
    lexical_index_bundle: LexicalIndexBundleV1 | None = None
    # MAI-28: vector / semantic index readiness (no embed/query; not prod-eligible).
    vector_index_bundle: VectorIndexBundleV1 | None = None
    # MAI-29: hybrid fusion / evidence policy (no RRF execute / no rerank).
    hybrid_fusion_bundle: HybridFusionBundleV1 | None = None
    # MAI-30: claim-citation / grounded-answer policy (never verified in annotation).
    claim_citation_bundle: ClaimCitationBundleV1 | None = None
    # MAI-31: EventFrame → domain port mapping (never executes ports / drafts).
    domain_port_mapping_bundle: DomainPortMappingBundleV1 | None = None
    # MAI-32: durable versioned draft readiness (never save_*/aggregate write).
    durable_versioned_draft_bundle: DurableVersionedDraftBundleV1 | None = None
    # MAI-33: deterministic preview / edit-loop policy (never generates cards).
    deterministic_preview_edit_loop_bundle: (
        DeterministicPreviewEditLoopBundleV1 | None
    ) = None
    # MAI-34: explicit confirm / OEC dispatch policy (never posts).
    explicit_confirmation_oec_dispatch_bundle: (
        ExplicitConfirmationOecDispatchBundleV1 | None
    ) = None
    # MAI-35: offline / sync / conflict / reversal policy (never syncs).
    offline_sync_conflict_reversal_bundle: (
        OfflineSyncConflictReversalBundleV1 | None
    ) = None
    # MAI-36: legal question framer / research mode (never mutates / proves law).
    legal_question_research_bundle: LegalQuestionResearchBundleV1 | None = None
    # MAI-37: core Nepal tax knowledge pilot (never calculates / proves law).
    core_nepal_tax_knowledge_pilot_bundle: (
        CoreNepalTaxKnowledgePilotBundleV1 | None
    ) = None
    # MAI-38: tax calculator / rule integration policy (never executes).
    tax_calculator_rule_integration_bundle: (
        TaxCalculatorRuleIntegrationBundleV1 | None
    ) = None
    # MAI-39: NFRS/NAS policy/mapping/disclosure pilot (never files).
    nfrs_nas_policy_disclosure_pilot_bundle: (
        NfrsNasPolicyDisclosurePilotBundleV1 | None
    ) = None
    # MAI-40: financial close / adjustment assistance (never posts).
    financial_close_adjustment_assistance_bundle: (
        FinancialCloseAdjustmentAssistanceBundleV1 | None
    ) = None
    # MAI-41: broader Nepal business-law domain release (never releases).
    broader_nepal_business_law_domain_release_bundle: (
        BroaderNepalBusinessLawDomainReleaseBundleV1 | None
    ) = None
    # MAI-42: judicial/decision intelligence (never judicial authority).
    judicial_decision_intelligence_bundle: (
        JudicialDecisionIntelligenceBundleV1 | None
    ) = None
    # MAI-43: continuous change intelligence (never production truth).
    continuous_change_intelligence_bundle: (
        ContinuousChangeIntelligenceBundleV1 | None
    ) = None
    # MAI-44: security/tenant red team (never pen-test pass claim).
    security_tenant_red_team_bundle: SecurityTenantRedTeamBundleV1 | None = None
    # MAI-45: load/latency/resource/failover (never claims SLOs met).
    load_latency_failover_bundle: LoadLatencyFailoverBundleV1 | None = None
    # MAI-46: backup/restore/disaster/lifecycle (never claims DR proven).
    backup_restore_disaster_lifecycle_bundle: (
        BackupRestoreDisasterLifecycleBundleV1 | None
    ) = None
    # MAI-47: human review / pilot ops (never claims review complete).
    human_review_pilot_operations_bundle: (
        HumanReviewPilotOperationsBundleV1 | None
    ) = None
    # MAI-48: governed improvement / fine-tuning (never applies changes).
    governed_improvement_fine_tuning_bundle: (
        GovernedImprovementFineTuningBundleV1 | None
    ) = None
    # MAI-49: production capability release (never claims production approved).
    production_capability_release_bundle: (
        ProductionCapabilityReleaseBundleV1 | None
    ) = None
    # MAI-50: Nepali/English speech channel (never enables live speech).
    nepali_english_speech_channel_bundle: (
        NepaliEnglishSpeechChannelBundleV1 | None
    ) = None
    # MAI-51: private user-document intelligence (never ingests docs).
    private_user_document_intelligence_bundle: (
        PrivateUserDocumentIntelligenceBundleV1 | None
    ) = None

    @field_validator("schema_version")
    @classmethod
    def _ver(cls, v: str) -> str:
        return get_contract_registry().assert_supported(v)

    @field_validator("created_at")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("created_at must be timezone-aware")
        return v
