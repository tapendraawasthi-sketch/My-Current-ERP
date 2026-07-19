"""MAI-31 — EventFrame → existing domain port mapping (annotation only).

Slice 1: declare port / draft-entrypoint / field-binding candidates from
EventFrame. Never calls mode_aware, khata start_or_merge_*, Dexie, or journal
math. Slice 2: consume helpers build draft payload candidates (PAYLOAD_ONLY);
still never executes ports on the annotation path.
"""

from __future__ import annotations

from typing import Any

from ....contracts.domain_port_mapping import (
    DomainPortFieldBindingV1,
    DomainPortMappingBundleV1,
    DomainPortMappingCandidateV1,
    DomainPortMappingStatus,
    DomainPortSupportStatus,
)
from ....contracts.event_frame import FrameStatus
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-31.0.2-slice2"
AUTHORITY = "ADR_0048"

# Annotation table only — names of existing draft entrypoints; not invoked here.
_PORT_TABLE: dict[str, dict[str, Any]] = {
    "purchase": {
        "port_id": "purchase_draft_port",
        "entrypoint": "start_or_merge_purchase",
        "bindings": (
            ("party", "supplier", True),
            ("amount", "total_amount", True),
            ("item", "item_name", False),
            ("payment_mode", "payment_mode", False),
            ("date", "voucher_date", False),
        ),
    },
    "sales": {
        "port_id": "sales_draft_port",
        "entrypoint": "start_or_merge_sale",
        "bindings": (
            ("party", "customer", True),
            ("amount", "total_amount", True),
            ("item", "item_name", False),
            ("payment_mode", "payment_mode", False),
            ("date", "voucher_date", False),
        ),
    },
    "sales_return": {
        "port_id": "sales_return_draft_port",
        "entrypoint": "start_or_merge_return",
        "bindings": (
            ("party", "customer", True),
            ("amount", "total_amount", True),
            ("original_invoice", "original_invoice", False),
            ("date", "voucher_date", False),
        ),
    },
    "customer_receipt": {
        "port_id": "financial_draft_port",
        "entrypoint": "start_or_merge_financial",
        "bindings": (
            ("party", "party", True),
            ("amount", "amount", True),
            ("payment_mode", "payment_mode", False),
            ("date", "voucher_date", False),
        ),
    },
    "supplier_payment": {
        "port_id": "financial_draft_port",
        "entrypoint": "start_or_merge_financial",
        "bindings": (
            ("party", "party", True),
            ("amount", "amount", True),
            ("payment_mode", "payment_mode", False),
            ("date", "voucher_date", False),
        ),
    },
    "cash_to_bank": {
        "port_id": "financial_draft_port",
        "entrypoint": "start_or_merge_financial",
        "bindings": (
            ("amount", "amount", True),
            ("from_account", "from_account", False),
            ("to_account", "to_account", False),
            ("date", "voucher_date", False),
        ),
    },
    "general_journal": {
        "port_id": "financial_draft_port",
        "entrypoint": "start_or_merge_financial",
        "bindings": (
            ("debit_account", "debit_account", True),
            ("credit_account", "credit_account", True),
            ("amount", "amount", True),
            ("narration", "narration", False),
            ("date", "voucher_date", False),
        ),
    },
}

_READ_ONLY_TYPES = frozenset(
    {
        "report",
        "erp_query",
        "ledger_balance_query",
        "dialogue",
        "accounting_qa",
        "master_data",
        "unknown",
        "transaction",
    }
)

_KNOWN_UNSUPPORTED = frozenset(
    {
        "purchase_return",
        "bank_recon",
    }
)


def _bindings_for(event_type: str) -> tuple[DomainPortFieldBindingV1, ...]:
    row = _PORT_TABLE.get(event_type) or {}
    out: list[DomainPortFieldBindingV1] = []
    for event_field, draft_field, required in row.get("bindings") or ():
        out.append(
            DomainPortFieldBindingV1(
                event_field=event_field,
                draft_field=draft_field,
                required=bool(required),
                reason_codes=("ANNOTATION_FIELD_MAP",),
            )
        )
    return tuple(out)


def build_domain_port_mapping_bundle(
    request: CanonicalAIRequestV1,
) -> DomainPortMappingBundleV1:
    frame = request.event_frame
    if frame is None:
        return DomainPortMappingBundleV1(
            analysis_status=DomainPortMappingStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            support_status=DomainPortSupportStatus.NOT_APPLICABLE,
            reason_codes=("NO_EVENT_FRAME",),
            warnings=("NO_EVENT_FRAME",),
        )

    event_type = (frame.event_type or "unknown").strip() or "unknown"
    reasons: list[str] = ["EVENT_FRAME_PRESENT", "PORT_NOT_EXECUTED", "DRAFTS_NOT_MUTATED"]
    warnings: list[str] = ["ANNOTATION_ONLY_NO_MODE_AWARE"]

    if frame.status in {FrameStatus.NOT_RUN, FrameStatus.EMPTY} and event_type == "unknown":
        return DomainPortMappingBundleV1(
            analysis_status=DomainPortMappingStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            support_status=DomainPortSupportStatus.NOT_APPLICABLE,
            event_type=event_type,
            reason_codes=("EVENT_FRAME_EMPTY_OR_UNKNOWN",),
            warnings=("NO_DRAFT_PORT_FOR_EMPTY_FRAME",),
        )

    if event_type in _READ_ONLY_TYPES:
        return DomainPortMappingBundleV1(
            analysis_status=DomainPortMappingStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            support_status=DomainPortSupportStatus.NOT_APPLICABLE,
            event_type=event_type,
            reason_codes=("READ_ONLY_OR_NON_DRAFT_EVENT", f"EVENT_TYPE_{event_type}"),
            warnings=("NO_DRAFT_PORT_FOR_READ_PATH",),
        )

    if event_type in _KNOWN_UNSUPPORTED or event_type not in _PORT_TABLE:
        return DomainPortMappingBundleV1(
            analysis_status=DomainPortMappingStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            support_status=DomainPortSupportStatus.UNSUPPORTED,
            event_type=event_type,
            reason_codes=tuple(reasons + ["UNMAPPED_EVENT_TYPE", f"EVENT_TYPE_{event_type}"]),
            warnings=tuple(warnings + ["UNSUPPORTED_MAPPING_FAIL_CLOSED"]),
        )

    row = _PORT_TABLE[event_type]
    bindings = _bindings_for(event_type)
    missing = tuple(frame.missing_required_fields or ())
    support = DomainPortSupportStatus.SUPPORTED
    if missing:
        support = DomainPortSupportStatus.INCOMPLETE
        reasons.append("MISSING_REQUIRED_FIELDS")
        warnings.append("BLOCK_OR_CLARIFY_BEFORE_CONSUME")
    else:
        reasons.append("MAPPING_SUPPORTED")

    candidate = DomainPortMappingCandidateV1(
        candidate_id="c-0001",
        port_id=row["port_id"],
        draft_entrypoint=row["entrypoint"],
        event_type=event_type,
        support_status=support,
        field_bindings=bindings,
        reason_codes=("SEED_PORT_TABLE",),
    )

    return DomainPortMappingBundleV1(
        analysis_status=DomainPortMappingStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        support_status=support,
        selected_port_id=row["port_id"],
        selected_draft_entrypoint=row["entrypoint"],
        event_type=event_type,
        candidates=(candidate,),
        field_bindings=bindings,
        reason_codes=tuple(reasons),
        warnings=tuple(warnings),
    )


def attach_domain_port_mapping_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_domain_port_mapping_bundle(request)
    return request.model_copy(update={"domain_port_mapping_bundle": bundle})


def assert_domain_port_mapping_authority(
    bundle: DomainPortMappingBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.port_executed
        or bundle.lookup_executed
        or bundle.dexie_invoked
        or bundle.journal_calculated
        or bundle.mode_aware_invoked
        or bundle.draft_mutations != 0
        or bundle.master_lookup_mode != "ANNOTATION_ONLY"
    ):
        raise RuntimeError("DOMAIN_PORT_MAPPING_AUTHORITY")


def domain_port_mapping_to_metadata(
    bundle: DomainPortMappingBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "support_status": bundle.support_status.value,
        "selected_port_id": bundle.selected_port_id,
        "selected_draft_entrypoint": bundle.selected_draft_entrypoint,
        "event_type": bundle.event_type,
        "candidate_count": len(bundle.candidates),
        "field_binding_count": len(bundle.field_bindings),
        "master_lookup_mode": "ANNOTATION_ONLY",
        "lookup_executed": False,
        "port_executed": False,
        "draft_mutations": 0,
        "dexie_invoked": False,
        "journal_calculated": False,
        "mode_aware_invoked": False,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
