"""MAI-14 — turn-relation decision + pending-draft merge gate.

Slice 1: annotate TurnRelationV1. Slice 2: gate mode_aware pending merge.
Never posts. CONFIRMATION_INTENT is never execution authority.
Uses MAI-13 object-reference resolutions as signals only.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.common import ConfidenceV1
from ....contracts.dialogue import ContractStatus, TurnRelationKind, TurnRelationV1
from ....contracts.object_reference import (
    ObjectReferenceBundleV1,
    ObjectReferenceKind,
    ObjectReferenceResolutionStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-14.0.2-slice2"

# Relations that may bind the turn to a pending draft for merge/clarify/correct.
_ALLOW_PENDING_MERGE = frozenset(
    {
        TurnRelationKind.CONTINUE_ACTIVE_DRAFT,
        TurnRelationKind.CONTINUE_EXPLICIT_DRAFT,
        TurnRelationKind.ANSWER_CLARIFICATION,
        TurnRelationKind.CORRECT_ACTIVE_DRAFT,
    }
)

_CANCEL_RE = re.compile(
    r"\b("
    r"cancel|cancelling|cancelled|discard|abort|stop\s+draft|"
    r"radd|रद्द|banda\s+gara|bandha\s+gara|cancel\s+gara"
    r")\b",
    re.IGNORECASE,
)
_CONFIRM_RE = re.compile(
    r"^(yes|y|ok|okay|confirm|confirmed|thik|thik\s*cha|ho|hajur|"
    r"ठिक|हो|हजुर|confirm\s*gara|post\s*gara)\.?$",
    re.IGNORECASE,
)
_CORRECT_RE = re.compile(
    r"\b("
    r"make\s+it|change\s+(it|to|the)|correct|fix|"
    r"instead|not\s+\d+|amount\s+(is|to)|"
    r"milau|milaa|sahi\s+gara|सही|मिलाउ"
    r")\b",
    re.IGNORECASE,
)
_CONTINUE_RE = re.compile(
    r"\b("
    r"continue|same\s+draft|that\s+draft|yo\s+draft|"
    r"tyahi|त्यही|continue\s+gara|agi\s+badha"
    r")\b",
    re.IGNORECASE,
)
_NEW_TOPIC_RE = re.compile(
    r"\b("
    r"new\s+(sale|purchase|invoice|bill|voucher|topic)|"
    r"hello|hi\b|namaste|नमस्ते|"
    r"vat\b|tds\b|report|balance\s+sheet|trial\s+balance|"
    r"aaja\s+ko\s+bikri|आजको\s+बिक्री|"
    r"bech[eé]|kin[eé]|purchase|sales?\s+invoice|"
    r"theft|chori|चोरी"
    r")\b",
    re.IGNORECASE,
)
# Short clarification-style answers when a draft is awaiting clarification.
_CLARIFY_RE = re.compile(
    r"^("
    r"cash|credit|bank|esewa|khalti|fonepay|"
    r"um+|uh+|yes\s+cash|no\s+credit|"
    r"नगद|उधारो|बैंक"
    r")\.?$",
    re.IGNORECASE,
)


def _norm(text: str) -> str:
    return " ".join((text or "").strip().split())


def _found_draft_ids(bundle: ObjectReferenceBundleV1 | None) -> tuple[str, ...]:
    if bundle is None:
        return ()
    ids: list[str] = []
    for r in bundle.resolutions:
        if r.kind not in {
            ObjectReferenceKind.ACTIVE_DRAFT,
            ObjectReferenceKind.UI_CONTEXT_OBJECT,
        }:
            continue
        if r.resolution_status == ObjectReferenceResolutionStatus.FOUND:
            ids.append(r.object_id)
    # Prefer ACTIVE_DRAFT candidate order.
    ordered: list[str] = []
    for c in bundle.candidates:
        if c.kind == ObjectReferenceKind.ACTIVE_DRAFT and c.object_id in ids:
            ordered.append(c.object_id)
    for oid in ids:
        if oid not in ordered:
            ordered.append(oid)
    return tuple(ordered)


def _has_terminal_or_missing_active_draft(bundle: ObjectReferenceBundleV1 | None) -> bool:
    if bundle is None:
        return False
    for r in bundle.resolutions:
        if r.kind != ObjectReferenceKind.ACTIVE_DRAFT:
            continue
        if r.resolution_status in {
            ObjectReferenceResolutionStatus.NOT_PENDING,
            ObjectReferenceResolutionStatus.MISSING,
        }:
            return True
    return False


def _awaiting_found(bundle: ObjectReferenceBundleV1 | None) -> bool:
    if bundle is None:
        return False
    for r in bundle.resolutions:
        if r.resolution_status != ObjectReferenceResolutionStatus.FOUND:
            continue
        if (r.draft_status or "").lower() == "awaiting_clarification":
            return True
    return False


def decide_turn_relation(
    *,
    raw_text: str,
    object_reference_bundle: ObjectReferenceBundleV1 | None = None,
    active_draft_reference: str | None = None,
) -> TurnRelationV1:
    text = _norm(raw_text)
    found = _found_draft_ids(object_reference_bundle)
    terminal_or_missing = _has_terminal_or_missing_active_draft(object_reference_bundle)
    awaiting = _awaiting_found(object_reference_bundle)
    has_draft_ref = bool((active_draft_reference or "").strip()) or bool(found)

    def _make(
        relation: TurnRelationKind,
        *,
        confidence: float,
        status: ContractStatus = ContractStatus.READY,
        alternatives: tuple[TurnRelationKind, ...] = (),
        refs: tuple[str, ...] | None = None,
    ) -> TurnRelationV1:
        return TurnRelationV1(
            relation=relation,
            referenced_object_ids=refs if refs is not None else found,
            alternatives=alternatives,
            confidence=ConfidenceV1(
                value=confidence,
                method="deterministic_lexicon_mai14",
                grants_authority=False,
            ),
            classifier_version=RUNTIME_VERSION,
            status=status,
        )

    # Terminal/missing active draft → never CONTINUE_*.
    if terminal_or_missing and not found:
        if _CANCEL_RE.search(text):
            return _make(
                TurnRelationKind.NEW_TOPIC,
                confidence=0.7,
                alternatives=(TurnRelationKind.CANCEL_ACTIVE_DRAFT,),
                refs=(),
            )
        # Continue cues against a non-pending draft are new work, not continue.
        if (
            _CONTINUE_RE.search(text)
            or _NEW_TOPIC_RE.search(text)
            or len(text.split()) >= 3
        ):
            return _make(TurnRelationKind.NEW_TOPIC, confidence=0.85, refs=())
        return _make(
            TurnRelationKind.UNKNOWN,
            confidence=0.4,
            status=ContractStatus.PARTIAL,
            alternatives=(TurnRelationKind.NEW_TOPIC,),
            refs=(),
        )

    if _CANCEL_RE.search(text) and has_draft_ref:
        return _make(TurnRelationKind.CANCEL_ACTIVE_DRAFT, confidence=0.9)

    if _CONFIRM_RE.match(text) and found:
        return _make(TurnRelationKind.CONFIRMATION_INTENT, confidence=0.85)

    if _CORRECT_RE.search(text) and found:
        return _make(TurnRelationKind.CORRECT_ACTIVE_DRAFT, confidence=0.8)

    if _CONTINUE_RE.search(text) and found:
        return _make(TurnRelationKind.CONTINUE_ACTIVE_DRAFT, confidence=0.8)

    if awaiting and _CLARIFY_RE.match(text) and found:
        return _make(TurnRelationKind.ANSWER_CLARIFICATION, confidence=0.75)

    # Clear new-topic signals even when a pending draft exists (stale capture risk).
    if _NEW_TOPIC_RE.search(text):
        alts: tuple[TurnRelationKind, ...] = ()
        if found:
            alts = (TurnRelationKind.CONTINUE_ACTIVE_DRAFT, TurnRelationKind.UNKNOWN)
        return _make(
            TurnRelationKind.NEW_TOPIC,
            confidence=0.8 if found else 0.9,
            alternatives=alts,
            refs=() if not found else found,
        )

    if not found and not has_draft_ref:
        return _make(TurnRelationKind.NEW_TOPIC, confidence=0.7, refs=())

    if found and awaiting and len(text.split()) <= 3:
        return _make(
            TurnRelationKind.ANSWER_CLARIFICATION,
            confidence=0.55,
            status=ContractStatus.PARTIAL,
            alternatives=(TurnRelationKind.UNKNOWN, TurnRelationKind.NEW_TOPIC),
        )

    if found:
        return _make(
            TurnRelationKind.UNKNOWN,
            confidence=0.35,
            status=ContractStatus.PARTIAL,
            alternatives=(
                TurnRelationKind.CONTINUE_ACTIVE_DRAFT,
                TurnRelationKind.NEW_TOPIC,
                TurnRelationKind.ANSWER_CLARIFICATION,
            ),
        )

    return _make(
        TurnRelationKind.UNKNOWN,
        confidence=0.3,
        status=ContractStatus.PARTIAL,
        alternatives=(TurnRelationKind.NEW_TOPIC,),
        refs=(),
    )


def attach_turn_relation_to_request(request: CanonicalAIRequestV1) -> CanonicalAIRequestV1:
    decision = decide_turn_relation(
        raw_text=request.raw_text,
        object_reference_bundle=request.object_reference_bundle,
        active_draft_reference=request.active_draft_reference,
    )
    # Never mutate user text; annotation only.
    return request.model_copy(update={"turn_relation": decision})


def allows_pending_merge(turn_relation: Any) -> bool:
    """Whether mode_aware may bind this turn to a pending draft.

    ``None`` preserves legacy behavior (direct unit tests without metadata).
    Unknown / NEW_TOPIC / CONFIRMATION / CANCEL / FAILED → False (fail-closed).
    """
    if turn_relation is None:
        return True

    relation: TurnRelationKind | None = None
    status: ContractStatus | None = None

    if isinstance(turn_relation, TurnRelationV1):
        relation = turn_relation.relation
        status = turn_relation.status
    elif isinstance(turn_relation, dict):
        raw_rel = turn_relation.get("relation")
        raw_status = turn_relation.get("status")
        if raw_rel is None:
            return False
        try:
            relation = TurnRelationKind(str(raw_rel))
        except ValueError:
            return False
        if raw_status is not None:
            try:
                status = ContractStatus(str(raw_status))
            except ValueError:
                return False
    else:
        return False

    if status == ContractStatus.FAILED:
        return False
    return relation in _ALLOW_PENDING_MERGE


def turn_relation_to_metadata(decision: TurnRelationV1 | None) -> dict[str, Any]:
    if decision is None:
        return {}
    return {
        "relation": decision.relation.value,
        "status": decision.status.value,
        "classifier_version": decision.classifier_version,
        "referenced_object_ids": list(decision.referenced_object_ids),
        "alternatives": [a.value for a in decision.alternatives],
        "confidence": (
            decision.confidence.value if decision.confidence is not None else None
        ),
        "is_execution_authority": False,
        "allows_pending_merge": allows_pending_merge(decision),
    }
