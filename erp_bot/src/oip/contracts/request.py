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
