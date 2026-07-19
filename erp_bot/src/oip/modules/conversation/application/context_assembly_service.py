"""MAI-16 slice 1 — context assembly candidates + memory policy (annotation only).

Never writes memory. Never merges drafts. Never injects LLM prompts.
Builds request-local slices from TrustedScope + prior MAI bundles only.
"""

from __future__ import annotations

from typing import Any

from ....contracts.context_assembly import (
    ContextAssemblyBundleV1,
    ContextAssemblyStatus,
    ContextFreshness,
    ContextSliceCandidateV1,
    ContextSliceKind,
    MemoryExpiryClass,
    MemoryPolicyV1,
)
from ....contracts.dialogue import TurnRelationKind
from ....contracts.object_reference import (
    ObjectReferenceKind,
    ObjectReferenceResolutionStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-16.0.1-slice1"

_DEFAULT_POLICY = MemoryPolicyV1(
    read_allowed=True,
    write_allowed=False,
    expiry_class=MemoryExpiryClass.CONVERSATION,
    cross_company_allowed=False,
    erp_facts_source="ERP_PREFERRED",
    max_tokens=1200,
    max_slices=8,
)


def _est_tokens(text: str) -> int:
    # Rough code-point heuristic; annotation only.
    n = max(len(text or ""), 1)
    return max(8, n // 4)


def build_context_assembly_bundle(
    request: CanonicalAIRequestV1,
    *,
    policy: MemoryPolicyV1 | None = None,
) -> ContextAssemblyBundleV1:
    mem = policy or _DEFAULT_POLICY
    candidates: list[ContextSliceCandidateV1] = []
    sid = 0
    warnings: list[str] = []

    scope = request.trusted_scope
    company_id = scope.company_id
    tenant_id = scope.tenant_id

    sid += 1
    candidates.append(
        ContextSliceCandidateV1(
            slice_id=f"ctx-{sid:04d}",
            kind=ContextSliceKind.TRUSTED_SCOPE,
            priority=100,
            tokens_est=_est_tokens(f"{tenant_id}|{company_id or ''}|{scope.principal_id}"),
            source_label="REQUEST.trusted_scope",
            freshness=ContextFreshness.HOT,
            include_reason_codes=("TRUSTED_SCOPE",),
            surface_summary=f"tenant={tenant_id} company={company_id or '-'}",
            applied=False,
        )
    )

    sid += 1
    candidates.append(
        ContextSliceCandidateV1(
            slice_id=f"ctx-{sid:04d}",
            kind=ContextSliceKind.CONVERSATION_ID,
            priority=90,
            tokens_est=_est_tokens(request.conversation_id),
            source_label="REQUEST.conversation_id",
            freshness=ContextFreshness.HOT,
            include_reason_codes=("CONVERSATION_ID",),
            surface_summary=request.conversation_id,
            applied=False,
        )
    )

    active_task = False
    unresolved = False
    oref = request.object_reference_bundle
    if oref is not None:
        found_draft = None
        for r in oref.resolutions:
            if (
                r.kind == ObjectReferenceKind.ACTIVE_DRAFT
                and r.resolution_status == ObjectReferenceResolutionStatus.FOUND
            ):
                found_draft = r
                break
        if found_draft is not None:
            active_task = True
            if (found_draft.draft_status or "").lower() == "awaiting_clarification":
                unresolved = True
            sid += 1
            candidates.append(
                ContextSliceCandidateV1(
                    slice_id=f"ctx-{sid:04d}",
                    kind=ContextSliceKind.ACTIVE_DRAFT,
                    priority=85,
                    tokens_est=40,
                    source_label="REQUEST.object_reference_bundle",
                    freshness=ContextFreshness.HOT,
                    include_reason_codes=("ACTIVE_DRAFT_FOUND",),
                    surface_summary=(
                        f"draft={found_draft.object_id} "
                        f"kind={found_draft.draft_kind or '-'} "
                        f"status={found_draft.draft_status or '-'}"
                    ),
                    applied=False,
                )
            )
            if unresolved:
                sid += 1
                candidates.append(
                    ContextSliceCandidateV1(
                        slice_id=f"ctx-{sid:04d}",
                        kind=ContextSliceKind.UNRESOLVED_CLARIFICATION,
                        priority=84,
                        tokens_est=24,
                        source_label="REQUEST.object_reference_bundle",
                        freshness=ContextFreshness.HOT,
                        include_reason_codes=("AWAITING_CLARIFICATION",),
                        surface_summary="unresolved clarification on active draft",
                        applied=False,
                    )
                )
    else:
        warnings.append("OBJECT_REFERENCE_ABSENT")

    tr = request.turn_relation
    if tr is not None:
        if tr.relation in {
            TurnRelationKind.ANSWER_CLARIFICATION,
            TurnRelationKind.CORRECT_ACTIVE_DRAFT,
            TurnRelationKind.CONTINUE_ACTIVE_DRAFT,
            TurnRelationKind.CONTINUE_EXPLICIT_DRAFT,
        }:
            active_task = True
        if tr.relation == TurnRelationKind.ANSWER_CLARIFICATION:
            unresolved = True
        sid += 1
        candidates.append(
            ContextSliceCandidateV1(
                slice_id=f"ctx-{sid:04d}",
                kind=ContextSliceKind.TURN_RELATION,
                priority=80,
                tokens_est=20,
                source_label="REQUEST.turn_relation",
                freshness=ContextFreshness.HOT,
                include_reason_codes=("TURN_RELATION", tr.relation.value),
                surface_summary=f"relation={tr.relation.value} status={tr.status.value}",
                applied=False,
            )
        )
    else:
        warnings.append("TURN_RELATION_ABSENT")

    rc = request.reference_coreference_bundle
    if rc is not None and (rc.mention_count or rc.correction_count):
        sid += 1
        candidates.append(
            ContextSliceCandidateV1(
                slice_id=f"ctx-{sid:04d}",
                kind=ContextSliceKind.REFERENCE_COREFERENCE,
                priority=70,
                tokens_est=24 + 8 * (rc.mention_count + rc.correction_count),
                source_label="REQUEST.reference_coreference_bundle",
                freshness=ContextFreshness.WARM,
                include_reason_codes=("REFERENCE_COREFERENCE",),
                surface_summary=(
                    f"mentions={rc.mention_count} corrections={rc.correction_count} "
                    f"ambiguous={rc.ambiguous_count}"
                ),
                applied=False,
            )
        )
    elif rc is None:
        warnings.append("REFERENCE_COREFERENCE_ABSENT")

    ui = dict(request.active_ui_context or {})
    ui_keys = sorted(k for k, v in ui.items() if isinstance(v, str) and v.strip())
    if ui_keys:
        sid += 1
        summary = ",".join(f"{k}={ui[k]}" for k in ui_keys[:4])
        candidates.append(
            ContextSliceCandidateV1(
                slice_id=f"ctx-{sid:04d}",
                kind=ContextSliceKind.ACTIVE_UI_CONTEXT,
                priority=60,
                tokens_est=_est_tokens(summary),
                source_label="REQUEST.active_ui_context",
                freshness=ContextFreshness.WARM,
                include_reason_codes=("ACTIVE_UI_CONTEXT",),
                surface_summary=summary,
                applied=False,
            )
        )

    # Priority rank then truncate by token/slice budget (annotation of include/exclude).
    ranked = sorted(candidates, key=lambda c: (-c.priority, c.slice_id))
    included: list[ContextSliceCandidateV1] = []
    excluded: list[ContextSliceCandidateV1] = []
    budget = mem.max_tokens
    used = 0
    for c in ranked:
        if len(included) >= mem.max_slices or used + c.tokens_est > budget:
            excluded.append(
                c.model_copy(
                    update={
                        "included": False,
                        "exclude_reason_codes": ("BUDGET_OR_SLICE_CAP",),
                    }
                )
            )
            continue
        included.append(
            c.model_copy(
                update={
                    "included": True,
                    "include_reason_codes": c.include_reason_codes or ("INCLUDED",),
                }
            )
        )
        used += c.tokens_est

    slices = tuple(included + excluded)
    status = ContextAssemblyStatus.COMPLETE
    if warnings and not included:
        status = ContextAssemblyStatus.PARTIAL

    return ContextAssemblyBundleV1(
        analysis_status=status,
        runtime_version=RUNTIME_VERSION,
        source_authority="REQUEST",
        memory_policy=mem,
        slices=slices,
        token_budget=budget,
        tokens_estimated=used,
        included_count=len(included),
        excluded_count=len(excluded),
        active_task_present=active_task,
        unresolved_clarification_present=unresolved,
        company_id_echo=company_id,
        tenant_id_echo=tenant_id,
        warnings=tuple(warnings),
        silent_applications=0,
        draft_mutations=0,
        memory_writes=0,
    )


def attach_context_assembly_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_context_assembly_bundle(request)
    return request.model_copy(update={"context_assembly_bundle": bundle})


def context_assembly_to_metadata(bundle: ContextAssemblyBundleV1 | None) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "token_budget": bundle.token_budget,
        "tokens_estimated": bundle.tokens_estimated,
        "included_count": bundle.included_count,
        "excluded_count": bundle.excluded_count,
        "active_task_present": bundle.active_task_present,
        "unresolved_clarification_present": bundle.unresolved_clarification_present,
        "company_id_echo": bundle.company_id_echo,
        "tenant_id_echo": bundle.tenant_id_echo,
        "memory_policy": {
            "read_allowed": bundle.memory_policy.read_allowed,
            "write_allowed": bundle.memory_policy.write_allowed,
            "cross_company_allowed": bundle.memory_policy.cross_company_allowed,
            "erp_facts_source": bundle.memory_policy.erp_facts_source,
            "max_tokens": bundle.memory_policy.max_tokens,
            "max_slices": bundle.memory_policy.max_slices,
        },
        "silent_applications": bundle.silent_applications,
        "draft_mutations": bundle.draft_mutations,
        "memory_writes": bundle.memory_writes,
        "is_execution_authority": False,
        "slices": [
            {
                "slice_id": s.slice_id,
                "kind": s.kind.value,
                "included": s.included,
                "priority": s.priority,
                "tokens_est": s.tokens_est,
                "freshness": s.freshness.value,
                "surface_summary": s.surface_summary,
                "applied": False,
            }
            for s in bundle.slices
        ],
    }
