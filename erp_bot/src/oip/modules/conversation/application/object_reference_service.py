"""MAI-13 candidate-only object-reference snapshot.

Read request fields only. Never imports khata draft writers. Never merges.
"""

from __future__ import annotations

from typing import Any

from ....contracts.object_reference import (
    ObjectReferenceBundleV1,
    ObjectReferenceCandidateV1,
    ObjectReferenceKind,
    ObjectReferenceStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-13.0.1-slice1"

# UI context keys that may carry object ids (string values only).
_UI_OBJECT_KEYS = (
    "draft_id",
    "active_draft_id",
    "party_id",
    "voucher_id",
    "invoice_id",
    "report_id",
)


def build_object_reference_bundle(
    *,
    conversation_id: str,
    active_draft_reference: str | None = None,
    active_ui_context: dict[str, Any] | None = None,
) -> ObjectReferenceBundleV1:
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
        # Skip duplicate of active draft already captured.
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

    return ObjectReferenceBundleV1(
        analysis_status=ObjectReferenceStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        source_authority="REQUEST",
        candidates=tuple(candidates),
        candidate_count=len(candidates),
        silent_applications=0,
        draft_mutations=0,
    )


def attach_object_references_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_object_reference_bundle(
        conversation_id=request.conversation_id,
        active_draft_reference=request.active_draft_reference,
        active_ui_context=dict(request.active_ui_context or {}),
    )
    return request.model_copy(update={"object_reference_bundle": bundle})
