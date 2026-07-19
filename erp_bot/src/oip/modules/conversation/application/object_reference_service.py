"""MAI-13 object-reference candidates + read-only store resolution.

Never imports khata draft writers. Never merges.
"""

from __future__ import annotations

from typing import Any

from ....contracts.object_reference import (
    ObjectReferenceBundleV1,
    ObjectReferenceCandidateV1,
    ObjectReferenceKind,
    ObjectReferenceResolutionStatus,
    ObjectReferenceStatus,
)
from ....contracts.request import CanonicalAIRequestV1
from .object_reference_resolution_service import resolve_candidates

RUNTIME_VERSION = "mai-13.0.2-slice2"

# UI context keys that may carry object ids (string values only).
_UI_OBJECT_KEYS = (
    "draft_id",
    "active_draft_id",
    "party_id",
    "voucher_id",
    "invoice_id",
    "report_id",
)

_FOUND_STATUSES = frozenset(
    {
        ObjectReferenceResolutionStatus.FOUND,
        ObjectReferenceResolutionStatus.CONVERSATION_FOUND,
    }
)
_MISSING_STATUSES = frozenset(
    {
        ObjectReferenceResolutionStatus.MISSING,
        ObjectReferenceResolutionStatus.CONVERSATION_MISSING,
    }
)


def build_object_reference_candidates(
    *,
    conversation_id: str,
    active_draft_reference: str | None = None,
    active_ui_context: dict[str, Any] | None = None,
) -> tuple[ObjectReferenceCandidateV1, ...]:
    candidates: list[ObjectReferenceCandidateV1] = []
    cid = 0

    if conversation_id and conversation_id.strip():
        candidates.append(
            ObjectReferenceCandidateV1(
                candidate_id=f"oref-{cid:04d}",
                kind=ObjectReferenceKind.CONVERSATION,
                object_id=conversation_id.strip(),
                source="REQUEST.conversation_id",
                reason_codes=("CONVERSATION_ID",),
                applied=False,
            )
        )
        cid += 1

    draft = (active_draft_reference or "").strip()
    if draft:
        candidates.append(
            ObjectReferenceCandidateV1(
                candidate_id=f"oref-{cid:04d}",
                kind=ObjectReferenceKind.ACTIVE_DRAFT,
                object_id=draft,
                source="REQUEST.active_draft_reference",
                reason_codes=("ACTIVE_DRAFT_REFERENCE",),
                applied=False,
            )
        )
        cid += 1

    ui = dict(active_ui_context or {})
    for key in _UI_OBJECT_KEYS:
        val = ui.get(key)
        if not isinstance(val, str) or not val.strip():
            continue
        if draft and val.strip() == draft and key in {"draft_id", "active_draft_id"}:
            continue
        candidates.append(
            ObjectReferenceCandidateV1(
                candidate_id=f"oref-{cid:04d}",
                kind=ObjectReferenceKind.UI_CONTEXT_OBJECT,
                object_id=val.strip(),
                source=f"REQUEST.active_ui_context.{key}",
                reason_codes=("UI_CONTEXT_OBJECT", key.upper()),
                applied=False,
            )
        )
        cid += 1

    return tuple(candidates)


def build_object_reference_bundle(
    *,
    conversation_id: str,
    active_draft_reference: str | None = None,
    active_ui_context: dict[str, Any] | None = None,
    tenant_id: str = "",
    database_url: str | None = None,
    resolve_stores: bool = True,
) -> ObjectReferenceBundleV1:
    candidates = build_object_reference_candidates(
        conversation_id=conversation_id,
        active_draft_reference=active_draft_reference,
        active_ui_context=active_ui_context,
    )
    resolutions = ()
    if resolve_stores:
        resolutions = resolve_candidates(
            candidates,
            tenant_id=tenant_id or "",
            database_url=database_url,
        )

    found_count = sum(1 for r in resolutions if r.resolution_status in _FOUND_STATUSES)
    missing_count = sum(
        1 for r in resolutions if r.resolution_status in _MISSING_STATUSES
    )
    not_pending_count = sum(
        1
        for r in resolutions
        if r.resolution_status == ObjectReferenceResolutionStatus.NOT_PENDING
    )

    return ObjectReferenceBundleV1(
        analysis_status=ObjectReferenceStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        source_authority="REQUEST",
        candidates=candidates,
        resolutions=resolutions,
        candidate_count=len(candidates),
        resolution_count=len(resolutions),
        found_count=found_count,
        missing_count=missing_count,
        not_pending_count=not_pending_count,
        silent_applications=0,
        draft_mutations=0,
    )


def attach_object_references_to_request(
    request: CanonicalAIRequestV1,
    *,
    database_url: str | None = None,
) -> CanonicalAIRequestV1:
    tenant_id = ""
    try:
        tenant_id = str(request.trusted_scope.tenant_id or "")
    except Exception:  # noqa: BLE001
        tenant_id = ""
    bundle = build_object_reference_bundle(
        conversation_id=request.conversation_id,
        active_draft_reference=request.active_draft_reference,
        active_ui_context=dict(request.active_ui_context or {}),
        tenant_id=tenant_id,
        database_url=database_url,
        resolve_stores=True,
    )
    return request.model_copy(update={"object_reference_bundle": bundle})
