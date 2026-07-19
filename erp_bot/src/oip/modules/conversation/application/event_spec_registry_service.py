"""MAI-18 — event specification registry + EventFrame skeleton.

Slice 1: deterministic lookup from MAI-17 router keys.
Slice 2: project selected spec into EventFrame skeleton (missing required
fields only; no value extraction). Never posts, never merges drafts,
never grants execution authority. MAI-19 owns structured extraction.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from ....contracts.event_frame import EventFrameV1, FrameStatus, LifecycleState
from ....contracts.event_spec_registry import (
    EventSpecAnalysisStatus,
    EventSpecCandidateV1,
    EventSpecRegistryBundleV1,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-18.0.2-slice2"


@dataclass(frozen=True)
class _SpecDef:
    spec_id: str
    event_type: str
    intent_family: str
    operation_class: str | None
    intent_hint: str | None
    required_fields: tuple[str, ...]
    optional_fields: tuple[str, ...] = ()
    prohibited_assumptions: tuple[str, ...] = (
        "DO_NOT_INVENT_AMOUNTS",
        "DO_NOT_ASSUME_PARTY",
    )


_SPECS: tuple[_SpecDef, ...] = (
    _SpecDef(
        "purchase_v1",
        "purchase",
        "TRANSACTION",
        "transaction_create",
        "purchase_entry",
        ("party", "amount"),
        ("payment_mode", "item", "date"),
    ),
    _SpecDef(
        "sales_v1",
        "sales",
        "TRANSACTION",
        "transaction_create",
        "sales_entry",
        ("party", "amount"),
        ("payment_mode", "item", "date"),
    ),
    _SpecDef(
        "sales_return_v1",
        "sales_return",
        "TRANSACTION",
        "transaction_create",
        "sales_return_entry",
        ("party", "amount"),
        ("original_invoice", "date"),
    ),
    _SpecDef(
        "customer_receipt_v1",
        "customer_receipt",
        "TRANSACTION",
        "transaction_create",
        "customer_receipt",
        ("party", "amount"),
        ("payment_mode", "date"),
    ),
    _SpecDef(
        "supplier_payment_v1",
        "supplier_payment",
        "TRANSACTION",
        "transaction_create",
        "supplier_payment",
        ("party", "amount"),
        ("payment_mode", "date"),
    ),
    _SpecDef(
        "cash_to_bank_v1",
        "cash_to_bank",
        "TRANSACTION",
        "transaction_create",
        "cash_to_bank",
        ("amount",),
        ("from_account", "to_account", "date"),
    ),
    _SpecDef(
        "general_journal_v1",
        "general_journal",
        "TRANSACTION",
        "transaction_create",
        "general_journal",
        ("debit_account", "credit_account", "amount"),
        ("narration", "date"),
    ),
    _SpecDef(
        "transaction_create_v1",
        "transaction",
        "TRANSACTION",
        "transaction_create",
        None,
        ("amount",),
        ("party", "payment_mode", "date"),
    ),
    _SpecDef(
        "report_v1",
        "report",
        "REPORT",
        "report_request",
        "report_generation",
        ("report_type",),
        ("period", "company_id"),
        ("DO_NOT_MUTATE_LEDGER",),
    ),
    _SpecDef(
        "report_follow_up_v1",
        "report",
        "REPORT",
        "report_follow_up",
        "report_follow_up",
        (),
        ("report_type", "period"),
        ("DO_NOT_MUTATE_LEDGER",),
    ),
    _SpecDef(
        "erp_query_v1",
        "erp_query",
        "QUERY",
        "erp_data_query",
        "erp_query",
        (),
        ("party", "metric"),
        ("DO_NOT_MUTATE_LEDGER",),
    ),
    _SpecDef(
        "ledger_balance_v1",
        "ledger_balance_query",
        "QUERY",
        "erp_data_query",
        "ledger_balance_query",
        ("party",),
        ("as_of_date",),
        ("DO_NOT_MUTATE_LEDGER",),
    ),
    _SpecDef(
        "master_create_v1",
        "master_data",
        "MASTER",
        "master_data_create",
        "master_create",
        ("entity_type", "name"),
        (),
    ),
    _SpecDef(
        "accounting_qa_v1",
        "accounting_qa",
        "QA",
        "accounting_question",
        "accounting_qa",
        (),
        ("topic",),
        ("DO_NOT_MUTATE_LEDGER", "DO_NOT_CREATE_DRAFT"),
    ),
    _SpecDef(
        "dialogue_noop_v1",
        "dialogue",
        "CLARIFY",
        "clarification_reply",
        None,
        (),
        (),
        ("DO_NOT_CREATE_DRAFT",),
    ),
    _SpecDef(
        "confirm_v1",
        "dialogue",
        "CONFIRM",
        "confirmation",
        "confirm",
        (),
        (),
        ("CONFIRMATION_IS_NOT_EXECUTION_AUTHORITY",),
    ),
    _SpecDef(
        "cancel_v1",
        "dialogue",
        "CANCEL",
        "cancellation",
        "cancel",
        (),
        (),
        ("DO_NOT_POST",),
    ),
    _SpecDef(
        "unknown_v1",
        "unknown",
        "UNKNOWN",
        None,
        None,
        (),
        (),
        ("DO_NOT_MUTATE_LEDGER", "DO_NOT_CREATE_DRAFT"),
    ),
)


def _rank(spec: _SpecDef, family: str, op: str | None, hint: str | None) -> tuple[int, tuple[str, ...]] | None:
    reasons: list[str] = []
    if (
        hint
        and spec.intent_hint
        and hint == spec.intent_hint
        and family == spec.intent_family
        and (spec.operation_class is None or op == spec.operation_class)
    ):
        reasons.append("EXACT_FAMILY_OP_HINT")
        return 100, tuple(reasons)
    if (
        family == spec.intent_family
        and spec.operation_class
        and op == spec.operation_class
        and spec.intent_hint is None
    ):
        reasons.append("FAMILY_OP_WILDCARD_HINT")
        return 80, tuple(reasons)
    if (
        hint
        and spec.intent_hint
        and hint == spec.intent_hint
        and family == spec.intent_family
    ):
        reasons.append("FAMILY_HINT")
        return 70, tuple(reasons)
    if family == spec.intent_family and spec.spec_id.endswith("_v1") and spec.event_type in {
        "dialogue",
        "unknown",
        "accounting_qa",
        "report",
        "erp_query",
    }:
        # Soft family fallback for non-txn families only when op matches or is None.
        if spec.operation_class is None or op == spec.operation_class:
            reasons.append("FAMILY_SOFT")
            return 40, tuple(reasons)
    return None


def build_event_spec_registry_bundle(
    request: CanonicalAIRequestV1,
) -> EventSpecRegistryBundleV1:
    warnings: list[str] = []
    rd = request.router_decision_bundle
    if rd is None:
        warnings.append("ROUTER_DECISION_ABSENT")
        unknown = _SPECS[-1]
        cand = EventSpecCandidateV1(
            spec_id=unknown.spec_id,
            event_type=unknown.event_type,
            intent_family=unknown.intent_family,
            required_fields=unknown.required_fields,
            optional_fields=unknown.optional_fields,
            prohibited_assumptions=unknown.prohibited_assumptions,
            match_rank=1,
            match_reason_codes=("NO_ROUTER",),
            selected=True,
        )
        return EventSpecRegistryBundleV1(
            analysis_status=EventSpecAnalysisStatus.PARTIAL,
            runtime_version=RUNTIME_VERSION,
            candidates=(cand,),
            selected_spec_id=unknown.spec_id,
            lookup_keys={},
            warnings=tuple(warnings),
        )

    family = rd.intent_family.value
    op = rd.operation_class
    hint = rd.intent_hint
    ood_abstain = bool(rd.ood.abstain_recommended)

    lookup_keys = {
        "intent_family": family,
        "operation_class": op,
        "intent_hint": hint,
    }

    if ood_abstain or family == "UNKNOWN":
        unknown = next(s for s in _SPECS if s.spec_id == "unknown_v1")
        cand = EventSpecCandidateV1(
            spec_id=unknown.spec_id,
            event_type=unknown.event_type,
            intent_family=family if family != "UNKNOWN" else "UNKNOWN",
            operation_class=op,
            intent_hint=hint,
            required_fields=unknown.required_fields,
            optional_fields=unknown.optional_fields,
            prohibited_assumptions=unknown.prohibited_assumptions,
            match_rank=1,
            match_reason_codes=(
                ("OOD_ABSTAIN",) if ood_abstain else ("FAMILY_UNKNOWN",)
            ),
            selected=True,
        )
        return EventSpecRegistryBundleV1(
            analysis_status=EventSpecAnalysisStatus.UNKNOWN
            if family == "UNKNOWN"
            else EventSpecAnalysisStatus.PARTIAL,
            runtime_version=RUNTIME_VERSION,
            candidates=(cand,),
            selected_spec_id=unknown.spec_id,
            lookup_keys=lookup_keys,
            warnings=tuple(warnings + (["OOD_ABSTAIN"] if ood_abstain else [])),
        )

    ranked: list[tuple[int, _SpecDef, tuple[str, ...]]] = []
    for spec in _SPECS:
        if spec.spec_id == "unknown_v1":
            continue
        hit = _rank(spec, family, op, hint)
        if hit is None:
            continue
        rank, reasons = hit
        ranked.append((rank, spec, reasons))

    ranked.sort(key=lambda x: (-x[0], x[1].spec_id))
    if not ranked:
        unknown = next(s for s in _SPECS if s.spec_id == "unknown_v1")
        cand = EventSpecCandidateV1(
            spec_id=unknown.spec_id,
            event_type=unknown.event_type,
            intent_family=family,
            operation_class=op,
            intent_hint=hint,
            prohibited_assumptions=unknown.prohibited_assumptions,
            match_rank=1,
            match_reason_codes=("NO_SPEC_MATCH",),
            selected=True,
        )
        return EventSpecRegistryBundleV1(
            analysis_status=EventSpecAnalysisStatus.PARTIAL,
            runtime_version=RUNTIME_VERSION,
            candidates=(cand,),
            selected_spec_id=unknown.spec_id,
            lookup_keys=lookup_keys,
            warnings=tuple(warnings + ["NO_SPEC_MATCH"]),
        )

    candidates: list[EventSpecCandidateV1] = []
    for i, (rank, spec, reasons) in enumerate(ranked[:5]):
        candidates.append(
            EventSpecCandidateV1(
                spec_id=spec.spec_id,
                event_type=spec.event_type,
                intent_family=spec.intent_family,
                operation_class=spec.operation_class,
                intent_hint=spec.intent_hint,
                required_fields=spec.required_fields,
                optional_fields=spec.optional_fields,
                prohibited_assumptions=spec.prohibited_assumptions,
                match_rank=rank,
                match_reason_codes=reasons,
                selected=(i == 0),
            )
        )

    return EventSpecRegistryBundleV1(
        analysis_status=EventSpecAnalysisStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        candidates=tuple(candidates),
        selected_spec_id=candidates[0].spec_id,
        lookup_keys=lookup_keys,
        warnings=tuple(warnings),
    )


def _selected_candidate(
    bundle: EventSpecRegistryBundleV1 | None,
) -> EventSpecCandidateV1 | None:
    if bundle is None:
        return None
    for c in bundle.candidates:
        if c.selected:
            return c
    if bundle.selected_spec_id:
        for c in bundle.candidates:
            if c.spec_id == bundle.selected_spec_id:
                return c
    return bundle.candidates[0] if bundle.candidates else None


def build_event_frame_skeleton(
    request: CanonicalAIRequestV1,
    *,
    registry: EventSpecRegistryBundleV1 | None = None,
) -> EventFrameV1:
    """Build EMPTY/PARTIAL EventFrame from selected spec — no value extraction."""
    bundle = registry or request.event_spec_registry_bundle
    selected = _selected_candidate(bundle)
    if selected is None:
        return EventFrameV1(
            frame_id=f"ef-{uuid.uuid4().hex[:12]}",
            event_type="unknown",
            lifecycle_state=LifecycleState.UNKNOWN,
            missing_required_fields=(),
            prohibited_assumptions=(
                "DO_NOT_MUTATE_LEDGER",
                "DO_NOT_CREATE_DRAFT",
            ),
            ontology_version="mai-18-unknown",
            status=FrameStatus.EMPTY,
            inherited_context={
                "source": "MAI18_EVENT_SPEC_SKELETON",
                "runtime_version": RUNTIME_VERSION,
                "selected_spec_id": None,
            },
        )

    missing = tuple(selected.required_fields)
    if selected.event_type in {"unknown", "dialogue", "accounting_qa"} and not missing:
        status = FrameStatus.EMPTY
    elif missing:
        status = FrameStatus.PARTIAL
    else:
        status = FrameStatus.EMPTY

    return EventFrameV1(
        frame_id=f"ef-{uuid.uuid4().hex[:12]}",
        event_type=selected.event_type or "unknown",
        lifecycle_state=LifecycleState.UNKNOWN,
        missing_required_fields=missing,
        prohibited_assumptions=tuple(selected.prohibited_assumptions),
        ontology_version=selected.spec_id,
        status=status,
        inferred_candidates=(),
        explicit_values=(),
        inherited_context={
            "source": "MAI18_EVENT_SPEC_SKELETON",
            "runtime_version": RUNTIME_VERSION,
            "selected_spec_id": selected.spec_id,
            "intent_family": selected.intent_family,
            "intent_hint": selected.intent_hint,
            "optional_fields": list(selected.optional_fields),
            "request_id": request.request_id,
        },
    )


def attach_event_spec_registry_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_event_spec_registry_bundle(request)
    frame = build_event_frame_skeleton(request, registry=bundle)
    return request.model_copy(
        update={
            "event_spec_registry_bundle": bundle,
            "event_frame": frame,
        }
    )


def event_spec_registry_to_metadata(
    bundle: EventSpecRegistryBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "selected_spec_id": bundle.selected_spec_id,
        "lookup_keys": dict(bundle.lookup_keys or {}),
        "candidate_count": len(bundle.candidates),
        "silent_applications": bundle.silent_applications,
        "draft_mutations": bundle.draft_mutations,
        "is_execution_authority": False,
        "candidates": [
            {
                "spec_id": c.spec_id,
                "event_type": c.event_type,
                "intent_family": c.intent_family,
                "intent_hint": c.intent_hint,
                "required_fields": list(c.required_fields),
                "match_rank": c.match_rank,
                "selected": c.selected,
            }
            for c in bundle.candidates
        ],
    }


def event_frame_to_metadata(frame: EventFrameV1 | None) -> dict[str, Any]:
    if frame is None:
        return {}
    return {
        "frame_id": frame.frame_id,
        "event_type": frame.event_type,
        "status": frame.status.value,
        "missing_required_fields": list(frame.missing_required_fields),
        "prohibited_assumptions": list(frame.prohibited_assumptions),
        "ontology_version": frame.ontology_version,
        "selected_spec_id": (frame.inherited_context or {}).get("selected_spec_id"),
        "runtime_version": (frame.inherited_context or {}).get("runtime_version"),
        "authorizes_posting": False,
        "value_count": len(frame.values),
        "explicit_value_count": len(frame.explicit_values),
    }
