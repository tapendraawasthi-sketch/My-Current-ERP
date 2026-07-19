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
