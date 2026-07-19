"""Legacy Orbix chat ingress — CanonicalAIRequestV1 authoritative, then DTO adapter."""

from __future__ import annotations

import json
import os
from typing import Any, AsyncIterator

from ..oip.application.dto.intelligence_request import IntelligenceRequestDto, IntelligenceResponseDto
from ..oip.config.settings import OipSettings, get_oip_settings
from ..oip.contracts.request import CanonicalAIRequestV1
from ..oip.domain.value_objects import ActionType
from ..oip.infrastructure.di.container import get_container
from ..oip.infrastructure.observability.logging import log_event
from ..oip.modules.router.application.queries import GetProviderHealthQuery
from ..oip.shared.ids import TenantId, new_correlation_id, new_request_id

_OIP_CHAT_DEBUG = os.getenv("OIP_CHAT_DEBUG", "false").lower() in {"1", "true", "yes"}


def oip_chat_enabled() -> bool:
    settings = get_oip_settings()
    return settings.enabled and settings.orchestrator_enabled and settings.provider_runtime_enabled


def provider_runtime_active(settings: OipSettings | None = None) -> bool:
    """True when production should not depend on a local Ollama daemon."""
    cfg = settings or get_oip_settings()
    return cfg.enabled and cfg.provider_runtime_enabled


def provider_runtime_llm_ready(settings: OipSettings | None = None) -> bool:
    cfg = settings or get_oip_settings()
    if not provider_runtime_active(cfg):
        return False
    if cfg.provider_offline_mode:
        return False
    if cfg.force_stub_providers:
        return True
    return bool(
        cfg.openai_api_key
        or cfg.anthropic_api_key
        or cfg.google_api_key
        or cfg.groq_api_key
        or cfg.ollama_base_url
    )


async def build_canonical_ai_request(
    *,
    message: str,
    session_id: str,
    context: dict[str, Any] | None = None,
    language: str | None = None,
    orbix_mode: str | None = None,
    schema_version: str | None = None,
    headers: Any = None,
) -> CanonicalAIRequestV1:
    """
    Active request authority boundary (MAI-02 + MAI-03):

    legacy/client body
      -> MAI-03 trace context
      -> LegacyOrbixClientRequestAdapter
      -> MAI-01 trusted principal
      -> CanonicalAIRequestV1 (authoritative)
    """
    from ..orbix.mode_policy import normalize_orbix_mode
    from ..oip.domain.constitution.enforcement import enforce_chat_identity_and_mode
    from ..oip.domain.constitution import DecisionCode
    from ..oip.shared.exceptions import OipForbiddenError
    from ..oip.contracts.adapters.legacy_orbix import (
        LegacyOrbixClientRequestAdapter,
        trusted_scope_from_mai01,
    )
    from ..oip.contracts.errors import ContractValidationError
    from ..oip.contracts.registry import UnsupportedSchemaVersionError
    from ..oip.infrastructure.observability import mai03 as mai03_obs

    settings = get_oip_settings()
    recorder = mai03_obs.get_trace_recorder()
    ctx = mai03_obs.get_trace_context()
    if ctx is None:
        ctx = mai03_obs.start_request_trace(headers=headers, conversation_id=session_id)
    else:
        # Outer gateway already started this hop — continue.
        pass

    request_id = ctx.request_id
    correlation_id = ctx.correlation_id

    raw_mode = orbix_mode
    if raw_mode is None and context:
        raw_mode = context.get("orbix_mode")
    mode = normalize_orbix_mode(raw_mode, invalid_policy="ask")

    auth_ev = recorder.start_stage(
        mai03_obs.TraceStage.AUTHENTICATION_RESOLVED,
        component="constitution",
        route="/orbix/chat/stream",
    )
    requested_company = None
    requested_tenant = None
    if context:
        if context.get("company_id"):
            requested_company = str(context["company_id"])
        if context.get("tenant_id"):
            requested_tenant = str(context["tenant_id"])

    trusted, denial = enforce_chat_identity_and_mode(
        orbix_mode=mode,
        auth_required=settings.auth_required,
        requested_tenant_id=requested_tenant,
        requested_company_id=requested_company,
        correlation_id=correlation_id,
    )
    if denial is not None and denial.decision_code is DecisionCode.AUTHENTICATION_REQUIRED:
        recorder.fail_stage(auth_ev, safe_error_code="AUTHENTICATION_REQUIRED")
        raise OipForbiddenError("AUTHENTICATION_REQUIRED")
    if denial is not None and denial.decision_code in {
        DecisionCode.TENANT_SCOPE_MISMATCH,
        DecisionCode.COMPANY_SCOPE_MISMATCH,
    }:
        recorder.fail_stage(auth_ev, safe_error_code=denial.decision_code.value)
        raise OipForbiddenError(denial.decision_code.value)
    recorder.complete_stage(auth_ev, outcome_code="AUTH_OK")

    scope_ev = recorder.start_stage(mai03_obs.TraceStage.TENANT_SCOPE_VALIDATED, component="constitution")
    if trusted is not None:
        tenant_id = trusted.tenant_id
        company_id = trusted.active_company_id or ""
        user_id = trusted.principal_id
        if requested_company and trusted.allows_company(requested_company):
            company_id = requested_company
        auth_method = trusted.authentication_method
        roles = tuple(trusted.roles)
        permissions = tuple(trusted.permissions)
    else:
        tenant_id = settings.default_service_tenant_id or ""
        company_id = settings.default_service_company_id or ""
        user_id = ""
        if settings.auth_required:
            recorder.fail_stage(scope_ev, safe_error_code="AUTHENTICATION_REQUIRED")
            raise OipForbiddenError("AUTHENTICATION_REQUIRED")
        auth_method = "none"
        roles = ()
        permissions = ()
    recorder.complete_stage(scope_ev, outcome_code="SCOPE_OK")

    ctx = mai03_obs.bind_scope_references(
        ctx,
        tenant_scope_reference=tenant_id or None,
        company_scope_reference=company_id or None,
        principal_reference=user_id or "unauthenticated",
        conversation_reference=session_id,
    )
    mai03_obs.set_trace_context(ctx)

    policy_ev = recorder.start_stage(
        mai03_obs.TraceStage.CONSTITUTION_POLICY_EVALUATED,
        component="constitution",
        safe_attributes={"orbix_mode": mode},
    )
    recorder.complete_stage(
        policy_ev,
        outcome_code="POLICY_EVALUATED",
        component_versions={"constitution_policy_version": "mai-01.1.0"},
    )

    contract_ev = recorder.start_stage(
        mai03_obs.TraceStage.CLIENT_CONTRACT_VALIDATED, component="contracts"
    )
    body = {
        "schema_version": schema_version or "1.0.0",
        "message": message,
        "session_id": session_id,
        "orbix_mode": mode,
        "context": dict(context or {}),
        "language": language,
    }
    try:
        client_payload, adapter_obs = LegacyOrbixClientRequestAdapter().to_client_payload(body)
        scope = trusted_scope_from_mai01(
            principal_id=user_id or "unauthenticated",
            tenant_id=tenant_id or "unscoped",
            company_id=company_id or None,
            roles=roles,
            permissions=permissions,
            authentication_method=str(auth_method),
        )
        canonical = LegacyOrbixClientRequestAdapter().assemble_canonical(
            client_payload,
            trusted=scope,
            request_id=request_id,
            correlation_id=correlation_id,
        )
    except (ContractValidationError, UnsupportedSchemaVersionError, ValueError) as exc:
        recorder.fail_stage(contract_ev, safe_error_code="INVALID_CONTRACT")
        log_event(
            "oip.chat_ingress.mai02_contract_reject",
            request_id=request_id,
            safe_error_code="INVALID_CONTRACT",
            message_char_length=len(message or ""),
        )
        raise OipForbiddenError(f"INVALID_CONTRACT:{exc}") from exc
    recorder.complete_stage(
        contract_ev,
        outcome_code="CONTRACT_OK",
        component_versions={"contract_schema_version": "1.0.0"},
        safe_attributes={"message_char_length": len(message or "")},
    )

    built_ev = recorder.start_stage(mai03_obs.TraceStage.CANONICAL_REQUEST_BUILT, component="contracts")
    log_event(
        "oip.chat_ingress.mode",
        request_id=canonical.request_id,
        orbix_mode=canonical.mode.value,
        tenant_scope_reference=canonical.trusted_scope.tenant_id,
        company_scope_reference=canonical.trusted_scope.company_id or "",
        contract_authority="CanonicalAIRequestV1",
        adapter=adapter_obs.get("adapter"),
        message_char_length=len(canonical.raw_text),
        trace_reference=ctx.trace_reference,
    )
    recorder.complete_stage(built_ev, outcome_code="CANONICAL_READY")

    # MAI-05: span-level language analysis (annotation only — raw_text unchanged, no routing).
    lang_ev = recorder.start_stage(
        mai03_obs.TraceStage.LANGUAGE_ANALYSIS_STARTED, component="language_runtime"
    )
    try:
        from ..oip.modules.language_runtime.application.language_analyzer import analyze_language

        frame = analyze_language(canonical.raw_text)
        # Typed attach; never mutate raw_text
        if frame.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        canonical = canonical.model_copy(update={"language_frame": frame})
        recorder.complete_stage(
            lang_ev,
            outcome_code=frame.analysis_status.value,
            component_versions=dict(frame.analyzer_versions or {}),
            safe_attributes={
                "span_count": len(frame.span_annotations),
                "protected_count": len(frame.protected_spans),
                "code_mix_pattern": frame.code_mix_pattern or "UNKNOWN",
                "quality_flag_count": len(frame.input_quality_flags or ()),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.LANGUAGE_ANALYSIS_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=frame.analysis_status.value,
            component_versions=dict(frame.analyzer_versions or {}),
            safe_attributes={
                "span_count": len(frame.span_annotations),
                "protected_count": len(frame.protected_spans),
            },
        )
    except Exception:  # noqa: BLE001 — degrade safely; do not alter routing
        recorder.fail_stage(lang_ev, safe_error_code="LANGUAGE_ANALYSIS_FAILED")
        try:
            from ..oip.contracts.language import AnalysisStatus, LanguageFrameV1

            fail_frame = LanguageFrameV1(
                analysis_status=AnalysisStatus.FAILED,
                raw_text=canonical.raw_text,
                warnings=("LANGUAGE_ANALYSIS_FAILED",),
            )
            canonical = canonical.model_copy(update={"language_frame": fail_frame})
        except Exception:  # noqa: BLE001
            pass

    # MAI-06: lossless normalization views (annotation only — does not switch intent input).
    frame = canonical.language_frame
    if frame is not None:
        norm_ev = recorder.start_stage(
            mai03_obs.TraceStage.NORMALIZATION_STARTED, component="language_runtime.normalization"
        )
        try:
            from ..oip.modules.language_runtime.normalization.application.normalization_service import (
                attach_normalization_to_frame,
            )

            updated = attach_normalization_to_frame(frame)
            if updated.raw_text != canonical.raw_text:
                raise RuntimeError("RAW_TEXT_MUTATION")
            bundle = updated.normalization_bundle
            canonical = canonical.model_copy(update={"language_frame": updated})
            applied = 0
            candidates = 0
            if bundle is not None:
                applied = sum(1 for e in bundle.edits if e.applied_views)
                candidates = sum(1 for e in bundle.edits if not e.applied_views)
            recorder.complete_stage(
                norm_ev,
                outcome_code=(bundle.status.value if bundle else "FAILED"),
                component_versions={
                    "normalizer": (bundle.normalizer_version if bundle else "mai-06.1.0"),
                    "normalization_resources": (
                        bundle.resource_pack_version if bundle else "mai-06.1.0"
                    ),
                },
                safe_attributes={
                    "normalization_status": bundle.status.value if bundle else "FAILED",
                    "normalization_edit_count": len(bundle.edits) if bundle else 0,
                    "normalization_view_count": len(bundle.views) if bundle else 0,
                    "normalization_candidate_count": candidates,
                    "applied_edit_count": applied,
                },
            )
            recorder.record_event(
                mai03_obs.TraceStage.NORMALIZATION_COMPLETED,
                mai03_obs.TraceStatus.COMPLETED,
                outcome_code=(bundle.status.value if bundle else "FAILED"),
                safe_attributes={
                    "normalization_status": bundle.status.value if bundle else "FAILED",
                    "normalization_view_count": len(bundle.views) if bundle else 0,
                },
            )
        except Exception:  # noqa: BLE001 — preserve RAW; never default to purchase
            recorder.fail_stage(norm_ev, safe_error_code="NORMALIZATION_FAILED")
            try:
                from ..oip.contracts.normalization import (
                    NormalizationBundleV1,
                    NormalizationStatus,
                    NormalizationViewV1,
                    ViewType,
                )
                from ..oip.modules.language_runtime.normalization.domain.offset_ops import identity_map

                fail_bundle = NormalizationBundleV1(
                    raw_text=canonical.raw_text,
                    views=(
                        NormalizationViewV1(
                            view_id="raw",
                            view_type=ViewType.RAW,
                            text=canonical.raw_text,
                            offset_map=identity_map(len(canonical.raw_text)),
                            allowed_uses=("display", "intent_compatible_raw", "audit"),
                            status=NormalizationStatus.FAILED,
                        ),
                    ),
                    status=NormalizationStatus.FAILED,
                    warnings=("NORMALIZATION_FAILED",),
                )
                canonical = canonical.model_copy(
                    update={
                        "language_frame": frame.model_copy(
                            update={"normalization_bundle": fail_bundle}
                        )
                    }
                )
            except Exception:  # noqa: BLE001
                pass

    # MAI-07: Romanized Nepali candidate transliteration (annotation only — candidates never truth).
    frame = canonical.language_frame
    if frame is not None:
        xl_ev = recorder.start_stage(
            mai03_obs.TraceStage.TRANSLITERATION_STARTED,
            component="language_runtime.transliteration",
        )
        try:
            from ..oip.modules.language_runtime.transliteration.application.transliteration_service import (
                attach_transliteration_to_frame,
            )

            updated = attach_transliteration_to_frame(frame)
            if updated.raw_text != canonical.raw_text:
                raise RuntimeError("RAW_TEXT_MUTATION")
            bundle = updated.transliteration_bundle
            canonical = canonical.model_copy(update={"language_frame": updated})
            recorder.complete_stage(
                xl_ev,
                outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
                component_versions={
                    "transliteration": (bundle.runtime_version if bundle else "mai-07.1.0"),
                    "transliteration_resources": (
                        bundle.resource_version if bundle else "mai-07.1.0"
                    ),
                },
                safe_attributes={
                    "transliteration_status": bundle.analysis_status.value if bundle else "FAILED",
                    "transliteration_eligible_span_count": (
                        bundle.eligible_span_count if bundle else 0
                    ),
                    "transliteration_candidate_count": bundle.candidate_count if bundle else 0,
                    "transliteration_abstention_count": bundle.abstention_count if bundle else 0,
                    "transliteration_truncated_count": bundle.truncated_count if bundle else 0,
                },
            )
            recorder.record_event(
                mai03_obs.TraceStage.TRANSLITERATION_COMPLETED,
                mai03_obs.TraceStatus.COMPLETED,
                outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
                safe_attributes={
                    "transliteration_status": bundle.analysis_status.value if bundle else "FAILED",
                    "transliteration_candidate_count": bundle.candidate_count if bundle else 0,
                },
            )
        except Exception:  # noqa: BLE001 — preserve raw; do not alter routing
            recorder.fail_stage(xl_ev, safe_error_code="TRANSLITERATION_FAILED")
            recorder.record_event(
                mai03_obs.TraceStage.TRANSLITERATION_FAILED,
                mai03_obs.TraceStatus.FAILED,
                safe_error_code="TRANSLITERATION_FAILED",
            )
            try:
                from ..oip.contracts.transliteration import (
                    TransliterationBundleV1,
                    TransliterationStatus,
                )

                fail_bundle = TransliterationBundleV1(
                    analysis_status=TransliterationStatus.FAILED,
                    warnings=("TRANSLITERATION_FAILED",),
                    error_codes=("TRANSLITERATION_FAILED",),
                )
                canonical = canonical.model_copy(
                    update={
                        "language_frame": frame.model_copy(
                            update={"transliteration_bundle": fail_bundle}
                        )
                    }
                )
            except Exception:  # noqa: BLE001
                pass

    # MAI-08: typo / abbreviation / code-mix candidates (annotation only — never applied).
    frame = canonical.language_frame
    if frame is not None:
        tcm_ev = recorder.start_stage(
            mai03_obs.TraceStage.TYPO_CODE_MIX_STARTED,
            component="language_runtime.typo_robustness",
        )
        try:
            from ..oip.modules.language_runtime.typo_robustness.application.typo_code_mix_service import (
                attach_typo_code_mix_to_frame,
            )

            updated = attach_typo_code_mix_to_frame(frame)
            if updated.raw_text != canonical.raw_text:
                raise RuntimeError("RAW_TEXT_MUTATION")
            bundle = updated.typo_code_mix_bundle
            if bundle is not None and bundle.silent_applications != 0:
                raise RuntimeError("SILENT_APPLICATIONS_NONZERO")
            canonical = canonical.model_copy(update={"language_frame": updated})
            recorder.complete_stage(
                tcm_ev,
                outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
                component_versions={
                    "typo_code_mix": (bundle.runtime_version if bundle else "mai-08.0.1-slice1"),
                    "typo_code_mix_resources": (
                        bundle.resource_version if bundle else "mai-08.0.1-slice1"
                    ),
                },
                safe_attributes={
                    "typo_code_mix_status": bundle.analysis_status.value if bundle else "FAILED",
                    "typo_code_mix_candidate_count": bundle.candidate_count if bundle else 0,
                    "typo_code_mix_silent_applications": (
                        bundle.silent_applications if bundle else 0
                    ),
                },
            )
            recorder.record_event(
                mai03_obs.TraceStage.TYPO_CODE_MIX_COMPLETED,
                mai03_obs.TraceStatus.COMPLETED,
                outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
                safe_attributes={
                    "typo_code_mix_status": bundle.analysis_status.value if bundle else "FAILED",
                    "typo_code_mix_candidate_count": bundle.candidate_count if bundle else 0,
                },
            )
        except Exception:  # noqa: BLE001 — preserve raw; do not alter routing
            recorder.fail_stage(tcm_ev, safe_error_code="TYPO_CODE_MIX_FAILED")
            recorder.record_event(
                mai03_obs.TraceStage.TYPO_CODE_MIX_FAILED,
                mai03_obs.TraceStatus.FAILED,
                safe_error_code="TYPO_CODE_MIX_FAILED",
            )
            try:
                from ..oip.contracts.typo_code_mix import (
                    TypoCodeMixBundleV1,
                    TypoCodeMixStatus,
                )

                fail_bundle = TypoCodeMixBundleV1(
                    analysis_status=TypoCodeMixStatus.FAILED,
                    warnings=("TYPO_CODE_MIX_FAILED",),
                    error_codes=("TYPO_CODE_MIX_FAILED",),
                )
                canonical = canonical.model_copy(
                    update={
                        "language_frame": frame.model_copy(
                            update={"typo_code_mix_bundle": fail_bundle}
                        )
                    }
                )
            except Exception:  # noqa: BLE001
                pass

    # MAI-09: number / duration / ID role candidates (annotation only).
    frame = canonical.language_frame
    if frame is not None:
        nr_ev = recorder.start_stage(
            mai03_obs.TraceStage.NUMBER_ROLES_STARTED,
            component="language_runtime.number_roles",
        )
        try:
            from ..oip.modules.language_runtime.number_roles.application.number_role_service import (
                attach_number_roles_to_frame,
            )

            updated = attach_number_roles_to_frame(frame)
            if updated.raw_text != canonical.raw_text:
                raise RuntimeError("RAW_TEXT_MUTATION")
            bundle = updated.number_role_bundle
            if bundle is not None and bundle.silent_applications != 0:
                raise RuntimeError("SILENT_APPLICATIONS_NONZERO")
            canonical = canonical.model_copy(update={"language_frame": updated})
            recorder.complete_stage(
                nr_ev,
                outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
                component_versions={
                    "number_roles": (bundle.runtime_version if bundle else "mai-09.0.1-slice1"),
                },
                safe_attributes={
                    "number_roles_status": bundle.analysis_status.value if bundle else "FAILED",
                    "number_roles_candidate_count": bundle.candidate_count if bundle else 0,
                },
            )
            recorder.record_event(
                mai03_obs.TraceStage.NUMBER_ROLES_COMPLETED,
                mai03_obs.TraceStatus.COMPLETED,
                outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
                safe_attributes={
                    "number_roles_candidate_count": bundle.candidate_count if bundle else 0,
                },
            )
        except Exception:  # noqa: BLE001
            recorder.fail_stage(nr_ev, safe_error_code="NUMBER_ROLES_FAILED")
            recorder.record_event(
                mai03_obs.TraceStage.NUMBER_ROLES_FAILED,
                mai03_obs.TraceStatus.FAILED,
                safe_error_code="NUMBER_ROLES_FAILED",
            )
            try:
                from ..oip.contracts.number_roles import (
                    NumberRoleBundleV1,
                    NumberRoleStatus,
                )

                fail_bundle = NumberRoleBundleV1(
                    analysis_status=NumberRoleStatus.FAILED,
                    warnings=("NUMBER_ROLES_FAILED",),
                    error_codes=("NUMBER_ROLES_FAILED",),
                )
                canonical = canonical.model_copy(
                    update={
                        "language_frame": frame.model_copy(
                            update={"number_role_bundle": fail_bundle}
                        )
                    }
                )
            except Exception:  # noqa: BLE001
                pass

    # MAI-10: domain lexicon / concept ontology candidates (annotation only).
    frame = canonical.language_frame
    if frame is not None:
        dl_ev = recorder.start_stage(
            mai03_obs.TraceStage.DOMAIN_LEXICON_STARTED,
            component="language_runtime.domain_lexicon",
        )
        try:
            from ..oip.modules.language_runtime.domain_lexicon.application.domain_lexicon_service import (
                attach_domain_lexicon_to_frame,
            )

            updated = attach_domain_lexicon_to_frame(frame)
            if updated.raw_text != canonical.raw_text:
                raise RuntimeError("RAW_TEXT_MUTATION")
            bundle = updated.domain_lexicon_bundle
            if bundle is not None and bundle.silent_applications != 0:
                raise RuntimeError("SILENT_APPLICATIONS_NONZERO")
            canonical = canonical.model_copy(update={"language_frame": updated})
            recorder.complete_stage(
                dl_ev,
                outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
                component_versions={
                    "domain_lexicon": (bundle.runtime_version if bundle else "mai-10.0.1-slice1"),
                },
                safe_attributes={
                    "domain_lexicon_status": bundle.analysis_status.value if bundle else "FAILED",
                    "domain_lexicon_candidate_count": bundle.candidate_count if bundle else 0,
                },
            )
            recorder.record_event(
                mai03_obs.TraceStage.DOMAIN_LEXICON_COMPLETED,
                mai03_obs.TraceStatus.COMPLETED,
                outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
                safe_attributes={
                    "domain_lexicon_candidate_count": bundle.candidate_count if bundle else 0,
                },
            )
        except Exception:  # noqa: BLE001
            recorder.fail_stage(dl_ev, safe_error_code="DOMAIN_LEXICON_FAILED")
            recorder.record_event(
                mai03_obs.TraceStage.DOMAIN_LEXICON_FAILED,
                mai03_obs.TraceStatus.FAILED,
                safe_error_code="DOMAIN_LEXICON_FAILED",
            )
            try:
                from ..oip.contracts.domain_lexicon import (
                    DomainLexiconBundleV1,
                    DomainLexiconStatus,
                )

                fail_bundle = DomainLexiconBundleV1(
                    analysis_status=DomainLexiconStatus.FAILED,
                    warnings=("DOMAIN_LEXICON_FAILED",),
                    error_codes=("DOMAIN_LEXICON_FAILED",),
                )
                canonical = canonical.model_copy(
                    update={
                        "language_frame": frame.model_copy(
                            update={"domain_lexicon_bundle": fail_bundle}
                        )
                    }
                )
            except Exception:  # noqa: BLE001
                pass

    # MAI-11: response language / register policy (annotation only; no rewrite).
    frame = canonical.language_frame
    if frame is not None:
        rr_ev = recorder.start_stage(
            mai03_obs.TraceStage.RESPONSE_REGISTER_STARTED,
            component="language_runtime.response_register",
        )
        try:
            from ..oip.modules.language_runtime.response_register.application.response_register_service import (
                attach_response_register_to_frame,
            )

            updated = attach_response_register_to_frame(frame)
            if updated.raw_text != canonical.raw_text:
                raise RuntimeError("RAW_TEXT_MUTATION")
            bundle = updated.response_register_bundle
            if bundle is not None and (
                bundle.silent_applications != 0 or bundle.applied_response_rewrite
            ):
                raise RuntimeError("SILENT_APPLICATIONS_OR_REWRITE")
            canonical = canonical.model_copy(update={"language_frame": updated})
            recorder.complete_stage(
                rr_ev,
                outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
                component_versions={
                    "response_register": (
                        bundle.runtime_version if bundle else "mai-11.0.1-slice1"
                    ),
                },
                safe_attributes={
                    "response_register_status": bundle.analysis_status.value if bundle else "FAILED",
                    "response_language": (
                        bundle.response_language.value if bundle else "UNKNOWN"
                    ),
                    "linguistic_register": (
                        bundle.linguistic_register.value if bundle else "UNKNOWN"
                    ),
                },
            )
            recorder.record_event(
                mai03_obs.TraceStage.RESPONSE_REGISTER_COMPLETED,
                mai03_obs.TraceStatus.COMPLETED,
                outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
                safe_attributes={
                    "response_language": (
                        bundle.response_language.value if bundle else "UNKNOWN"
                    ),
                    "mirror_user_language": bool(bundle.mirror_user_language)
                    if bundle
                    else False,
                },
            )
        except Exception:  # noqa: BLE001
            recorder.fail_stage(rr_ev, safe_error_code="RESPONSE_REGISTER_FAILED")
            recorder.record_event(
                mai03_obs.TraceStage.RESPONSE_REGISTER_FAILED,
                mai03_obs.TraceStatus.FAILED,
                safe_error_code="RESPONSE_REGISTER_FAILED",
            )
            try:
                from ..oip.contracts.response_register import (
                    ResponseRegisterBundleV1,
                    ResponseRegisterStatus,
                )

                fail_bundle = ResponseRegisterBundleV1(
                    analysis_status=ResponseRegisterStatus.FAILED,
                    warnings=("RESPONSE_REGISTER_FAILED",),
                    error_codes=("RESPONSE_REGISTER_FAILED",),
                )
                canonical = canonical.model_copy(
                    update={
                        "language_frame": frame.model_copy(
                            update={"response_register_bundle": fail_bundle}
                        )
                    }
                )
            except Exception:  # noqa: BLE001
                pass

    # MAI-13: conversation object-reference candidates (annotation only; no draft merge).
    oref_ev = recorder.start_stage(
        mai03_obs.TraceStage.OBJECT_REFERENCE_STARTED,
        component="conversation.object_reference",
    )
    try:
        from ..oip.modules.conversation.application.object_reference_service import (
            attach_object_references_to_request,
        )

        updated = attach_object_references_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.object_reference_bundle
        if bundle is not None and (
            bundle.silent_applications != 0 or bundle.draft_mutations != 0
        ):
            raise RuntimeError("OBJECT_REFERENCE_MUTATION")
        canonical = updated
        recorder.complete_stage(
            oref_ev,
            outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
            component_versions={
                "object_reference": (
                    bundle.runtime_version if bundle else "mai-13.0.1-slice1"
                ),
            },
            safe_attributes={
                "object_reference_status": bundle.analysis_status.value if bundle else "FAILED",
                "object_reference_candidate_count": bundle.candidate_count if bundle else 0,
                "object_reference_resolution_count": (
                    bundle.resolution_count if bundle else 0
                ),
                "object_reference_found_count": bundle.found_count if bundle else 0,
                "object_reference_missing_count": bundle.missing_count if bundle else 0,
                "object_reference_not_pending_count": (
                    bundle.not_pending_count if bundle else 0
                ),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.OBJECT_REFERENCE_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
            safe_attributes={
                "object_reference_candidate_count": bundle.candidate_count if bundle else 0,
                "object_reference_resolution_count": (
                    bundle.resolution_count if bundle else 0
                ),
                "object_reference_found_count": bundle.found_count if bundle else 0,
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(oref_ev, safe_error_code="OBJECT_REFERENCE_FAILED")
        recorder.record_event(
            mai03_obs.TraceStage.OBJECT_REFERENCE_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="OBJECT_REFERENCE_FAILED",
        )
        try:
            from ..oip.contracts.object_reference import (
                ObjectReferenceBundleV1,
                ObjectReferenceStatus,
            )

            fail_bundle = ObjectReferenceBundleV1(
                analysis_status=ObjectReferenceStatus.FAILED,
                warnings=("OBJECT_REFERENCE_FAILED",),
                error_codes=("OBJECT_REFERENCE_FAILED",),
            )
            canonical = canonical.model_copy(
                update={"object_reference_bundle": fail_bundle}
            )
        except Exception:  # noqa: BLE001
            pass

    # MAI-14: turn-relation decision (annotation only; never draft merge).
    tr_ev = recorder.start_stage(
        mai03_obs.TraceStage.TURN_RELATION_STARTED,
        component="conversation.turn_relation",
    )
    try:
        from ..oip.modules.conversation.application.turn_relation_service import (
            attach_turn_relation_to_request,
        )

        updated = attach_turn_relation_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        decision = updated.turn_relation
        if decision is not None and decision.is_execution_authority:
            raise RuntimeError("TURN_RELATION_EXECUTION_AUTHORITY")
        canonical = updated
        recorder.complete_stage(
            tr_ev,
            outcome_code=(decision.relation.value if decision else "FAILED"),
            component_versions={
                "turn_relation": (
                    decision.classifier_version if decision else "mai-14.0.2-slice2"
                ),
            },
            safe_attributes={
                "turn_relation": decision.relation.value if decision else "FAILED",
                "turn_relation_status": decision.status.value if decision else "FAILED",
                "turn_relation_ref_count": (
                    len(decision.referenced_object_ids) if decision else 0
                ),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.TURN_RELATION_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(decision.relation.value if decision else "FAILED"),
            safe_attributes={
                "turn_relation": decision.relation.value if decision else "FAILED",
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(tr_ev, safe_error_code="TURN_RELATION_FAILED")
        recorder.record_event(
            mai03_obs.TraceStage.TURN_RELATION_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="TURN_RELATION_FAILED",
        )
        try:
            from ..oip.contracts.dialogue import (
                ContractStatus,
                TurnRelationKind,
                TurnRelationV1,
            )

            fail = TurnRelationV1(
                relation=TurnRelationKind.UNKNOWN,
                classifier_version="mai-14.0.2-slice2",
                status=ContractStatus.FAILED,
            )
            canonical = canonical.model_copy(update={"turn_relation": fail})
        except Exception:  # noqa: BLE001
            pass

    # MAI-15: reference / coreference / correction candidates (annotation only).
    rc_ev = recorder.start_stage(
        mai03_obs.TraceStage.REFERENCE_COREFERENCE_STARTED,
        component="conversation.reference_coreference",
    )
    try:
        from ..oip.modules.conversation.application.reference_coreference_service import (
            attach_reference_coreference_to_request,
        )

        updated = attach_reference_coreference_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.reference_coreference_bundle
        if bundle is not None and (
            bundle.silent_applications != 0 or bundle.draft_mutations != 0
        ):
            raise RuntimeError("REFERENCE_COREFERENCE_MUTATION")
        canonical = updated
        recorder.complete_stage(
            rc_ev,
            outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
            component_versions={
                "reference_coreference": (
                    bundle.runtime_version if bundle else "mai-15.0.2-slice2"
                ),
            },
            safe_attributes={
                "reference_coreference_status": (
                    bundle.analysis_status.value if bundle else "FAILED"
                ),
                "reference_coreference_mention_count": (
                    bundle.mention_count if bundle else 0
                ),
                "reference_coreference_correction_count": (
                    bundle.correction_count if bundle else 0
                ),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.REFERENCE_COREFERENCE_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
            safe_attributes={
                "reference_coreference_mention_count": (
                    bundle.mention_count if bundle else 0
                ),
                "reference_coreference_correction_count": (
                    bundle.correction_count if bundle else 0
                ),
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(rc_ev, safe_error_code="REFERENCE_COREFERENCE_FAILED")
        recorder.record_event(
            mai03_obs.TraceStage.REFERENCE_COREFERENCE_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="REFERENCE_COREFERENCE_FAILED",
        )
        try:
            from ..oip.contracts.reference_coreference import (
                ReferenceCoreferenceBundleV1,
                ReferenceCoreferenceStatus,
            )

            fail_bundle = ReferenceCoreferenceBundleV1(
                analysis_status=ReferenceCoreferenceStatus.FAILED,
                warnings=("REFERENCE_COREFERENCE_FAILED",),
                error_codes=("REFERENCE_COREFERENCE_FAILED",),
            )
            canonical = canonical.model_copy(
                update={"reference_coreference_bundle": fail_bundle}
            )
        except Exception:  # noqa: BLE001
            pass

    # MAI-16: context assembly + memory policy (annotation only; no memory writes).
    ca_ev = recorder.start_stage(
        mai03_obs.TraceStage.CONTEXT_ASSEMBLY_STARTED,
        component="conversation.context_assembly",
    )
    try:
        from ..oip.modules.conversation.application.context_assembly_service import (
            attach_context_assembly_to_request,
        )

        updated = attach_context_assembly_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.context_assembly_bundle
        if bundle is not None and (
            bundle.silent_applications != 0
            or bundle.draft_mutations != 0
            or bundle.memory_writes != 0
            or bundle.is_execution_authority
        ):
            raise RuntimeError("CONTEXT_ASSEMBLY_MUTATION")
        canonical = updated
        recorder.complete_stage(
            ca_ev,
            outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
            component_versions={
                "context_assembly": (
                    bundle.runtime_version if bundle else "mai-16.0.2-slice2"
                ),
            },
            safe_attributes={
                "context_assembly_status": (
                    bundle.analysis_status.value if bundle else "FAILED"
                ),
                "context_assembly_included_count": (
                    bundle.included_count if bundle else 0
                ),
                "context_assembly_active_task": (
                    bool(bundle.active_task_present) if bundle else False
                ),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.CONTEXT_ASSEMBLY_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
            safe_attributes={
                "context_assembly_included_count": (
                    bundle.included_count if bundle else 0
                ),
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(ca_ev, safe_error_code="CONTEXT_ASSEMBLY_FAILED")
        recorder.record_event(
            mai03_obs.TraceStage.CONTEXT_ASSEMBLY_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="CONTEXT_ASSEMBLY_FAILED",
        )
        try:
            from ..oip.contracts.context_assembly import (
                ContextAssemblyBundleV1,
                ContextAssemblyStatus,
            )

            fail_bundle = ContextAssemblyBundleV1(
                analysis_status=ContextAssemblyStatus.FAILED,
                warnings=("CONTEXT_ASSEMBLY_FAILED",),
                error_codes=("CONTEXT_ASSEMBLY_FAILED",),
            )
            canonical = canonical.model_copy(
                update={"context_assembly_bundle": fail_bundle}
            )
        except Exception:  # noqa: BLE001
            pass

    # MAI-17: hierarchical router + OOD (annotation only; never execution authority).
    rt_ev = recorder.start_stage(
        mai03_obs.TraceStage.ROUTING_STARTED,
        component="conversation.hierarchical_router",
    )
    try:
        from ..oip.modules.conversation.application.hierarchical_router_service import (
            attach_router_decision_to_request,
        )

        updated = attach_router_decision_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.router_decision_bundle
        if bundle is not None and (
            bundle.silent_applications != 0
            or bundle.draft_mutations != 0
            or bundle.is_execution_authority
        ):
            raise RuntimeError("ROUTER_DECISION_MUTATION")
        canonical = updated
        recorder.complete_stage(
            rt_ev,
            outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
            component_versions={
                "hierarchical_router": (
                    bundle.runtime_version if bundle else "mai-17.0.2-slice2"
                ),
            },
            safe_attributes={
                "router_domain": (bundle.domain.value if bundle else "UNKNOWN"),
                "router_intent_family": (
                    bundle.intent_family.value if bundle else "UNKNOWN"
                ),
                "router_ood_score": (bundle.ood.score if bundle else 0.0),
                "router_is_ood": (bool(bundle.ood.is_ood) if bundle else False),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.ROUTING_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
            safe_attributes={
                "router_domain": (bundle.domain.value if bundle else "UNKNOWN"),
                "router_is_ood": (bool(bundle.ood.is_ood) if bundle else False),
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(rt_ev, safe_error_code="ROUTING_FAILED")
        recorder.record_event(
            mai03_obs.TraceStage.ROUTING_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="ROUTING_FAILED",
        )
        try:
            from ..oip.contracts.router_decision import (
                RouterAnalysisStatus,
                RouterDecisionBundleV1,
            )

            fail_bundle = RouterDecisionBundleV1(
                analysis_status=RouterAnalysisStatus.FAILED,
                warnings=("ROUTING_FAILED",),
                error_codes=("ROUTING_FAILED",),
            )
            canonical = canonical.model_copy(
                update={"router_decision_bundle": fail_bundle}
            )
        except Exception:  # noqa: BLE001
            pass

    # MAI-18: event specification registry (annotation only; never fills EventFrame).
    es_ev = recorder.start_stage(
        mai03_obs.TraceStage.EVENT_SPEC_REGISTRY_STARTED,
        component="conversation.event_spec_registry",
    )
    try:
        from ..oip.modules.conversation.application.event_spec_registry_service import (
            attach_event_spec_registry_to_request,
        )

        updated = attach_event_spec_registry_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.event_spec_registry_bundle
        frame = updated.event_frame
        if bundle is not None and (
            bundle.silent_applications != 0
            or bundle.draft_mutations != 0
            or bundle.is_execution_authority
        ):
            raise RuntimeError("EVENT_SPEC_REGISTRY_MUTATION")
        if frame is not None and (
            frame.authorizes_posting
            or frame.receipt_id is not None
            or frame.execution_success is not None
            or len(frame.values) != 0
            or len(frame.explicit_values) != 0
        ):
            raise RuntimeError("EVENT_FRAME_SKELETON_MUTATION")
        canonical = updated
        recorder.complete_stage(
            es_ev,
            outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
            component_versions={
                "event_spec_registry": (
                    bundle.runtime_version if bundle else "mai-18.0.2-slice2"
                ),
            },
            safe_attributes={
                "event_spec_status": (
                    bundle.analysis_status.value if bundle else "FAILED"
                ),
                "event_spec_selected": (
                    bundle.selected_spec_id if bundle else None
                ),
                "event_spec_candidate_count": (
                    len(bundle.candidates) if bundle else 0
                ),
                "event_frame_status": (
                    frame.status.value if frame else None
                ),
                "event_frame_missing_count": (
                    len(frame.missing_required_fields) if frame else 0
                ),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.EVENT_SPEC_REGISTRY_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(bundle.analysis_status.value if bundle else "FAILED"),
            safe_attributes={
                "event_spec_selected": (
                    bundle.selected_spec_id if bundle else None
                ),
                "event_frame_status": (
                    frame.status.value if frame else None
                ),
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(es_ev, safe_error_code="EVENT_SPEC_REGISTRY_FAILED")
        recorder.record_event(
            mai03_obs.TraceStage.EVENT_SPEC_REGISTRY_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="EVENT_SPEC_REGISTRY_FAILED",
        )
        try:
            from ..oip.contracts.event_spec_registry import (
                EventSpecAnalysisStatus,
                EventSpecRegistryBundleV1,
            )

            fail_bundle = EventSpecRegistryBundleV1(
                analysis_status=EventSpecAnalysisStatus.FAILED,
                warnings=("EVENT_SPEC_REGISTRY_FAILED",),
                error_codes=("EVENT_SPEC_REGISTRY_FAILED",),
            )
            canonical = canonical.model_copy(
                update={"event_spec_registry_bundle": fail_bundle}
            )
        except Exception:  # noqa: BLE001
            pass

    # MAI-19: structured EventFrame value extraction (deterministic; never posts).
    ef_ev = recorder.start_stage(
        mai03_obs.TraceStage.EVENT_FRAME_EXTRACTION_STARTED,
        component="conversation.event_frame_extraction",
    )
    try:
        from ..oip.modules.conversation.application.event_frame_extraction_service import (
            attach_event_frame_extraction_to_request,
        )

        updated = attach_event_frame_extraction_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        frame = updated.event_frame
        if frame is not None and (
            frame.authorizes_posting
            or frame.receipt_id is not None
            or frame.execution_success is not None
        ):
            raise RuntimeError("EVENT_FRAME_EXTRACTION_AUTHORITY")
        canonical = updated
        recorder.complete_stage(
            ef_ev,
            outcome_code=(frame.status.value if frame else "FAILED"),
            component_versions={
                "event_frame_extraction": "mai-19.0.2-slice2",
            },
            safe_attributes={
                "event_frame_status": (frame.status.value if frame else None),
                "event_frame_value_count": (len(frame.values) if frame else 0),
                "event_frame_missing_count": (
                    len(frame.missing_required_fields) if frame else 0
                ),
                "event_frame_type": (frame.event_type if frame else None),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.EVENT_FRAME_EXTRACTION_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(frame.status.value if frame else "FAILED"),
            safe_attributes={
                "event_frame_value_count": (len(frame.values) if frame else 0),
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(ef_ev, safe_error_code="EVENT_FRAME_EXTRACTION_FAILED")
        recorder.record_event(
            mai03_obs.TraceStage.EVENT_FRAME_EXTRACTION_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="EVENT_FRAME_EXTRACTION_FAILED",
        )
        # Fail closed: keep skeleton frame; do not invent values.

    # MAI-20: information-gain clarification plan (annotation only).
    cp_ev = recorder.begin_stage(
        mai03_obs.TraceStage.CLARIFICATION_PLAN_STARTED,
        component="conversation.clarification_plan",
    )
    try:
        from ..oip.modules.conversation.application.clarification_plan_service import (
            attach_clarification_plan_to_request,
        )

        updated = attach_clarification_plan_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        plan = updated.clarification_plan_bundle
        if plan is not None and (
            plan.is_execution_authority
            or plan.silent_applications != 0
            or plan.draft_mutations != 0
        ):
            raise RuntimeError("CLARIFICATION_PLAN_AUTHORITY")
        canonical = updated
        recorder.complete_stage(
            cp_ev,
            version_map={
                "clarification_plan": "mai-20.0.2-slice2",
            },
            safe_attributes={
                "clarification_status": (
                    plan.analysis_status.value if plan else None
                ),
                "clarification_primary": (
                    plan.primary_field if plan else None
                ),
                "clarification_target_count": (
                    len(plan.targets) if plan else 0
                ),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.CLARIFICATION_PLAN_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(
                plan.analysis_status.value if plan else "FAILED"
            ),
            safe_attributes={
                "clarification_primary": (
                    plan.primary_field if plan else None
                ),
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(cp_ev, safe_error_code="CLARIFICATION_PLAN_FAILED")
        recorder.record_event(
            mai03_obs.TraceStage.CLARIFICATION_PLAN_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="CLARIFICATION_PLAN_FAILED",
        )
        # Fail closed: leave prior annotations; do not invent a plan.

    # MAI-21: typed PlanV1 annotation (no tool execution).
    tp_ev = recorder.begin_stage(
        mai03_obs.TraceStage.TYPED_PLAN_STARTED,
        component="conversation.typed_plan",
    )
    try:
        from ..oip.modules.conversation.application.typed_plan_service import (
            assert_typed_plan_authority,
            attach_typed_plan_to_request,
        )

        updated = attach_typed_plan_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.typed_plan_bundle
        assert_typed_plan_authority(bundle)
        canonical = updated
        plan = bundle.plan if bundle else None
        authorized_count = 0
        if bundle is not None:
            from ..oip.contracts.plan_tools import ToolCallStatus

            authorized_count = sum(
                1
                for c in bundle.proposed_tool_calls
                if c.status == ToolCallStatus.AUTHORIZED
            )
        recorder.complete_stage(
            tp_ev,
            version_map={
                "typed_plan": "mai-21.0.2-slice2",
            },
            safe_attributes={
                "typed_plan_status": (
                    bundle.analysis_status.value if bundle else None
                ),
                "typed_plan_event_type": (
                    bundle.event_type if bundle else None
                ),
                "typed_plan_step_count": (
                    len(plan.ordered_steps) if plan else 0
                ),
                "typed_plan_authorized_tools": authorized_count,
                "typed_plan_proposed_tools": (
                    len(bundle.proposed_tool_calls) if bundle else 0
                ),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.TYPED_PLAN_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(
                bundle.analysis_status.value if bundle else "FAILED"
            ),
            safe_attributes={
                "typed_plan_id": (plan.plan_id if plan else None),
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(tp_ev, safe_error_code="TYPED_PLAN_FAILED")
        recorder.record_event(
            mai03_obs.TraceStage.TYPED_PLAN_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="TYPED_PLAN_FAILED",
        )
        # Fail closed: leave prior annotations; do not invent a plan.

    # MAI-22: provider cascade annotation (no model invocation).
    pc_ev = recorder.begin_stage(
        mai03_obs.TraceStage.PROVIDER_CASCADE_STARTED,
        component="conversation.provider_cascade",
    )
    try:
        from ..oip.modules.conversation.application.provider_cascade_service import (
            assert_provider_cascade_authority,
            attach_provider_cascade_to_request,
        )

        updated = attach_provider_cascade_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.provider_cascade_bundle
        assert_provider_cascade_authority(bundle)
        canonical = updated
        recorder.complete_stage(
            pc_ev,
            version_map={
                "provider_cascade": "mai-22.0.2-slice2",
            },
            safe_attributes={
                "provider_cascade_status": (
                    bundle.analysis_status.value if bundle else None
                ),
                "selected_provider_id": (
                    bundle.selected_provider_id if bundle else None
                ),
                "cascade_length": (
                    len(bundle.cascade_order) if bundle else 0
                ),
                "model_invocations": (
                    bundle.model_invocations if bundle else 0
                ),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.PROVIDER_CASCADE_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(
                bundle.analysis_status.value if bundle else "FAILED"
            ),
            safe_attributes={
                "selected_provider_id": (
                    bundle.selected_provider_id if bundle else None
                ),
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(pc_ev, safe_error_code="PROVIDER_CASCADE_FAILED")
        recorder.record_event(
            mai03_obs.TraceStage.PROVIDER_CASCADE_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="PROVIDER_CASCADE_FAILED",
        )
        # Fail closed: leave prior annotations; do not invent cascade.

    # MAI-23: prompt registry annotation (no model invocation).
    pr_ev = recorder.begin_stage(
        mai03_obs.TraceStage.PROMPT_REGISTRY_STARTED,
        component="conversation.prompt_registry",
    )
    try:
        from ..oip.modules.conversation.application.prompt_registry_service import (
            assert_prompt_registry_authority,
            attach_prompt_registry_to_request,
        )

        updated = attach_prompt_registry_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.prompt_registry_bundle
        assert_prompt_registry_authority(bundle)
        canonical = updated
        recorder.complete_stage(
            pr_ev,
            version_map={
                "prompt_registry": "mai-23.0.2-slice2",
            },
            safe_attributes={
                "prompt_registry_status": (
                    bundle.analysis_status.value if bundle else None
                ),
                "prompt_template_id": (
                    bundle.selected_prompt_template_id if bundle else None
                ),
                "structured_output_schema_ref": (
                    bundle.structured_output_schema_ref if bundle else None
                ),
                "model_invocations": (
                    bundle.model_invocations if bundle else 0
                ),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.PROMPT_REGISTRY_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(
                bundle.analysis_status.value if bundle else "FAILED"
            ),
            safe_attributes={
                "prompt_template_id": (
                    bundle.selected_prompt_template_id if bundle else None
                ),
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(pr_ev, safe_error_code="PROMPT_REGISTRY_FAILED")
        recorder.record_event(
            mai03_obs.TraceStage.PROMPT_REGISTRY_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="PROMPT_REGISTRY_FAILED",
        )
        # Fail closed: leave prior annotations; do not invent prompt refs.

    # MAI-24: knowledge source / document governance annotation (no retrieval).
    ksg_ev = recorder.begin_stage(
        mai03_obs.TraceStage.KNOWLEDGE_SOURCE_GOVERNANCE_STARTED,
        component="conversation.knowledge_source_governance",
    )
    try:
        from ..oip.modules.conversation.application.knowledge_source_governance_service import (
            assert_knowledge_source_governance_authority,
            attach_knowledge_source_governance_to_request,
        )

        updated = attach_knowledge_source_governance_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.knowledge_source_governance_bundle
        assert_knowledge_source_governance_authority(bundle)
        canonical = updated
        recorder.complete_stage(
            ksg_ev,
            version_map={
                "knowledge_source_governance": "mai-24.0.2-slice2",
            },
            safe_attributes={
                "knowledge_source_governance_status": (
                    bundle.analysis_status.value if bundle else None
                ),
                "domain_key": bundle.domain_key if bundle else None,
                "allowed_collection_count": (
                    len(bundle.allowed_retrieval_collections) if bundle else 0
                ),
                "allow_evaluation_corpus": (
                    bundle.allow_evaluation_corpus if bundle else False
                ),
                "documents_retrieved": (
                    bundle.documents_retrieved if bundle else 0
                ),
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.KNOWLEDGE_SOURCE_GOVERNANCE_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(
                bundle.analysis_status.value if bundle else "FAILED"
            ),
            safe_attributes={
                "domain_key": bundle.domain_key if bundle else None,
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(
            ksg_ev, safe_error_code="KNOWLEDGE_SOURCE_GOVERNANCE_FAILED"
        )
        recorder.record_event(
            mai03_obs.TraceStage.KNOWLEDGE_SOURCE_GOVERNANCE_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="KNOWLEDGE_SOURCE_GOVERNANCE_FAILED",
        )
        # Fail closed: leave prior annotations; do not invent governance.

    # MAI-25: structural segmentation annotation (no OCR).
    ss_ev = recorder.begin_stage(
        mai03_obs.TraceStage.STRUCTURAL_SEGMENTATION_STARTED,
        component="conversation.structural_segmentation",
    )
    try:
        from ..oip.modules.conversation.application.structural_segmentation_service import (
            assert_structural_segmentation_authority,
            attach_structural_segmentation_to_request,
        )

        updated = attach_structural_segmentation_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.structural_segmentation_bundle
        assert_structural_segmentation_authority(bundle)
        canonical = updated
        recorder.complete_stage(
            ss_ev,
            version_map={
                "structural_segmentation": "mai-25.0.1-slice1",
            },
            safe_attributes={
                "structural_segmentation_status": (
                    bundle.analysis_status.value if bundle else None
                ),
                "segment_count": bundle.segment_count if bundle else 0,
                "ocr_recommended": bundle.ocr_recommended if bundle else False,
                "ocr_invocations": bundle.ocr_invocations if bundle else 0,
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.STRUCTURAL_SEGMENTATION_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(
                bundle.analysis_status.value if bundle else "FAILED"
            ),
            safe_attributes={
                "segment_count": bundle.segment_count if bundle else 0,
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(
            ss_ev, safe_error_code="STRUCTURAL_SEGMENTATION_FAILED"
        )
        recorder.record_event(
            mai03_obs.TraceStage.STRUCTURAL_SEGMENTATION_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="STRUCTURAL_SEGMENTATION_FAILED",
        )
        # Fail closed: leave prior annotations; do not invent segments.

    # MAI-25 slice 2: extraction / OCR plan from segments (never invokes OCR).
    eop_ev = recorder.begin_stage(
        mai03_obs.TraceStage.EXTRACTION_OCR_PLAN_STARTED,
        component="conversation.extraction_ocr_plan",
    )
    try:
        from ..oip.modules.conversation.application.extraction_ocr_plan_service import (
            assert_extraction_ocr_plan_authority,
            attach_extraction_ocr_plan_to_request,
        )

        updated = attach_extraction_ocr_plan_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.extraction_ocr_plan_bundle
        assert_extraction_ocr_plan_authority(bundle)
        canonical = updated
        recorder.complete_stage(
            eop_ev,
            version_map={
                "extraction_ocr_plan": "mai-25.0.2-slice2",
            },
            safe_attributes={
                "extraction_ocr_plan_status": (
                    bundle.analysis_status.value if bundle else None
                ),
                "step_count": bundle.step_count if bundle else 0,
                "ocr_candidate": bundle.ocr_candidate if bundle else False,
                "ocr_execution_authorized": False,
                "ocr_invocations": bundle.ocr_invocations if bundle else 0,
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.EXTRACTION_OCR_PLAN_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(
                bundle.analysis_status.value if bundle else "FAILED"
            ),
            safe_attributes={
                "step_count": bundle.step_count if bundle else 0,
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(
            eop_ev, safe_error_code="EXTRACTION_OCR_PLAN_FAILED"
        )
        recorder.record_event(
            mai03_obs.TraceStage.EXTRACTION_OCR_PLAN_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="EXTRACTION_OCR_PLAN_FAILED",
        )
        # Fail closed: leave prior annotations; do not invent OCR plans.

    # MAI-26: temporal / amendment / cross-reference cues (never proven/applied).
    tcr_ev = recorder.begin_stage(
        mai03_obs.TraceStage.TEMPORAL_CROSS_REF_STARTED,
        component="conversation.temporal_cross_ref",
    )
    try:
        from ..oip.modules.conversation.application.temporal_cross_ref_service import (
            assert_temporal_cross_ref_authority,
            attach_temporal_cross_ref_to_request,
        )

        updated = attach_temporal_cross_ref_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.temporal_cross_ref_bundle
        assert_temporal_cross_ref_authority(bundle)
        canonical = updated
        recorder.complete_stage(
            tcr_ev,
            version_map={
                "temporal_cross_ref": "mai-26.0.2-slice2",
            },
            safe_attributes={
                "temporal_cross_ref_status": (
                    bundle.analysis_status.value if bundle else None
                ),
                "temporal_cue_count": (
                    len(bundle.temporal_cues) if bundle else 0
                ),
                "cross_ref_cue_count": (
                    len(bundle.cross_ref_cues) if bundle else 0
                ),
                "legal_effective_dates_proven": False,
                "amendment_applied": False,
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.TEMPORAL_CROSS_REF_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(
                bundle.analysis_status.value if bundle else "FAILED"
            ),
            safe_attributes={
                "as_of_candidate": bundle.as_of_candidate if bundle else None,
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(
            tcr_ev, safe_error_code="TEMPORAL_CROSS_REF_FAILED"
        )
        recorder.record_event(
            mai03_obs.TraceStage.TEMPORAL_CROSS_REF_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="TEMPORAL_CROSS_REF_FAILED",
        )
        # Fail closed: leave prior annotations; do not invent temporal claims.

    # MAI-27: lexical index readiness (SQLITE FTS; never Ollama/vector/query).
    lex_ev = recorder.begin_stage(
        mai03_obs.TraceStage.LEXICAL_INDEX_STARTED,
        component="conversation.lexical_index",
    )
    try:
        from ..oip.modules.conversation.application.lexical_index_service import (
            assert_lexical_index_authority,
            attach_lexical_index_to_request,
        )

        updated = attach_lexical_index_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.lexical_index_bundle
        assert_lexical_index_authority(bundle)
        canonical = updated
        recorder.complete_stage(
            lex_ev,
            version_map={
                "lexical_index": "mai-27.0.2-slice2",
            },
            safe_attributes={
                "lexical_index_status": (
                    bundle.analysis_status.value if bundle else None
                ),
                "index_present": bundle.index_present if bundle else False,
                "fts_ready": bundle.fts_ready if bundle else False,
                "ollama_required": False,
                "vector_backend_required": False,
                "citations_verified": False,
                "query_executions": bundle.query_executions if bundle else 0,
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.LEXICAL_INDEX_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(
                bundle.analysis_status.value if bundle else "FAILED"
            ),
            safe_attributes={
                "active_lexical_db": (
                    bundle.active_lexical_db if bundle else None
                ),
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(
            lex_ev, safe_error_code="LEXICAL_INDEX_FAILED"
        )
        recorder.record_event(
            mai03_obs.TraceStage.LEXICAL_INDEX_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="LEXICAL_INDEX_FAILED",
        )
        # Fail closed: leave prior annotations; do not invent index readiness.

    # MAI-28: vector / semantic index readiness (never embed/query; not prod).
    vec_ev = recorder.begin_stage(
        mai03_obs.TraceStage.VECTOR_INDEX_STARTED,
        component="conversation.vector_index",
    )
    try:
        from ..oip.modules.conversation.application.vector_index_service import (
            assert_vector_index_authority,
            attach_vector_index_to_request,
        )

        updated = attach_vector_index_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.vector_index_bundle
        assert_vector_index_authority(bundle)
        canonical = updated
        recorder.complete_stage(
            vec_ev,
            version_map={
                "vector_index": "mai-28.0.2-slice2",
            },
            safe_attributes={
                "vector_index_status": (
                    bundle.analysis_status.value if bundle else None
                ),
                "index_present": bundle.index_present if bundle else False,
                "chroma_present": bundle.chroma_present if bundle else False,
                "ollama_required": True,
                "production_eligible": False,
                "citations_verified": False,
                "embed_invocations": (
                    bundle.embed_invocations if bundle else 0
                ),
                "query_executions": bundle.query_executions if bundle else 0,
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.VECTOR_INDEX_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(
                bundle.analysis_status.value if bundle else "FAILED"
            ),
            safe_attributes={
                "vector_backend": (
                    bundle.vector_backend if bundle else None
                ),
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(
            vec_ev, safe_error_code="VECTOR_INDEX_FAILED"
        )
        recorder.record_event(
            mai03_obs.TraceStage.VECTOR_INDEX_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="VECTOR_INDEX_FAILED",
        )
        # Fail closed: leave prior annotations; do not invent vector readiness.

    # MAI-29: hybrid fusion / evidence policy (never execute RRF / rerank).
    hyb_ev = recorder.begin_stage(
        mai03_obs.TraceStage.HYBRID_FUSION_STARTED,
        component="conversation.hybrid_fusion",
    )
    try:
        from ..oip.modules.conversation.application.hybrid_fusion_service import (
            assert_hybrid_fusion_authority,
            attach_hybrid_fusion_to_request,
        )

        updated = attach_hybrid_fusion_to_request(canonical)
        if updated.raw_text != canonical.raw_text:
            raise RuntimeError("RAW_TEXT_MUTATION")
        bundle = updated.hybrid_fusion_bundle
        assert_hybrid_fusion_authority(bundle)
        canonical = updated
        recorder.complete_stage(
            hyb_ev,
            version_map={
                "hybrid_fusion": "mai-29.0.2-slice2",
            },
            safe_attributes={
                "hybrid_fusion_status": (
                    bundle.analysis_status.value if bundle else None
                ),
                "fusion_mode": (
                    bundle.fusion_mode.value if bundle else None
                ),
                "fusion_executed": False,
                "rerank_authorized": False,
                "evidence_assembled": False,
                "hybrid_production_eligible": False,
                "claims_verified": False,
                "citations_verified": False,
            },
        )
        recorder.record_event(
            mai03_obs.TraceStage.HYBRID_FUSION_COMPLETED,
            mai03_obs.TraceStatus.COMPLETED,
            outcome_code=(
                bundle.analysis_status.value if bundle else "FAILED"
            ),
            safe_attributes={
                "rrf_k": bundle.rrf_k if bundle else None,
            },
        )
    except Exception:  # noqa: BLE001
        recorder.fail_stage(
            hyb_ev, safe_error_code="HYBRID_FUSION_FAILED"
        )
        recorder.record_event(
            mai03_obs.TraceStage.HYBRID_FUSION_FAILED,
            mai03_obs.TraceStatus.FAILED,
            safe_error_code="HYBRID_FUSION_FAILED",
        )
        # Fail closed: leave prior annotations; do not invent fusion claims.

    return canonical


async def build_intelligence_request(
    *,
    message: str,
    session_id: str,
    context: dict[str, Any] | None = None,
    module: str = "orbix",
    language: str | None = None,
    orbix_mode: str | None = None,
    schema_version: str | None = None,
    headers: Any = None,
) -> IntelligenceRequestDto:
    """Compatibility entry: canonical authority → named DTO adapter."""
    from ..oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
    from ..oip.infrastructure.observability import mai03 as mai03_obs

    canonical = await build_canonical_ai_request(
        message=message,
        session_id=session_id,
        context=context,
        language=language,
        orbix_mode=orbix_mode,
        schema_version=schema_version,
        headers=headers,
    )
    annotations: dict[str, Any] = {}
    if context:
        annotations["client_context"] = dict(context)
    ctx = mai03_obs.get_trace_context()
    if ctx is not None:
        annotations["trace_reference"] = ctx.trace_reference
        annotations["message_char_length"] = len(canonical.raw_text)
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(
        canonical,
        module=module,
        non_authoritative_annotations=annotations,
    )
    # Attach safe trace fields into metadata for egress (not authority).
    meta = dict(dto.metadata or {})
    if ctx is not None:
        meta["trace_reference"] = ctx.trace_reference
        meta["correlation_id"] = ctx.correlation_id
        meta["conversation_id"] = canonical.conversation_id
    return dto.model_copy(update={"metadata": meta})


async def submit_chat(
    message: str,
    session_id: str,
    *,
    context: dict[str, Any] | None = None,
    orbix_mode: str | None = None,
    schema_version: str | None = None,
    headers: Any = None,
) -> IntelligenceResponseDto:
    from ..oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
    from ..oip.infrastructure.observability import mai03 as mai03_obs

    if _OIP_CHAT_DEBUG:
        log_event(
            "oip.chat_ingress.incoming",
            message_char_length=len(message or ""),
            session_ref=bool(session_id),
        )
    container = await get_container()
    canonical = await build_canonical_ai_request(
        message=message,
        session_id=session_id,
        context=context,
        orbix_mode=orbix_mode,
        schema_version=schema_version,
        headers=headers,
    )
    ctx = mai03_obs.get_trace_context()
    annotations: dict[str, Any] = {"client_context": dict(context or {})}
    if ctx is not None:
        annotations["trace_reference"] = ctx.trace_reference
        annotations["message_char_length"] = len(canonical.raw_text)
    request = CanonicalOipRequestAdapter().to_intelligence_dto(
        canonical,
        module="orbix",
        non_authoritative_annotations=annotations,
    )
    meta = dict(request.metadata or {})
    if ctx is not None:
        meta["trace_reference"] = ctx.trace_reference
        meta["correlation_id"] = ctx.correlation_id
        meta["conversation_id"] = canonical.conversation_id
    request = request.model_copy(update={"metadata": meta})
    recorder = mai03_obs.get_trace_recorder()
    orch_ev = recorder.start_stage(mai03_obs.TraceStage.ORCHESTRATOR_STARTED, component="orchestrator")
    try:
        if _OIP_CHAT_DEBUG:
            log_event(
                "oip.chat_ingress.payload",
                request_id=request.request_id,
                module=request.module,
                orbix_mode=(request.metadata or {}).get("orbix_mode"),
                contract_authority=(request.metadata or {}).get("contract_authority"),
                message_char_length=len(canonical.raw_text),
            )
        result = await container.kernel.submit(request)
        recorder.complete_stage(orch_ev, outcome_code="ORCH_OK")
        return result
    except Exception:
        recorder.fail_stage(orch_ev, safe_error_code="ORCHESTRATOR_FAILED")
        raise


def derive_orbix_response_type(
    *,
    error: dict[str, Any] | None,
    card: dict[str, Any] | None,
    report_spec: dict[str, Any] | None,
    action: str,
) -> str:
    """Stable discriminator for frontend structured rendering."""
    if error and isinstance(error, dict):
        err_type = error.get("type")
        if err_type == "mode_restriction":
            return "mode_restriction"
        if err_type == "clarification_required":
            return "clarification_required"
        if err_type == "permission_denied":
            return "permission_denied"
        if err_type == "validation_error":
            return "validation_error"
    if report_spec:
        if isinstance(report_spec, dict) and report_spec.get("updated"):
            return "report_updated"
        return "report_result"
    if card or action == "confirm":
        return "confirmation_required"
    return "normal_answer"


def derive_orbix_status(response_type: str) -> str:
    mapping = {
        "mode_restriction": "requires_input",
        "clarification_required": "requires_input",
        "confirmation_required": "requires_confirmation",
        "transaction_preview": "requires_confirmation",
        "report_result": "success",
        "report_updated": "success",
        "permission_denied": "failed",
        "validation_error": "failed",
        "provider_offline": "failed",
        "posting_completed": "success",
        "posting_failed": "failed",
        "posting_progress": "processing",
        "general_error": "failed",
    }
    return mapping.get(response_type, "success")


def map_response_to_orbix(
    response: IntelligenceResponseDto,
) -> tuple[str, dict[str, Any] | None, dict[str, Any] | None]:
    text = ""
    card: dict[str, Any] | None = None
    for action in response.actions:
        if action.action_type == ActionType.ANSWER:
            text = str(action.body.get("text") or text)
        elif action.action_type == ActionType.CLARIFICATION:
            text = str(action.body.get("text") or text)
        elif action.action_type == ActionType.JOURNAL_ENTRY and action.requires_confirmation:
            card = dict(action.body)
    metadata = dict(response.metadata or {})
    route_info: dict[str, Any] | None = None
    if metadata.get("intent") or metadata.get("routing_policy") or metadata.get("operation_class"):
        route_info = {
            "intent": metadata.get("intent", "general_qa"),
            "confidence": float(metadata.get("confidence", 0.85)),
            "method": "oip",
            "reasoning": metadata.get("reasoning"),
            "operation_class": metadata.get("operation_class"),
            "orbix_mode": metadata.get("orbix_mode"),
        }
    if not text and metadata.get("text"):
        text = str(metadata["text"])
    for key in ("operation_class", "orbix_mode", "draft_id", "error", "report_spec", "capabilities"):
        if key in metadata and route_info is not None:
            route_info[key] = metadata[key]
    return text.strip(), card, route_info


def sse_json(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, default=str)}\n\n"


def _np_kb_stream_metadata(user_message: str | None) -> dict[str, Any]:
    """Optional language-KB hints for the complete event; never grants posting authority."""
    if not user_message or not str(user_message).strip():
        return {"enabled": False, "reason": "no_user_message"}
    try:
        from ..nlu.np_kb_adapter import enrich_nlu_context

        payload = enrich_nlu_context(str(user_message), top_k=3)
        if not isinstance(payload, dict):
            return {"enabled": False, "reason": "invalid_payload"}
        payload["execution_allowed"] = False
        return payload
    except Exception as exc:  # soft-fail — KB must never break chat
        return {"enabled": False, "reason": f"adapter_error: {exc}"}


def _safe_error_complete(
    *,
    request_id: str,
    conversation_id: str,
    safe_message: str,
    error_code: str,
) -> dict[str, Any]:
    """Validated-safe terminal payload when COMPLETE envelope validation fails."""
    from ..oip.contracts.adapters.legacy_orbix import LegacyOrbixSseEventAdapter, trusted_scope_from_mai01

    seed = {
        "type": "complete",
        "schema_version": "1.0",
        "request_id": request_id,
        "message": safe_message,
        "response_type": "general_error",
        "status": "failed",
        "error": {"code": error_code, "message": safe_message, "type": "validation_error"},
        "card": None,
        "draft_id": None,
        "report_spec": None,
        "execution_allowed": False,
    }
    scope = trusted_scope_from_mai01(
        principal_id="unauthenticated",
        tenant_id="unscoped",
        company_id=None,
        authentication_method="none",
    )
    event, legacy = LegacyOrbixSseEventAdapter().complete_dict_to_envelope(
        seed,
        conversation_id=conversation_id,
        trusted=scope,
        sequence_number=0,
    )
    legacy["mai02_validated"] = True
    legacy["canonical_response_type"] = event.payload.response.response_type.value  # type: ignore[attr-defined]
    legacy["type"] = "complete"
    return legacy


async def stream_orbix_kernel_events(
    response: IntelligenceResponseDto,
    *,
    chunk_words: int = 3,
    user_message: str | None = None,
) -> AsyncIterator[str]:
    from ..oip.infrastructure.observability import mai03 as mai03_obs

    recorder = mai03_obs.get_trace_recorder()
    ctx = mai03_obs.get_trace_context()
    trace_ref = (response.metadata or {}).get("trace_reference") or (ctx.trace_reference if ctx else None)

    sse_start = recorder.start_stage(mai03_obs.TraceStage.SSE_STREAM_STARTED, component="sse") if ctx else None
    yield sse_json(
        {
            "type": "request_accepted",
            "schema_version": "1.0",
            "trace_reference": trace_ref,
            "request_id": response.request_id,
            "correlation_id": (response.metadata or {}).get("correlation_id"),
        }
    )
    yield sse_json({"type": "thinking_start"})
    text, card, route_info = map_response_to_orbix(response)
    if route_info:
        route_info = dict(route_info)
        route_info.pop("reasoning", None)
        yield sse_json({"type": "route", "route": route_info})
    if text:
        words = text.split()
        for index in range(0, len(words), chunk_words):
            token = " ".join(words[index : index + chunk_words])
            if index + chunk_words < len(words):
                token += " "
            yield sse_json({"type": "token", "content": token})
    yield sse_json({"type": "thinking_done"})
    meta = dict(response.metadata or {})
    error = meta.get("error") or (route_info or {}).get("error")
    draft_id = meta.get("draft_id") or (route_info or {}).get("draft_id")
    report_spec = meta.get("report_spec") or (route_info or {}).get("report_spec")
    action = "confirm" if card else "chat"
    response_type = derive_orbix_response_type(
        error=error if isinstance(error, dict) else None,
        card=card,
        report_spec=report_spec if isinstance(report_spec, dict) else None,
        action=action,
    )
    np_kb = meta.get("np_kb") if isinstance(meta.get("np_kb"), dict) else None
    if np_kb is None:
        np_kb = _np_kb_stream_metadata(user_message)
    if isinstance(np_kb, dict):
        np_kb = dict(np_kb)
        np_kb["execution_allowed"] = False
    complete_payload: dict[str, Any] = {
        "type": "complete",
        "schema_version": "1.0",
        "request_id": response.request_id,
        "message": text,
        "card": card,
        "route": route_info,
        "action": action,
        "provider": response.provider or meta.get("provider_id"),
        "model": response.model,
        "provider_runtime": True,
        "orbix_mode": meta.get("orbix_mode") or (route_info or {}).get("orbix_mode"),
        "operation_class": meta.get("operation_class") or (route_info or {}).get("operation_class"),
        "error": error,
        "draft_id": draft_id,
        "report_spec": report_spec,
        "response_type": response_type,
        "status": derive_orbix_status(response_type),
        "trace_reference": trace_ref,
        "metadata": {"np_kb": np_kb, "trace_reference": trace_ref},
    }
    complete_payload.pop("execution_allowed", None)
    if isinstance(complete_payload.get("error"), dict):
        complete_payload["error"] = dict(complete_payload["error"])
        complete_payload["error"].pop("execution_allowed", None)
        complete_payload["error"].pop("stack_trace", None)
        complete_payload["error"].pop("traceback", None)

    conversation_id = str(meta.get("conversation_id") or response.request_id)
    val_ev = None
    if ctx is not None:
        val_ev = recorder.start_stage(
            mai03_obs.TraceStage.RESPONSE_VALIDATION_STARTED, component="contracts"
        )
    try:
        from ..oip.contracts.adapters.legacy_orbix import LegacyOrbixSseEventAdapter, trusted_scope_from_mai01
        from ..oip.contracts.request import TrustedScopeV1

        scope_raw = meta.get("egress_scope_ref")
        if isinstance(scope_raw, dict):
            trusted_scope = TrustedScopeV1(
                principal_id=str(scope_raw.get("principal_id") or "unauthenticated"),
                tenant_id=str(scope_raw.get("tenant_id") or "unscoped"),
                company_id=scope_raw.get("company_id"),
                authentication_method=str(scope_raw.get("authentication_method") or "none"),
                policy_version=str(scope_raw.get("policy_version") or "mai-01.1.0"),
            )
        else:
            trusted_scope = trusted_scope_from_mai01(
                principal_id=str(meta.get("policy_principal") or "unauthenticated"),
                tenant_id="unscoped",
                company_id=None,
                authentication_method=str(meta.get("auth_method") or "none"),
            )
        event, legacy_out = LegacyOrbixSseEventAdapter().complete_dict_to_envelope(
            complete_payload,
            conversation_id=conversation_id,
            trusted=trusted_scope,
            sequence_number=0,
        )
        # Ensure canonical envelope carries trace_reference
        try:
            env = event.payload.response  # type: ignore[attr-defined]
            if env.trace_reference is None and trace_ref:
                from ..oip.contracts.response import AIResponseEnvelopeV1

                event = event.model_copy(
                    update={
                        "payload": event.payload.model_copy(  # type: ignore[attr-defined]
                            update={
                                "response": env.model_copy(update={"trace_reference": str(trace_ref)})
                            }
                        )
                    }
                )
        except Exception:  # noqa: BLE001
            pass
        for key in (
            "canonical_schema_version",
            "schema_version",
            "response_type",
            "status",
            "message",
            "request_id",
        ):
            if key in legacy_out and legacy_out[key] is not None:
                complete_payload[key] = legacy_out[key]
        complete_payload["mai02_validated"] = True
        complete_payload["canonical_response_type"] = event.payload.response.response_type.value  # type: ignore[attr-defined]
        complete_payload["trace_reference"] = trace_ref
        if val_ev is not None:
            recorder.complete_stage(val_ev, outcome_code="RESPONSE_VALID")
            recorder.record_event(
                mai03_obs.TraceStage.RESPONSE_VALIDATION_COMPLETED,
                mai03_obs.TraceStatus.COMPLETED,
                outcome_code="RESPONSE_VALID",
                safe_attributes={"response_type": response_type},
            )
        yield sse_json(complete_payload)
        if sse_start is not None:
            recorder.complete_stage(sse_start, outcome_code="SSE_OK")
        if ctx is not None:
            recorder.record_event(
                mai03_obs.TraceStage.REQUEST_COMPLETED,
                mai03_obs.TraceStatus.COMPLETED,
                outcome_code="OK",
                safe_attributes={"response_type": response_type},
            )
    except Exception as exc:  # noqa: BLE001 — never emit unvalidated COMPLETE
        if val_ev is not None:
            recorder.fail_stage(val_ev, safe_error_code="INVALID_RESPONSE_PAYLOAD")
        log_event(
            "oip.chat_ingress.mai02_complete_reject",
            request_id=response.request_id,
            safe_error_code="INVALID_RESPONSE_PAYLOAD",
        )
        safe = _safe_error_complete(
            request_id=response.request_id,
            conversation_id=conversation_id,
            safe_message="The response could not be validated safely. No accounting action was taken.",
            error_code="INVALID_RESPONSE_PAYLOAD",
        )
        safe["trace_reference"] = trace_ref
        yield sse_json(
            {
                "type": "error",
                "schema_version": "1.0",
                "error_code": "INVALID_RESPONSE_PAYLOAD",
                "message": safe.get("message"),
                "trace_reference": trace_ref,
            }
        )
        yield sse_json(safe)
        if sse_start is not None:
            recorder.fail_stage(sse_start, safe_error_code="SSE_VALIDATION_FAILED")
        if ctx is not None:
            recorder.record_event(
                mai03_obs.TraceStage.REQUEST_FAILED,
                mai03_obs.TraceStatus.FAILED,
                safe_error_code="INVALID_RESPONSE_PAYLOAD",
            )
    finally:
        mai03_obs.clear_trace_context()
        from ..oip.infrastructure.observability.correlation import clear_trace

        clear_trace()


async def provider_runtime_status_payload() -> dict[str, Any]:
    settings = get_oip_settings()
    enabled = provider_runtime_active(settings)
    llm_ready = provider_runtime_llm_ready(settings)
    payload: dict[str, Any] = {
        "status": "online",
        "mode": "oip" if enabled else "legacy",
        "stack": "oip kernel → orchestrator → provider runtime",
        "provider_runtime_enabled": enabled,
        "provider_runtime_ready": llm_ready,
        "llm_ready": llm_ready,
        "khata_llm": llm_ready,
        "force_stub_providers": settings.force_stub_providers,
        "configured_provider": settings.default_provider or None,
        "default_model": settings.default_model or None,
        "streaming": True,
        "conversation_memory": True,
        "orbix_kernel_stream": enabled,
    }
    if not enabled:
        payload["llm_ready"] = False
        payload["khata_llm"] = False
        return payload

    try:
        container = await get_container()
        kernel_health = await container.kernel.health()
        payload["kernel"] = kernel_health
        provider_id = settings.default_provider or None
        if provider_id:
            health = await container.query_bus.dispatch(
                GetProviderHealthQuery(
                    tenant_id=TenantId(settings.default_service_tenant_id),
                    provider_id=provider_id,
                )
            )
            payload["provider_health"] = health
            provider_record = health.get("health") or {}
            payload["resolved_provider"] = provider_id
            payload["provider_availability"] = provider_record.get("availability")
            payload["provider_circuit_state"] = provider_record.get("circuit_state")
    except Exception as exc:  # noqa: BLE001
        payload["provider_runtime_ready"] = False
        payload["llm_ready"] = False
        payload["khata_llm"] = False
        payload["provider_runtime_error"] = str(exc)
    return payload
