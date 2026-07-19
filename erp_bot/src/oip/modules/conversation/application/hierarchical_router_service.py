"""MAI-17 — hierarchical router + OOD.

Slice 1: annotate domain → intent_family → OOD on CanonicalAIRequestV1.
Slice 2: consume abstain into mode_aware (clarify; never silent draft writes).
Never posts, never grants execution authority.
Wraps operation_classifier + domain concept bridge as evidence only.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.dialogue import (
    ContractStatus,
    IntentCandidateV1,
    TurnRelationKind,
)
from ....contracts.object_reference import (
    ObjectReferenceKind,
    ObjectReferenceResolutionStatus,
)
from ....contracts.request import CanonicalAIRequestV1
from ....contracts.router_decision import (
    IntentFamily,
    OodSignalV1,
    RouterAnalysisStatus,
    RouterDecisionBundleV1,
    RouterDomain,
)

RUNTIME_VERSION = "mai-17.0.2-slice2"

_MUTATING_OP_CLASSES = frozenset(
    {
        "transaction_create",
        "transaction_modify",
        "transaction_reverse",
        "master_data_create",
        "master_data_modify",
        "confirmation",
    }
)

_OOD_IS_THRESHOLD = 0.70
_OOD_ABSTAIN_THRESHOLD = 0.75

_OP_TO_FAMILY: dict[str, IntentFamily] = {
    "transaction_create": IntentFamily.TRANSACTION,
    "transaction_modify": IntentFamily.TRANSACTION,
    "transaction_reverse": IntentFamily.TRANSACTION,
    "erp_data_query": IntentFamily.QUERY,
    "report_request": IntentFamily.REPORT,
    "report_follow_up": IntentFamily.REPORT,
    "master_data_create": IntentFamily.MASTER,
    "master_data_modify": IntentFamily.MASTER,
    "confirmation": IntentFamily.CONFIRM,
    "cancellation": IntentFamily.CANCEL,
    "clarification_reply": IntentFamily.CLARIFY,
    "accounting_question": IntentFamily.QA,
    "general_question": IntentFamily.QA,
}

_OP_TO_DOMAIN: dict[str, RouterDomain] = {
    "transaction_create": RouterDomain.ERP_OPS,
    "transaction_modify": RouterDomain.ERP_OPS,
    "transaction_reverse": RouterDomain.ERP_OPS,
    "erp_data_query": RouterDomain.ERP_OPS,
    "report_request": RouterDomain.REPORTING,
    "report_follow_up": RouterDomain.REPORTING,
    "master_data_create": RouterDomain.MASTER_DATA,
    "master_data_modify": RouterDomain.MASTER_DATA,
    "confirmation": RouterDomain.DIALOGUE,
    "cancellation": RouterDomain.DIALOGUE,
    "clarification_reply": RouterDomain.DIALOGUE,
    "accounting_question": RouterDomain.ACCOUNTING,
    "general_question": RouterDomain.DIALOGUE,
}

_CONCEPT_DOMAIN: dict[str, RouterDomain] = {
    "CONCEPT_SALES": RouterDomain.ERP_OPS,
    "CONCEPT_PURCHASE": RouterDomain.ERP_OPS,
    "CONCEPT_PAYMENT": RouterDomain.ERP_OPS,
    "CONCEPT_RECEIPT": RouterDomain.ERP_OPS,
    "CONCEPT_INVOICE": RouterDomain.ERP_OPS,
    "CONCEPT_CREDIT": RouterDomain.ERP_OPS,
    "CONCEPT_CASH": RouterDomain.ERP_OPS,
    "CONCEPT_BALANCE": RouterDomain.ERP_OPS,
    "CONCEPT_REPORT": RouterDomain.REPORTING,
    "CONCEPT_VAT": RouterDomain.ACCOUNTING,
    "CONCEPT_EXPENSE": RouterDomain.ACCOUNTING,
    "CONCEPT_RENT": RouterDomain.ACCOUNTING,
    "CONCEPT_INTEREST": RouterDomain.ACCOUNTING,
    "CONCEPT_STOCK": RouterDomain.ERP_OPS,
}


def _has_active_draft(request: CanonicalAIRequestV1) -> bool:
    oref = request.object_reference_bundle
    if oref is None:
        return False
    for r in oref.resolutions:
        if (
            r.kind == ObjectReferenceKind.ACTIVE_DRAFT
            and r.resolution_status == ObjectReferenceResolutionStatus.FOUND
        ):
            return True
    return False


def _concept_ids(request: CanonicalAIRequestV1) -> tuple[str, ...]:
    frame = request.language_frame
    bundle = frame.domain_lexicon_bundle if frame is not None else None
    if bundle is None:
        # Fall back to raw parse (still annotation-only).
        try:
            from ...language_runtime.domain_lexicon.application.domain_lexicon_service import (
                parse_domain_concepts,
            )

            rows = parse_domain_concepts(request.raw_text)
            return tuple(str(r.get("concept_id") or "") for r in rows if r.get("concept_id"))
        except Exception:  # noqa: BLE001
            return ()
    ids: list[str] = []
    for c in bundle.candidates or ():
        cid = getattr(c, "concept_id", None)
        if cid:
            ids.append(str(cid))
    return tuple(ids)


def _domain_from_concepts(concept_ids: tuple[str, ...]) -> RouterDomain | None:
    if not concept_ids:
        return None
    domains = {_CONCEPT_DOMAIN[c] for c in concept_ids if c in _CONCEPT_DOMAIN}
    if not domains:
        return None
    if RouterDomain.REPORTING in domains:
        return RouterDomain.REPORTING
    if RouterDomain.ACCOUNTING in domains and RouterDomain.ERP_OPS not in domains:
        return RouterDomain.ACCOUNTING
    if RouterDomain.ERP_OPS in domains:
        return RouterDomain.ERP_OPS
    return next(iter(domains))


def _score_ood(
    *,
    domain: RouterDomain,
    family: IntentFamily,
    op_class: str,
    op_conf: float,
    concept_ids: tuple[str, ...],
    message: str,
    turn_relation: TurnRelationKind | None,
) -> OodSignalV1:
    score = 0.0
    reasons: list[str] = []
    text = (message or "").strip()

    if not text:
        score = 1.0
        reasons.append("EMPTY_MESSAGE")
    elif domain == RouterDomain.UNKNOWN:
        score = max(score, 0.72)
        reasons.append("DOMAIN_UNKNOWN")
    if family == IntentFamily.UNKNOWN:
        score = max(score, 0.65)
        reasons.append("FAMILY_UNKNOWN")
    if not concept_ids and op_class == "general_question" and op_conf <= 0.6:
        score = max(score, 0.78)
        reasons.append("WEAK_GENERAL_FALLTHROUGH")
    if "CONCEPT_SALES" in concept_ids and "CONCEPT_PURCHASE" in concept_ids:
        score = max(score, 0.8)
        reasons.append("CONFLICTING_SALES_PURCHASE")
    if len(text) < 2:
        score = max(score, 0.85)
        reasons.append("TOO_SHORT")

    # Active-task dialogue lowers OOD.
    if turn_relation in {
        TurnRelationKind.ANSWER_CLARIFICATION,
        TurnRelationKind.CONTINUE_ACTIVE_DRAFT,
        TurnRelationKind.CONTINUE_EXPLICIT_DRAFT,
        TurnRelationKind.CORRECT_ACTIVE_DRAFT,
        TurnRelationKind.CONFIRMATION_INTENT,
        TurnRelationKind.CANCEL_ACTIVE_DRAFT,
    }:
        score = max(0.0, score - 0.25)
        reasons.append("TURN_RELATION_GROUNDS")

    if domain in {
        RouterDomain.ERP_OPS,
        RouterDomain.REPORTING,
        RouterDomain.ACCOUNTING,
        RouterDomain.MASTER_DATA,
    } and family != IntentFamily.UNKNOWN:
        score = max(0.0, score - 0.15)
        reasons.append("IN_DISTRIBUTION_DOMAIN")

    score = min(1.0, max(0.0, round(score, 4)))
    return OodSignalV1(
        score=score,
        is_ood=score >= _OOD_IS_THRESHOLD,
        abstain_recommended=score >= _OOD_ABSTAIN_THRESHOLD,
        reason_codes=tuple(reasons),
    )


def build_router_decision_bundle(
    request: CanonicalAIRequestV1,
) -> RouterDecisionBundleV1:
    warnings: list[str] = []
    concept_ids = _concept_ids(request)
    has_draft = _has_active_draft(request)
    tr = request.turn_relation.relation if request.turn_relation is not None else None

    try:
        from src.orbix.operation_classifier import classify_operation

        result = classify_operation(
            request.raw_text,
            has_pending_draft=has_draft,
        )
        op_class = result.operation_class.value
        op_conf = float(result.confidence)
        intent_hint = result.intent_hint
    except Exception:  # noqa: BLE001
        warnings.append("OPERATION_CLASSIFIER_FAILED")
        op_class = "general_question"
        op_conf = 0.4
        intent_hint = None

    family = _OP_TO_FAMILY.get(op_class, IntentFamily.UNKNOWN)
    domain = _OP_TO_DOMAIN.get(op_class, RouterDomain.UNKNOWN)
    concept_domain = _domain_from_concepts(concept_ids)
    if concept_domain is not None:
        # Prefer lexicon domain when classifier is weak general.
        if domain in {RouterDomain.DIALOGUE, RouterDomain.UNKNOWN} or op_conf < 0.7:
            domain = concept_domain

    # Concept bridge may refine intent_hint without mutating drafts.
    try:
        from ...language_runtime.domain_lexicon.application.concept_intent_bridge import (
            map_concepts_to_intent,
        )

        bridged = map_concepts_to_intent(concept_ids, message=request.raw_text)
        if bridged is not None:
            hint, conf, _reasons = bridged
            if intent_hint is None or conf >= op_conf:
                intent_hint = hint
                op_conf = max(op_conf, conf)
    except Exception:  # noqa: BLE001
        warnings.append("CONCEPT_BRIDGE_SOFT_FAIL")

    if tr == TurnRelationKind.ANSWER_CLARIFICATION:
        family = IntentFamily.CLARIFY
        domain = RouterDomain.DIALOGUE if domain == RouterDomain.UNKNOWN else domain
    elif tr == TurnRelationKind.CONFIRMATION_INTENT:
        family = IntentFamily.CONFIRM
        domain = RouterDomain.DIALOGUE
    elif tr == TurnRelationKind.CANCEL_ACTIVE_DRAFT:
        family = IntentFamily.CANCEL
        domain = RouterDomain.DIALOGUE

    ood = _score_ood(
        domain=domain,
        family=family,
        op_class=op_class,
        op_conf=op_conf,
        concept_ids=concept_ids,
        message=request.raw_text,
        turn_relation=tr,
    )

    candidate = IntentCandidateV1(
        intent_id=intent_hint or op_class or "unknown",
        domain=domain.value.lower(),
        score=op_conf,
        out_of_distribution_score=ood.score,
        classifier_version=RUNTIME_VERSION,
        status=ContractStatus.READY,
    )

    status = RouterAnalysisStatus.COMPLETE
    if warnings and domain == RouterDomain.UNKNOWN:
        status = RouterAnalysisStatus.PARTIAL

    return RouterDecisionBundleV1(
        analysis_status=status,
        runtime_version=RUNTIME_VERSION,
        source_authority="REQUEST",
        domain=domain,
        intent_family=family,
        intent_hint=intent_hint,
        operation_class=op_class,
        operation_confidence=op_conf,
        candidates=(candidate,),
        ood=ood,
        classifier_version=RUNTIME_VERSION,
        concept_ids=concept_ids,
        warnings=tuple(warnings),
        silent_applications=0,
        draft_mutations=0,
    )


def attach_router_decision_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_router_decision_bundle(request)
    return request.model_copy(update={"router_decision_bundle": bundle})


def router_decision_to_metadata(
    bundle: RouterDecisionBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "domain": bundle.domain.value,
        "intent_family": bundle.intent_family.value,
        "intent_hint": bundle.intent_hint,
        "operation_class": bundle.operation_class,
        "operation_confidence": bundle.operation_confidence,
        "ood": {
            "score": bundle.ood.score,
            "is_ood": bundle.ood.is_ood,
            "abstain_recommended": bundle.ood.abstain_recommended,
            "reason_codes": list(bundle.ood.reason_codes),
        },
        "concept_ids": list(bundle.concept_ids),
        "candidate_count": len(bundle.candidates),
        "silent_applications": bundle.silent_applications,
        "draft_mutations": bundle.draft_mutations,
        "is_execution_authority": False,
    }


def _ood_from_meta(router_decision: Mapping[str, Any] | None) -> dict[str, Any]:
    if not isinstance(router_decision, Mapping):
        return {}
    ood = router_decision.get("ood")
    return dict(ood) if isinstance(ood, Mapping) else {}


def should_abstain_router_decision(
    router_decision: Mapping[str, Any] | None,
    *,
    has_pending_clarify: bool = False,
    turn_relation: Mapping[str, Any] | None = None,
    operation_class: str | None = None,
) -> bool:
    """Return True when mode_aware must clarify and not mutate drafts.

    ``router_decision=None`` keeps legacy behavior (no gate).
    Pending clarification with allow-merge turn-relation is never blocked.
    """
    if not isinstance(router_decision, Mapping):
        return False

    if has_pending_clarify:
        try:
            from .turn_relation_service import allows_pending_merge

            if allows_pending_merge(turn_relation):
                return False
        except Exception:  # noqa: BLE001
            # Fail closed: with pending + broken gate helper, still allow
            # clarification path (prefer draft continuity over hard abstain).
            if turn_relation is None:
                return False

    ood = _ood_from_meta(router_decision)
    if not ood.get("abstain_recommended") and not ood.get("is_ood"):
        return False

    family = str(router_decision.get("intent_family") or "UNKNOWN")
    # Dialogue families on grounded turns are not OOD-blocked.
    if family in {"CLARIFY", "CONFIRM", "CANCEL"} and has_pending_clarify:
        return False

    if ood.get("abstain_recommended"):
        return True

    # Soft OOD: only block mutating operation classes.
    op = (operation_class or router_decision.get("operation_class") or "").lower()
    return bool(ood.get("is_ood") and op in _MUTATING_OP_CLASSES)


def router_abstain_user_message(
    router_decision: Mapping[str, Any] | None = None,
) -> str:
    domain = ""
    family = ""
    if isinstance(router_decision, Mapping):
        domain = str(router_decision.get("domain") or "")
        family = str(router_decision.get("intent_family") or "")
    base = (
        "I could not map that to a clear ERP action. "
        "Please rephrase as a purchase, sale, payment, receipt, report, "
        "or party balance query."
    )
    if domain or family:
        return f"{base} (router: {domain or '-'} / {family or '-'})"
    return base


def select_family_operation_hint(
    router_decision: Mapping[str, Any] | None,
) -> str | None:
    """Optional family hint for observability; never execution authority."""
    if not isinstance(router_decision, Mapping):
        return None
    family = str(router_decision.get("intent_family") or "")
    hint = router_decision.get("intent_hint")
    if family and family != "UNKNOWN":
        return f"{family}:{hint or ''}".rstrip(":")
    return None
