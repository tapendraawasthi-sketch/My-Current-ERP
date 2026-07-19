"""MAI-15 slice 1 — reference / coreference / correction annotation.

Never applies corrections. Never merges drafts. Never posts.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.dialogue import TurnRelationKind, TurnRelationV1
from ....contracts.object_reference import (
    ObjectReferenceBundleV1,
    ObjectReferenceKind,
    ObjectReferenceResolutionStatus,
)
from ....contracts.reference_coreference import (
    CorrectionCandidateV1,
    CorrectionCueKind,
    CorrectionTargetKind,
    DiscourseMentionV1,
    MentionKind,
    MentionResolutionStatus,
    ReferenceCoreferenceBundleV1,
    ReferenceCoreferenceStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-15.0.1-slice1"

_NEGATE_AMOUNT_RE = re.compile(
    r"(?P<a>\d+(?:[.,]\d+)?)\s*(?:hoina|hoina\s*|होइन|isn'?t|not)\s*(?P<b>\d+(?:[.,]\d+)?)",
    re.IGNORECASE,
)
_SACHHI_AMOUNT_RE = re.compile(
    r"(?:sachhi|sahi|सही|correct(?:\s+to)?|make\s+it)\s*(?P<v>\d+(?:[.,]\d+)?)",
    re.IGNORECASE,
)
_PRIOR_RE = re.compile(
    r"\b("
    r"pahile\s*ko|agadi\s*ko|tyo|yo|wahi|wahii|same|"
    r"that\s+(one|draft|entry)|prior|previous|"
    r"पहिले|अगाडि|त्यो|यो|वही"
    r")\b",
    re.IGNORECASE,
)
_CORRECT_GENERIC_RE = re.compile(
    r"\b(correct|fix|change\s+(it|to)|milau|milaa|सही\s*gara|मिलाउ)\b",
    re.IGNORECASE,
)
_CONFIRM_ONLY_RE = re.compile(
    r"^(yes|y|ok|okay|ho|thik|hajur|ठिक|हो|हजुर)\.?$",
    re.IGNORECASE,
)


def _norm(text: str) -> str:
    return " ".join((text or "").strip().split())


def _found_draft_id(bundle: ObjectReferenceBundleV1 | None) -> str | None:
    if bundle is None:
        return None
    for r in bundle.resolutions:
        if (
            r.kind == ObjectReferenceKind.ACTIVE_DRAFT
            and r.resolution_status == ObjectReferenceResolutionStatus.FOUND
        ):
            return r.object_id
    for c in bundle.candidates:
        if c.kind == ObjectReferenceKind.ACTIVE_DRAFT:
            return c.object_id
    return None


def build_reference_coreference_bundle(
    *,
    raw_text: str,
    turn_relation: TurnRelationV1 | None = None,
    object_reference_bundle: ObjectReferenceBundleV1 | None = None,
    active_ui_context: dict[str, Any] | None = None,
) -> ReferenceCoreferenceBundleV1:
    text = _norm(raw_text)
    mentions: list[DiscourseMentionV1] = []
    corrections: list[CorrectionCandidateV1] = []
    mid = 0
    cid = 0
    echo = turn_relation.relation if turn_relation is not None else None
    draft_id = _found_draft_id(object_reference_bundle)

    if _CONFIRM_ONLY_RE.match(text):
        return ReferenceCoreferenceBundleV1(
            analysis_status=ReferenceCoreferenceStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            turn_relation_echo=echo,
            mention_count=0,
            correction_count=0,
            silent_applications=0,
            draft_mutations=0,
        )

    # Correction: "500 hoina 600" / "make it 450" / generic correct.
    negate = _NEGATE_AMOUNT_RE.search(text)
    replace = _SACHHI_AMOUNT_RE.search(text)
    generic = _CORRECT_GENERIC_RE.search(text)
    if negate:
        mid += 1
        mention = DiscourseMentionV1(
            mention_id=f"men-{mid:04d}",
            kind=MentionKind.AMOUNT,
            surface_cue=negate.group(0),
            reason_codes=("NEGATE_REPLACE_AMOUNT",),
            referent_object_id=draft_id,
            resolution_status=(
                MentionResolutionStatus.RESOLVED
                if draft_id
                else MentionResolutionStatus.UNRESOLVED
            ),
            applied=False,
        )
        mentions.append(mention)
        cid += 1
        corrections.append(
            CorrectionCandidateV1(
                correction_id=f"cor-{cid:04d}",
                target_kind=CorrectionTargetKind.AMOUNT,
                cue_kind=CorrectionCueKind.NEGATE_REPLACE,
                proposed_value_surface=negate.group("b"),
                linked_mention_ids=(mention.mention_id,),
                reason_codes=("NEGATE_REPLACE_AMOUNT",),
                applied=False,
            )
        )
    elif replace:
        mid += 1
        mention = DiscourseMentionV1(
            mention_id=f"men-{mid:04d}",
            kind=MentionKind.AMOUNT,
            surface_cue=replace.group(0),
            reason_codes=("REPLACE_AMOUNT",),
            referent_object_id=draft_id,
            resolution_status=(
                MentionResolutionStatus.RESOLVED
                if draft_id
                else MentionResolutionStatus.UNRESOLVED
            ),
            applied=False,
        )
        mentions.append(mention)
        cid += 1
        corrections.append(
            CorrectionCandidateV1(
                correction_id=f"cor-{cid:04d}",
                target_kind=CorrectionTargetKind.AMOUNT,
                cue_kind=CorrectionCueKind.REPLACE_AMOUNT,
                proposed_value_surface=replace.group("v"),
                linked_mention_ids=(mention.mention_id,),
                reason_codes=("REPLACE_AMOUNT",),
                applied=False,
            )
        )
    elif generic:
        mid += 1
        mention = DiscourseMentionV1(
            mention_id=f"men-{mid:04d}",
            kind=MentionKind.DRAFT if draft_id else MentionKind.UNKNOWN,
            surface_cue=generic.group(0),
            reason_codes=("GENERIC_CORRECT",),
            referent_object_id=draft_id,
            resolution_status=(
                MentionResolutionStatus.RESOLVED
                if draft_id
                else MentionResolutionStatus.UNRESOLVED
            ),
            applied=False,
        )
        mentions.append(mention)
        cid += 1
        corrections.append(
            CorrectionCandidateV1(
                correction_id=f"cor-{cid:04d}",
                target_kind=(
                    CorrectionTargetKind.DRAFT
                    if draft_id
                    else CorrectionTargetKind.UNKNOWN
                ),
                cue_kind=CorrectionCueKind.GENERIC_CORRECT,
                linked_mention_ids=(mention.mention_id,),
                reason_codes=("GENERIC_CORRECT",),
                applied=False,
            )
        )

    # Reference / coreference cues
    pref = _PRIOR_RE.search(text)
    if pref:
        mid += 1
        ui = dict(active_ui_context or {})
        party = ui.get("party_id") if isinstance(ui.get("party_id"), str) else None
        if draft_id and echo in {
            TurnRelationKind.CORRECT_ACTIVE_DRAFT,
            TurnRelationKind.CONTINUE_ACTIVE_DRAFT,
            TurnRelationKind.ANSWER_CLARIFICATION,
            TurnRelationKind.CONTINUE_EXPLICIT_DRAFT,
        }:
            mentions.append(
                DiscourseMentionV1(
                    mention_id=f"men-{mid:04d}",
                    kind=MentionKind.DRAFT,
                    surface_cue=pref.group(0),
                    reason_codes=("PRIOR_CUE_DRAFT_BIND",),
                    referent_object_id=draft_id,
                    resolution_status=MentionResolutionStatus.RESOLVED,
                    applied=False,
                )
            )
        elif party:
            mentions.append(
                DiscourseMentionV1(
                    mention_id=f"men-{mid:04d}",
                    kind=MentionKind.PARTY,
                    surface_cue=pref.group(0),
                    reason_codes=("PRIOR_CUE_UI_PARTY",),
                    referent_object_id=party,
                    resolution_status=MentionResolutionStatus.RESOLVED,
                    applied=False,
                )
            )
        elif draft_id:
            mentions.append(
                DiscourseMentionV1(
                    mention_id=f"men-{mid:04d}",
                    kind=MentionKind.DRAFT,
                    surface_cue=pref.group(0),
                    reason_codes=("PRIOR_CUE_DRAFT",),
                    referent_object_id=draft_id,
                    resolution_status=MentionResolutionStatus.RESOLVED,
                    applied=False,
                )
            )
        elif len(text.split()) <= 3:
            mentions.append(
                DiscourseMentionV1(
                    mention_id=f"men-{mid:04d}",
                    kind=MentionKind.PRIOR_ANSWER,
                    surface_cue=pref.group(0),
                    reason_codes=("PRIOR_CUE_AMBIGUOUS",),
                    resolution_status=MentionResolutionStatus.AMBIGUOUS,
                    applied=False,
                )
            )
        else:
            mentions.append(
                DiscourseMentionV1(
                    mention_id=f"men-{mid:04d}",
                    kind=MentionKind.PRIOR_ANSWER,
                    surface_cue=pref.group(0),
                    reason_codes=("PRIOR_CUE_UNRESOLVED",),
                    resolution_status=MentionResolutionStatus.UNRESOLVED,
                    applied=False,
                )
            )

    # Echo CORRECT turn-relation with FOUND draft even without explicit cue.
    if (
        echo == TurnRelationKind.CORRECT_ACTIVE_DRAFT
        and draft_id
        and not corrections
    ):
        mid += 1
        mentions.append(
            DiscourseMentionV1(
                mention_id=f"men-{mid:04d}",
                kind=MentionKind.DRAFT,
                surface_cue="",
                reason_codes=("TURN_RELATION_CORRECT_ECHO",),
                referent_object_id=draft_id,
                resolution_status=MentionResolutionStatus.RESOLVED,
                applied=False,
            )
        )

    resolved = sum(
        1 for x in mentions if x.resolution_status == MentionResolutionStatus.RESOLVED
    )
    ambiguous = sum(
        1 for x in mentions if x.resolution_status == MentionResolutionStatus.AMBIGUOUS
    )
    status = ReferenceCoreferenceStatus.COMPLETE
    if mentions and resolved == 0 and ambiguous > 0:
        status = ReferenceCoreferenceStatus.PARTIAL

    return ReferenceCoreferenceBundleV1(
        analysis_status=status,
        runtime_version=RUNTIME_VERSION,
        source_authority="REQUEST",
        turn_relation_echo=echo,
        mentions=tuple(mentions),
        corrections=tuple(corrections),
        mention_count=len(mentions),
        correction_count=len(corrections),
        resolved_count=resolved,
        ambiguous_count=ambiguous,
        silent_applications=0,
        draft_mutations=0,
    )


def attach_reference_coreference_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_reference_coreference_bundle(
        raw_text=request.raw_text,
        turn_relation=request.turn_relation,
        object_reference_bundle=request.object_reference_bundle,
        active_ui_context=dict(request.active_ui_context or {}),
    )
    return request.model_copy(update={"reference_coreference_bundle": bundle})


def reference_coreference_to_metadata(
    bundle: ReferenceCoreferenceBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "turn_relation_echo": (
            bundle.turn_relation_echo.value if bundle.turn_relation_echo else None
        ),
        "mention_count": bundle.mention_count,
        "correction_count": bundle.correction_count,
        "resolved_count": bundle.resolved_count,
        "ambiguous_count": bundle.ambiguous_count,
        "silent_applications": bundle.silent_applications,
        "draft_mutations": bundle.draft_mutations,
    }
