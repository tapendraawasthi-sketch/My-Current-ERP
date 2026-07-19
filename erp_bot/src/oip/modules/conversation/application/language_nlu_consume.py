"""NEXT-07 — build/consume language_nlu_candidates on primary ERP preprocess."""

from __future__ import annotations

from typing import Any, Mapping

from src.orbix.operation_classifier import ClassificationResult, OperationClass

from .nlu_language_consume_policy import (
    AUTHORITY,
    STEP,
    load_nlu_language_consume_registry,
)

_MONEY_ROLES = frozenset({"amount", "quantity", "percentage"})
_NON_MONEY_FIRST = frozenset(
    {"duration", "identifier", "invoice_number", "date", "unknown"}
)

_INTENT_TO_OP: dict[str, tuple[OperationClass, float]] = {
    "report_generation": (OperationClass.REPORT_REQUEST, 0.92),
    "ledger_balance_query": (OperationClass.ERP_DATA_QUERY, 0.93),
    "sales_entry": (OperationClass.TRANSACTION_CREATE, 0.9),
    "purchase_entry": (OperationClass.TRANSACTION_CREATE, 0.9),
    "journal_entry": (OperationClass.TRANSACTION_CREATE, 0.86),
    "vat_calculation": (OperationClass.ACCOUNTING_QUESTION, 0.91),
}

_LOCKED_OPS = frozenset(
    {
        OperationClass.CONFIRMATION,
        OperationClass.CANCELLATION,
        OperationClass.CLARIFICATION_REPLY,
    }
)


def language_frame_to_nlu_metadata(frame: Any | None) -> dict[str, Any]:
    """Slim metadata for preprocess. Never mutates raw_text; never applies candidates."""
    reg = load_nlu_language_consume_registry()
    pol = reg["policies"]
    empty: dict[str, Any] = {
        "step": STEP,
        "authority": AUTHORITY,
        "concept_ids": [],
        "number_roles": [],
        "protected_span_count": 0,
        "silent_applications": 0,
        "draft_mutations": 0,
        "raw_text_mutated": False,
        "allow_concept_intent_consume": bool(pol["allow_concept_intent_consume"]),
        "allow_number_role_consume": bool(pol["allow_number_role_consume"]),
        "allow_transliteration_apply": False,
        "allow_typo_rewrite_apply": False,
        "allow_silent_master_bind": False,
        "allow_silent_draft_write": False,
    }
    if frame is None:
        return empty

    concept_ids: list[str] = []
    lexicon = getattr(frame, "domain_lexicon_bundle", None)
    if lexicon is not None:
        for c in getattr(lexicon, "candidates", ()) or ():
            if getattr(c, "applied", False):
                raise RuntimeError("DOMAIN_LEXICON_CANDIDATE_APPLIED")
            cid = getattr(c, "concept_id", None)
            if cid and str(cid) not in concept_ids:
                concept_ids.append(str(cid))
        silent = int(getattr(lexicon, "silent_applications", 0) or 0)
        if silent != 0:
            raise RuntimeError("SILENT_APPLICATIONS_NONZERO")

    number_roles: list[dict[str, Any]] = []
    nrb = getattr(frame, "number_role_bundle", None)
    if nrb is not None:
        for c in getattr(nrb, "candidates", ()) or ():
            if getattr(c, "applied", False):
                raise RuntimeError("NUMBER_ROLE_CANDIDATE_APPLIED")
            role = getattr(c, "role", None)
            role_s = role.value if hasattr(role, "value") else str(role or "unknown")
            number_roles.append(
                {
                    "surface": str(getattr(c, "surface", "") or ""),
                    "role": role_s,
                    "ambiguous": bool(getattr(c, "ambiguous", False)),
                    "normalized_value": getattr(c, "normalized_value", None),
                }
            )
        silent = int(getattr(nrb, "silent_applications", 0) or 0)
        if silent != 0:
            raise RuntimeError("SILENT_APPLICATIONS_NONZERO")

    protected = getattr(frame, "protected_spans", None) or ()
    annotations = getattr(frame, "span_annotations", None) or ()
    protected_count = len(tuple(protected)) + sum(
        1 for s in annotations if getattr(s, "protected_reason", None)
    )

    out = dict(empty)
    out["concept_ids"] = concept_ids
    out["number_roles"] = number_roles
    out["protected_span_count"] = int(protected_count)
    return out


def first_money_role_candidate(
    language_nlu: Mapping[str, Any] | None,
) -> dict[str, Any] | None:
    """Prefer amount/quantity/percentage; skip duration/ID/unknown as first money."""
    if not language_nlu or not language_nlu.get("allow_number_role_consume"):
        return None
    for row in language_nlu.get("number_roles") or []:
        if not isinstance(row, dict):
            continue
        role = str(row.get("role") or "").lower()
        if role in _NON_MONEY_FIRST:
            continue
        if role in _MONEY_ROLES and not row.get("ambiguous"):
            return row
    return None


def refine_classification_with_language_candidates(
    classification: ClassificationResult,
    message: str,
    language_nlu: Mapping[str, Any] | None,
    *,
    router_decision: Mapping[str, Any] | None = None,
) -> ClassificationResult:
    """Refine weak classifications using concept bridge; never drafts/binds."""
    if not language_nlu or not language_nlu.get("allow_concept_intent_consume"):
        return classification
    if classification.operation_class in _LOCKED_OPS:
        return classification

    concept_ids = list(language_nlu.get("concept_ids") or [])
    if router_decision and isinstance(router_decision, dict):
        for cid in router_decision.get("concept_ids") or []:
            if str(cid) not in concept_ids:
                concept_ids.append(str(cid))

    if not concept_ids:
        return classification

    try:
        from ...language_runtime.domain_lexicon.application.concept_intent_bridge import (
            map_concepts_to_intent,
        )
    except Exception:  # noqa: BLE001
        return classification

    bridged = map_concepts_to_intent(concept_ids, message=message)
    if bridged is None:
        return classification

    intent, conf, reasons = bridged
    mapped = _INTENT_TO_OP.get(intent)
    if mapped is None:
        return classification

    op, base_conf = mapped
    use_conf = max(float(conf), float(base_conf))

    # Only upgrade weak / general fallthrough, or same-family txn intent hint.
    weak = (
        classification.operation_class == OperationClass.GENERAL_QUESTION
        or float(classification.confidence) + 0.05 < use_conf
    )
    if not weak and classification.operation_class != op:
        # Allow intent_hint refine inside TRANSACTION_CREATE.
        if not (
            classification.operation_class == OperationClass.TRANSACTION_CREATE
            and op == OperationClass.TRANSACTION_CREATE
        ):
            return classification

    meta = dict(classification.metadata or {})
    meta["nlu_language_consume"] = {
        "authority": AUTHORITY,
        "step": STEP,
        "intent_source": "mai10_concept_bridge",
        "reason_codes": list(reasons),
        "draft_mutations": 0,
        "silent_applications": 0,
    }
    return ClassificationResult(
        operation_class=op,
        confidence=use_conf,
        intent_hint=intent,
        metadata=meta,
    )
