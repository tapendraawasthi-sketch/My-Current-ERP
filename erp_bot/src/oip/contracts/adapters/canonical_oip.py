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
        # MAI-11: pass response language/register policy into orchestrator metadata
        # (annotation only — never authority for posting).
        frame = canonical.language_frame
        if frame is not None and frame.response_register_bundle is not None:
            try:
                from ...modules.language_runtime.response_register.application.prompt_directive import (
                    bundle_to_metadata,
                )

                metadata["response_register"] = bundle_to_metadata(
                    frame.response_register_bundle
                )
            except Exception:  # noqa: BLE001
                bundle = frame.response_register_bundle
                metadata["response_register"] = {
                    "response_language": bundle.response_language.value,
                    "linguistic_register": bundle.linguistic_register.value,
                    "mirror_user_language": bool(bundle.mirror_user_language),
                    "runtime_version": bundle.runtime_version,
                    "applied_response_rewrite": False,
                }
        # MAI-13: object-reference candidates + store resolutions
        # (annotation only — never draft merge).
        oref = canonical.object_reference_bundle
        if oref is not None:
            metadata["object_reference"] = {
                "analysis_status": oref.analysis_status.value,
                "runtime_version": oref.runtime_version,
                "candidate_count": oref.candidate_count,
                "resolution_count": oref.resolution_count,
                "found_count": oref.found_count,
                "missing_count": oref.missing_count,
                "not_pending_count": oref.not_pending_count,
                "silent_applications": oref.silent_applications,
                "draft_mutations": oref.draft_mutations,
                "candidates": [
                    {
                        "candidate_id": c.candidate_id,
                        "kind": c.kind.value,
                        "object_id": c.object_id,
                        "source": c.source,
                        "applied": c.applied,
                    }
                    for c in oref.candidates
                ],
                "resolutions": [
                    {
                        "candidate_id": r.candidate_id,
                        "kind": r.kind.value,
                        "object_id": r.object_id,
                        "resolution_status": r.resolution_status.value,
                        "store_name": r.store_name,
                        "draft_kind": r.draft_kind,
                        "draft_status": r.draft_status,
                        "conversation_status": r.conversation_status,
                        "applied": r.applied,
                    }
                    for r in oref.resolutions
                ],
            }
        # MAI-14: turn-relation decision (annotation only — never merge authority).
        if canonical.turn_relation is not None:
            try:
                from ...modules.conversation.application.turn_relation_service import (
                    turn_relation_to_metadata,
                )

                metadata["turn_relation"] = turn_relation_to_metadata(
                    canonical.turn_relation
                )
            except Exception:  # noqa: BLE001
                tr = canonical.turn_relation
                metadata["turn_relation"] = {
                    "relation": tr.relation.value,
                    "status": tr.status.value,
                    "classifier_version": tr.classifier_version,
                    "is_execution_authority": False,
                }
        # MAI-15: reference/coreference/correction candidates (never applied).
        if canonical.reference_coreference_bundle is not None:
            try:
                from ...modules.conversation.application.reference_coreference_service import (
                    reference_coreference_to_metadata,
                )

                metadata["reference_coreference"] = reference_coreference_to_metadata(
                    canonical.reference_coreference_bundle
                )
            except Exception:  # noqa: BLE001
                rc = canonical.reference_coreference_bundle
                metadata["reference_coreference"] = {
                    "analysis_status": rc.analysis_status.value,
                    "runtime_version": rc.runtime_version,
                    "mention_count": rc.mention_count,
                    "correction_count": rc.correction_count,
                    "silent_applications": 0,
                    "draft_mutations": 0,
                }
        # MAI-16: context assembly + memory policy (annotation only).
        if canonical.context_assembly_bundle is not None:
            try:
                from ...modules.conversation.application.context_assembly_service import (
                    context_assembly_to_metadata,
                )

                metadata["context_assembly"] = context_assembly_to_metadata(
                    canonical.context_assembly_bundle
                )
            except Exception:  # noqa: BLE001
                ca = canonical.context_assembly_bundle
                metadata["context_assembly"] = {
                    "analysis_status": ca.analysis_status.value,
                    "runtime_version": ca.runtime_version,
                    "included_count": ca.included_count,
                    "memory_writes": 0,
                    "is_execution_authority": False,
                }
        # MAI-17: hierarchical router + OOD (annotation only).
        if canonical.router_decision_bundle is not None:
            try:
                from ...modules.conversation.application.hierarchical_router_service import (
                    router_decision_to_metadata,
                )

                metadata["router_decision"] = router_decision_to_metadata(
                    canonical.router_decision_bundle
                )
            except Exception:  # noqa: BLE001
                rd = canonical.router_decision_bundle
                metadata["router_decision"] = {
                    "analysis_status": rd.analysis_status.value,
                    "runtime_version": rd.runtime_version,
                    "domain": rd.domain.value,
                    "intent_family": rd.intent_family.value,
                    "is_execution_authority": False,
                }
        # MAI-18: event specification registry (annotation only).
        if canonical.event_spec_registry_bundle is not None:
            try:
                from ...modules.conversation.application.event_spec_registry_service import (
                    event_spec_registry_to_metadata,
                )

                metadata["event_spec_registry"] = event_spec_registry_to_metadata(
                    canonical.event_spec_registry_bundle
                )
            except Exception:  # noqa: BLE001
                es = canonical.event_spec_registry_bundle
                metadata["event_spec_registry"] = {
                    "analysis_status": es.analysis_status.value,
                    "runtime_version": es.runtime_version,
                    "selected_spec_id": es.selected_spec_id,
                    "is_execution_authority": False,
                }
        # MAI-18 slice 2: EventFrame skeleton (missing fields; no values).
        if canonical.event_frame is not None:
            try:
                from ...modules.conversation.application.event_spec_registry_service import (
                    event_frame_to_metadata,
                )

                metadata["event_frame"] = event_frame_to_metadata(
                    canonical.event_frame
                )
            except Exception:  # noqa: BLE001
                ef = canonical.event_frame
                metadata["event_frame"] = {
                    "frame_id": ef.frame_id,
                    "event_type": ef.event_type,
                    "status": ef.status.value,
                    "missing_required_fields": list(ef.missing_required_fields),
                    "authorizes_posting": False,
                }
        # MAI-20: information-gain clarification plan (annotation only).
        if canonical.clarification_plan_bundle is not None:
            try:
                from ...modules.conversation.application.clarification_plan_service import (
                    clarification_plan_to_metadata,
                )

                metadata["clarification_plan"] = clarification_plan_to_metadata(
                    canonical.clarification_plan_bundle
                )
            except Exception:  # noqa: BLE001
                cp = canonical.clarification_plan_bundle
                metadata["clarification_plan"] = {
                    "analysis_status": cp.analysis_status.value,
                    "runtime_version": cp.runtime_version,
                    "primary_field": cp.primary_field,
                    "is_execution_authority": False,
                }
        # MAI-21: typed plan annotation (no tool execution).
        if canonical.typed_plan_bundle is not None:
            try:
                from ...modules.conversation.application.typed_plan_service import (
                    typed_plan_to_metadata,
                )

                metadata["typed_plan"] = typed_plan_to_metadata(
                    canonical.typed_plan_bundle
                )
            except Exception:  # noqa: BLE001
                tp = canonical.typed_plan_bundle
                metadata["typed_plan"] = {
                    "analysis_status": tp.analysis_status.value,
                    "runtime_version": tp.runtime_version,
                    "is_execution_authority": False,
                }
        # MAI-22: provider cascade annotation (no model invocation).
        if canonical.provider_cascade_bundle is not None:
            try:
                from ...modules.conversation.application.provider_cascade_service import (
                    provider_cascade_to_metadata,
                )

                metadata["provider_cascade"] = provider_cascade_to_metadata(
                    canonical.provider_cascade_bundle
                )
            except Exception:  # noqa: BLE001
                pc = canonical.provider_cascade_bundle
                metadata["provider_cascade"] = {
                    "analysis_status": pc.analysis_status.value,
                    "runtime_version": pc.runtime_version,
                    "selected_provider_id": pc.selected_provider_id,
                    "is_execution_authority": False,
                }
        # MAI-23: prompt registry annotation (no model invocation).
        if canonical.prompt_registry_bundle is not None:
            try:
                from ...modules.conversation.application.prompt_registry_service import (
                    prompt_registry_to_metadata,
                )

                metadata["prompt_registry"] = prompt_registry_to_metadata(
                    canonical.prompt_registry_bundle
                )
            except Exception:  # noqa: BLE001
                pr = canonical.prompt_registry_bundle
                metadata["prompt_registry"] = {
                    "analysis_status": pr.analysis_status.value,
                    "runtime_version": pr.runtime_version,
                    "selected_prompt_template_id": pr.selected_prompt_template_id,
                    "is_execution_authority": False,
                }
        # MAI-24: knowledge source governance (no retrieval).
        if canonical.knowledge_source_governance_bundle is not None:
            try:
                from ...modules.conversation.application.knowledge_source_governance_service import (
                    knowledge_source_governance_to_metadata,
                )

                metadata["knowledge_source_governance"] = (
                    knowledge_source_governance_to_metadata(
                        canonical.knowledge_source_governance_bundle
                    )
                )
            except Exception:  # noqa: BLE001
                ksg = canonical.knowledge_source_governance_bundle
                metadata["knowledge_source_governance"] = {
                    "analysis_status": ksg.analysis_status.value,
                    "runtime_version": ksg.runtime_version,
                    "domain_key": ksg.domain_key,
                    "allow_evaluation_corpus": False,
                    "is_execution_authority": False,
                }
        # MAI-25: structural segmentation (no OCR).
        if canonical.structural_segmentation_bundle is not None:
            try:
                from ...modules.conversation.application.structural_segmentation_service import (
                    structural_segmentation_to_metadata,
                )

                metadata["structural_segmentation"] = (
                    structural_segmentation_to_metadata(
                        canonical.structural_segmentation_bundle
                    )
                )
            except Exception:  # noqa: BLE001
                ss = canonical.structural_segmentation_bundle
                metadata["structural_segmentation"] = {
                    "analysis_status": ss.analysis_status.value,
                    "runtime_version": ss.runtime_version,
                    "segment_count": ss.segment_count,
                    "ocr_invocations": 0,
                    "is_execution_authority": False,
                }
        # MAI-25 slice 2: extraction / OCR plan (never executes).
        if canonical.extraction_ocr_plan_bundle is not None:
            try:
                from ...modules.conversation.application.extraction_ocr_plan_service import (
                    extraction_ocr_plan_to_metadata,
                )

                metadata["extraction_ocr_plan"] = extraction_ocr_plan_to_metadata(
                    canonical.extraction_ocr_plan_bundle
                )
            except Exception:  # noqa: BLE001
                eop = canonical.extraction_ocr_plan_bundle
                metadata["extraction_ocr_plan"] = {
                    "analysis_status": eop.analysis_status.value,
                    "runtime_version": eop.runtime_version,
                    "step_count": eop.step_count,
                    "ocr_execution_authorized": False,
                    "is_execution_authority": False,
                }
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
