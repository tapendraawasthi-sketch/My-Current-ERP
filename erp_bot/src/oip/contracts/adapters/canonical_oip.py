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
        # MAI-26: temporal / cross-ref cues (never proven/applied).
        if canonical.temporal_cross_ref_bundle is not None:
            try:
                from ...modules.conversation.application.temporal_cross_ref_service import (
                    temporal_cross_ref_to_metadata,
                )

                metadata["temporal_cross_ref"] = temporal_cross_ref_to_metadata(
                    canonical.temporal_cross_ref_bundle
                )
            except Exception:  # noqa: BLE001
                tcr = canonical.temporal_cross_ref_bundle
                metadata["temporal_cross_ref"] = {
                    "analysis_status": tcr.analysis_status.value,
                    "runtime_version": tcr.runtime_version,
                    "legal_effective_dates_proven": False,
                    "amendment_applied": False,
                    "is_execution_authority": False,
                }
        # MAI-27: lexical index readiness (no retrieval / no Ollama claim).
        if canonical.lexical_index_bundle is not None:
            try:
                from ...modules.conversation.application.lexical_index_service import (
                    lexical_index_to_metadata,
                )

                metadata["lexical_index"] = lexical_index_to_metadata(
                    canonical.lexical_index_bundle
                )
            except Exception:  # noqa: BLE001
                lex = canonical.lexical_index_bundle
                metadata["lexical_index"] = {
                    "analysis_status": lex.analysis_status.value,
                    "runtime_version": lex.runtime_version,
                    "ollama_required": False,
                    "vector_backend_required": False,
                    "citations_verified": False,
                    "is_execution_authority": False,
                }
        # MAI-28: vector index readiness (Chroma+Ollama; not production-eligible).
        if canonical.vector_index_bundle is not None:
            try:
                from ...modules.conversation.application.vector_index_service import (
                    vector_index_to_metadata,
                )

                metadata["vector_index"] = vector_index_to_metadata(
                    canonical.vector_index_bundle
                )
            except Exception:  # noqa: BLE001
                vec = canonical.vector_index_bundle
                metadata["vector_index"] = {
                    "analysis_status": vec.analysis_status.value,
                    "runtime_version": vec.runtime_version,
                    "ollama_required": True,
                    "production_eligible": False,
                    "citations_verified": False,
                    "is_execution_authority": False,
                }
        # MAI-29: hybrid fusion / evidence policy (never execute RRF/rerank).
        if canonical.hybrid_fusion_bundle is not None:
            try:
                from ...modules.conversation.application.hybrid_fusion_service import (
                    hybrid_fusion_to_metadata,
                )

                metadata["hybrid_fusion"] = hybrid_fusion_to_metadata(
                    canonical.hybrid_fusion_bundle
                )
            except Exception:  # noqa: BLE001
                hyb = canonical.hybrid_fusion_bundle
                metadata["hybrid_fusion"] = {
                    "analysis_status": hyb.analysis_status.value,
                    "runtime_version": hyb.runtime_version,
                    "fusion_mode": hyb.fusion_mode.value,
                    "fusion_executed": False,
                    "rerank_authorized": False,
                    "hybrid_production_eligible": False,
                    "is_execution_authority": False,
                }
        # MAI-30: claim-citation / grounded-answer policy (never verified).
        if canonical.claim_citation_bundle is not None:
            try:
                from ...modules.conversation.application.claim_citation_service import (
                    claim_citation_to_metadata,
                )

                metadata["claim_citation"] = claim_citation_to_metadata(
                    canonical.claim_citation_bundle
                )
            except Exception:  # noqa: BLE001
                cc = canonical.claim_citation_bundle
                metadata["claim_citation"] = {
                    "analysis_status": cc.analysis_status.value,
                    "runtime_version": cc.runtime_version,
                    "claims_verified": False,
                    "citations_verified": False,
                    "verifier_executed": False,
                    "legal_proof_claimed": False,
                    "is_execution_authority": False,
                }
        # MAI-31: EventFrame → domain port mapping + payload-candidate consume.
        if canonical.domain_port_mapping_bundle is not None:
            try:
                from ...modules.conversation.application.domain_port_consume_service import (
                    enrich_mapping_metadata_with_consume,
                )
                from ...modules.conversation.application.domain_port_mapping_service import (
                    domain_port_mapping_to_metadata,
                )

                base_meta = domain_port_mapping_to_metadata(
                    canonical.domain_port_mapping_bundle
                )
                metadata["domain_port_mapping"] = enrich_mapping_metadata_with_consume(
                    base_meta, canonical, allow_port_invoke=False
                )
            except Exception:  # noqa: BLE001
                dpm = canonical.domain_port_mapping_bundle
                metadata["domain_port_mapping"] = {
                    "analysis_status": dpm.analysis_status.value,
                    "runtime_version": dpm.runtime_version,
                    "support_status": dpm.support_status.value,
                    "port_executed": False,
                    "draft_mutations": 0,
                    "dexie_invoked": False,
                    "journal_calculated": False,
                    "mode_aware_invoked": False,
                    "port_consume_mode": "UNCHANGED",
                    "port_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-32: durable versioned draft readiness + aggregate-candidate consume.
        if canonical.durable_versioned_draft_bundle is not None:
            try:
                from ...modules.conversation.application.durable_versioned_draft_consume_service import (
                    enrich_dvd_metadata_with_consume,
                )
                from ...modules.conversation.application.durable_versioned_draft_service import (
                    durable_versioned_draft_to_metadata,
                )

                base_meta = durable_versioned_draft_to_metadata(
                    canonical.durable_versioned_draft_bundle
                )
                metadata["durable_versioned_draft"] = enrich_dvd_metadata_with_consume(
                    base_meta, canonical
                )
            except Exception:  # noqa: BLE001
                dvd = canonical.durable_versioned_draft_bundle
                metadata["durable_versioned_draft"] = {
                    "analysis_status": dvd.analysis_status.value,
                    "runtime_version": dvd.runtime_version,
                    "durability_status": dvd.durability_status.value,
                    "production_store_authority": False,
                    "save_invoked": False,
                    "draft_mutations": 0,
                    "draft_aggregate_ready": False,
                    "durable_consume_mode": "UNCHANGED",
                    "durable_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-33: deterministic preview / edit-loop + candidate consume.
        if canonical.deterministic_preview_edit_loop_bundle is not None:
            try:
                from ...modules.conversation.application.deterministic_preview_edit_loop_consume_service import (
                    enrich_pel_metadata_with_consume,
                )
                from ...modules.conversation.application.deterministic_preview_edit_loop_service import (
                    deterministic_preview_edit_loop_to_metadata,
                )

                base_meta = deterministic_preview_edit_loop_to_metadata(
                    canonical.deterministic_preview_edit_loop_bundle
                )
                metadata["deterministic_preview_edit_loop"] = (
                    enrich_pel_metadata_with_consume(base_meta, canonical)
                )
            except Exception:  # noqa: BLE001
                pel = canonical.deterministic_preview_edit_loop_bundle
                metadata["deterministic_preview_edit_loop"] = {
                    "analysis_status": pel.analysis_status.value,
                    "runtime_version": pel.runtime_version,
                    "preview_readiness": pel.preview_readiness.value,
                    "preview_generated": False,
                    "confirmation_card_generated": False,
                    "journal_calculated": False,
                    "gap_p2_002_status": "OPEN",
                    "preview_consume_mode": "UNCHANGED",
                    "preview_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-34: explicit confirm / OEC dispatch + candidate consume (never posts).
        if canonical.explicit_confirmation_oec_dispatch_bundle is not None:
            try:
                from ...modules.conversation.application.explicit_confirmation_oec_dispatch_consume_service import (
                    enrich_eco_metadata_with_consume,
                )
                from ...modules.conversation.application.explicit_confirmation_oec_dispatch_service import (
                    explicit_confirmation_oec_dispatch_to_metadata,
                )

                base_meta = explicit_confirmation_oec_dispatch_to_metadata(
                    canonical.explicit_confirmation_oec_dispatch_bundle
                )
                metadata["explicit_confirmation_oec_dispatch"] = (
                    enrich_eco_metadata_with_consume(base_meta, canonical)
                )
            except Exception:  # noqa: BLE001
                eco = canonical.explicit_confirmation_oec_dispatch_bundle
                metadata["explicit_confirmation_oec_dispatch"] = {
                    "analysis_status": eco.analysis_status.value,
                    "runtime_version": eco.runtime_version,
                    "confirm_readiness": eco.confirm_readiness.value,
                    "nl_assent_posts": False,
                    "confirm_token_minted": False,
                    "oec_dispatch_invoked": False,
                    "gap_p0_001_status": "OPEN",
                    "confirm_oec_consume_mode": "UNCHANGED",
                    "confirm_oec_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-35: offline / sync / conflict / reversal + candidate consume.
        if canonical.offline_sync_conflict_reversal_bundle is not None:
            try:
                from ...modules.conversation.application.offline_sync_conflict_reversal_consume_service import (
                    enrich_osc_metadata_with_consume,
                )
                from ...modules.conversation.application.offline_sync_conflict_reversal_service import (
                    offline_sync_conflict_reversal_to_metadata,
                )

                base_meta = offline_sync_conflict_reversal_to_metadata(
                    canonical.offline_sync_conflict_reversal_bundle
                )
                metadata["offline_sync_conflict_reversal"] = (
                    enrich_osc_metadata_with_consume(base_meta, canonical)
                )
            except Exception:  # noqa: BLE001
                osc = canonical.offline_sync_conflict_reversal_bundle
                metadata["offline_sync_conflict_reversal"] = {
                    "analysis_status": osc.analysis_status.value,
                    "runtime_version": osc.runtime_version,
                    "sync_policy_readiness": osc.sync_policy_readiness.value,
                    "sync_workers_started": False,
                    "queue_enqueued": False,
                    "conflict_resolved": False,
                    "reversal_dispatched": False,
                    "gap_p1_002_status": "OPEN",
                    "gap_p0_001_status": "OPEN",
                    "offline_sync_consume_mode": "UNCHANGED",
                    "offline_sync_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-36: legal question framer / research + candidate consume.
        if canonical.legal_question_research_bundle is not None:
            try:
                from ...modules.conversation.application.legal_question_research_consume_service import (
                    enrich_lqr_metadata_with_consume,
                )
                from ...modules.conversation.application.legal_question_research_service import (
                    legal_question_research_to_metadata,
                )

                base_meta = legal_question_research_to_metadata(
                    canonical.legal_question_research_bundle
                )
                metadata["legal_question_research"] = (
                    enrich_lqr_metadata_with_consume(base_meta, canonical)
                )
            except Exception:  # noqa: BLE001
                lqr = canonical.legal_question_research_bundle
                metadata["legal_question_research"] = {
                    "analysis_status": lqr.analysis_status.value,
                    "runtime_version": lqr.runtime_version,
                    "research_mode_readiness": lqr.research_mode_readiness.value,
                    "mutation_tools_allowed": False,
                    "current_law_definitive": False,
                    "legal_effective_dates_proven": False,
                    "legal_proof_claimed": False,
                    "gap_p2_008_status": "OPEN",
                    "legal_research_consume_mode": "UNCHANGED",
                    "legal_research_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-37: core Nepal tax knowledge pilot + candidate consume.
        if canonical.core_nepal_tax_knowledge_pilot_bundle is not None:
            try:
                from ...modules.conversation.application.core_nepal_tax_knowledge_pilot_consume_service import (
                    enrich_ctk_metadata_with_consume,
                )
                from ...modules.conversation.application.core_nepal_tax_knowledge_pilot_service import (
                    core_nepal_tax_knowledge_pilot_to_metadata,
                )

                base_meta = core_nepal_tax_knowledge_pilot_to_metadata(
                    canonical.core_nepal_tax_knowledge_pilot_bundle
                )
                metadata["core_nepal_tax_knowledge_pilot"] = (
                    enrich_ctk_metadata_with_consume(base_meta, canonical)
                )
            except Exception:  # noqa: BLE001
                ctk = canonical.core_nepal_tax_knowledge_pilot_bundle
                metadata["core_nepal_tax_knowledge_pilot"] = {
                    "analysis_status": ctk.analysis_status.value,
                    "runtime_version": ctk.runtime_version,
                    "tax_pilot_readiness": ctk.tax_pilot_readiness.value,
                    "tax_calculator_invoked": False,
                    "current_law_definitive": False,
                    "legal_effective_dates_proven": False,
                    "specialist_signoff_status": "NOT_SIGNED",
                    "gap_p2_008_status": "OPEN",
                    "tax_pilot_consume_mode": "UNCHANGED",
                    "tax_pilot_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-38: tax calculator / rule integration + candidate consume.
        if canonical.tax_calculator_rule_integration_bundle is not None:
            try:
                from ...modules.conversation.application.tax_calculator_rule_integration_consume_service import (
                    enrich_tcri_metadata_with_consume,
                )
                from ...modules.conversation.application.tax_calculator_rule_integration_service import (
                    tax_calculator_rule_integration_to_metadata,
                )

                base_meta = tax_calculator_rule_integration_to_metadata(
                    canonical.tax_calculator_rule_integration_bundle
                )
                metadata["tax_calculator_rule_integration"] = (
                    enrich_tcri_metadata_with_consume(base_meta, canonical)
                )
            except Exception:  # noqa: BLE001
                tcri = canonical.tax_calculator_rule_integration_bundle
                metadata["tax_calculator_rule_integration"] = {
                    "analysis_status": tcri.analysis_status.value,
                    "runtime_version": tcri.runtime_version,
                    "calculator_readiness": tcri.calculator_readiness.value,
                    "rule_integration_status": "POLICY_ONLY",
                    "tax_calculator_invoked": False,
                    "calculation_executed": False,
                    "amount_computed": False,
                    "calculator_production_eligible": False,
                    "gap_p2_008_status": "OPEN",
                    "calculator_consume_mode": "UNCHANGED",
                    "calculator_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-39: NFRS/NAS pilot + candidate consume.
        if canonical.nfrs_nas_policy_disclosure_pilot_bundle is not None:
            try:
                from ...modules.conversation.application.nfrs_nas_policy_disclosure_pilot_consume_service import (
                    enrich_nfrs_metadata_with_consume,
                )
                from ...modules.conversation.application.nfrs_nas_policy_disclosure_pilot_service import (
                    nfrs_nas_policy_disclosure_pilot_to_metadata,
                )

                base_meta = nfrs_nas_policy_disclosure_pilot_to_metadata(
                    canonical.nfrs_nas_policy_disclosure_pilot_bundle
                )
                metadata["nfrs_nas_policy_disclosure_pilot"] = (
                    enrich_nfrs_metadata_with_consume(base_meta, canonical)
                )
            except Exception:  # noqa: BLE001
                nfrs = canonical.nfrs_nas_policy_disclosure_pilot_bundle
                metadata["nfrs_nas_policy_disclosure_pilot"] = {
                    "analysis_status": nfrs.analysis_status.value,
                    "runtime_version": nfrs.runtime_version,
                    "nfrs_nas_readiness": nfrs.nfrs_nas_readiness.value,
                    "mapping_status": "CANDIDATE_MAPPINGS_ONLY",
                    "disclosure_status": "NOT_FILED",
                    "standards_authority_claimed": False,
                    "mapping_executed": False,
                    "disclosure_filed": False,
                    "filing_ready": False,
                    "gap_p2_008_status": "OPEN",
                    "nfrs_nas_consume_mode": "UNCHANGED",
                    "nfrs_nas_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-40: financial close / adjustment + candidate consume.
        if canonical.financial_close_adjustment_assistance_bundle is not None:
            try:
                from ...modules.conversation.application.financial_close_adjustment_assistance_consume_service import (
                    enrich_fcaa_metadata_with_consume,
                )
                from ...modules.conversation.application.financial_close_adjustment_assistance_service import (
                    financial_close_adjustment_assistance_to_metadata,
                )

                base_meta = financial_close_adjustment_assistance_to_metadata(
                    canonical.financial_close_adjustment_assistance_bundle
                )
                metadata["financial_close_adjustment_assistance"] = (
                    enrich_fcaa_metadata_with_consume(base_meta, canonical)
                )
            except Exception:  # noqa: BLE001
                fcaa = canonical.financial_close_adjustment_assistance_bundle
                metadata["financial_close_adjustment_assistance"] = {
                    "analysis_status": fcaa.analysis_status.value,
                    "runtime_version": fcaa.runtime_version,
                    "close_assist_readiness": fcaa.close_assist_readiness.value,
                    "adjustment_status": "CANDIDATE_ASSISTANCE_ONLY",
                    "close_posted": False,
                    "adjustments_posted": False,
                    "books_locked": False,
                    "period_closed": False,
                    "gap_p2_008_status": "OPEN",
                    "close_assist_consume_mode": "UNCHANGED",
                    "close_assist_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-41: broader Nepal business-law domain release + candidate consume.
        if (
            canonical.broader_nepal_business_law_domain_release_bundle
            is not None
        ):
            try:
                from ...modules.conversation.application.broader_nepal_business_law_domain_release_consume_service import (
                    enrich_bnbl_metadata_with_consume,
                )
                from ...modules.conversation.application.broader_nepal_business_law_domain_release_service import (
                    broader_nepal_business_law_domain_release_to_metadata,
                )

                base_meta = (
                    broader_nepal_business_law_domain_release_to_metadata(
                        canonical.broader_nepal_business_law_domain_release_bundle
                    )
                )
                metadata["broader_nepal_business_law_domain_release"] = (
                    enrich_bnbl_metadata_with_consume(base_meta, canonical)
                )
            except Exception:  # noqa: BLE001
                bnbl = (
                    canonical.broader_nepal_business_law_domain_release_bundle
                )
                metadata["broader_nepal_business_law_domain_release"] = {
                    "analysis_status": bnbl.analysis_status.value,
                    "runtime_version": bnbl.runtime_version,
                    "domain_release_readiness": (
                        bnbl.domain_release_readiness.value
                    ),
                    "release_status": "NOT_RELEASED",
                    "domain_authority_claimed": False,
                    "domain_released": False,
                    "production_domain_eligible": False,
                    "gap_p2_008_status": "OPEN",
                    "domain_release_consume_mode": "UNCHANGED",
                    "domain_release_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-42: judicial/decision intelligence + candidate consume.
        if canonical.judicial_decision_intelligence_bundle is not None:
            try:
                from ...modules.conversation.application.judicial_decision_intelligence_consume_service import (
                    enrich_jdi_metadata_with_consume,
                )
                from ...modules.conversation.application.judicial_decision_intelligence_service import (
                    judicial_decision_intelligence_to_metadata,
                )

                base_meta = judicial_decision_intelligence_to_metadata(
                    canonical.judicial_decision_intelligence_bundle
                )
                metadata["judicial_decision_intelligence"] = (
                    enrich_jdi_metadata_with_consume(base_meta, canonical)
                )
            except Exception:  # noqa: BLE001
                jdi = canonical.judicial_decision_intelligence_bundle
                metadata["judicial_decision_intelligence"] = {
                    "analysis_status": jdi.analysis_status.value,
                    "runtime_version": jdi.runtime_version,
                    "judicial_decision_readiness": (
                        jdi.judicial_decision_readiness.value
                    ),
                    "release_status": "NOT_RELEASED",
                    "judicial_authority_claimed": False,
                    "headnote_as_binding_rule": False,
                    "subsequent_treatment_definitive": False,
                    "case_retrieved": False,
                    "gap_p2_008_status": "OPEN",
                    "judicial_decision_consume_mode": "UNCHANGED",
                    "judicial_decision_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-43: continuous change intelligence + candidate consume.
        if canonical.continuous_change_intelligence_bundle is not None:
            try:
                from ...modules.conversation.application.continuous_change_intelligence_consume_service import (
                    enrich_cci_metadata_with_consume,
                )
                from ...modules.conversation.application.continuous_change_intelligence_service import (
                    continuous_change_intelligence_to_metadata,
                )

                base_meta = continuous_change_intelligence_to_metadata(
                    canonical.continuous_change_intelligence_bundle
                )
                metadata["continuous_change_intelligence"] = (
                    enrich_cci_metadata_with_consume(base_meta, canonical)
                )
            except Exception:  # noqa: BLE001
                cci = canonical.continuous_change_intelligence_bundle
                metadata["continuous_change_intelligence"] = {
                    "analysis_status": cci.analysis_status.value,
                    "runtime_version": cci.runtime_version,
                    "continuous_change_readiness": (
                        cci.continuous_change_readiness.value
                    ),
                    "release_status": "NOT_RELEASED",
                    "continuous_change_authority_claimed": False,
                    "unreviewed_as_production_truth": False,
                    "cache_invalidated": False,
                    "change_applied": False,
                    "legal_effective_dates_proven": False,
                    "gap_p2_008_status": "OPEN",
                    "continuous_change_consume_mode": "UNCHANGED",
                    "continuous_change_consume_ready": False,
                    "is_execution_authority": False,
                }
        # MAI-44: security/tenant red-team policy (never pen-test pass claim).
        if canonical.security_tenant_red_team_bundle is not None:
            try:
                from ...modules.conversation.application.security_tenant_red_team_service import (
                    security_tenant_red_team_to_metadata,
                )

                metadata["security_tenant_red_team"] = (
                    security_tenant_red_team_to_metadata(
                        canonical.security_tenant_red_team_bundle
                    )
                )
            except Exception:  # noqa: BLE001
                strt = canonical.security_tenant_red_team_bundle
                metadata["security_tenant_red_team"] = {
                    "analysis_status": strt.analysis_status.value,
                    "runtime_version": strt.runtime_version,
                    "security_red_team_readiness": (
                        strt.security_red_team_readiness.value
                    ),
                    "release_status": "NOT_RELEASED",
                    "isolation_proven": False,
                    "zero_critical_findings_claimed": False,
                    "pen_review_passed": False,
                    "production_security_approved": False,
                    "gap_p0_001_status": "OPEN",
                    "gap_p2_008_status": "OPEN",
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
