"""MAI-20 slice 1 — information-gain clarification plan from EventFrame.

Annotation only: ranks missing/ambiguous fields and drafts one question.
Does not mutate drafts, post, or become execution authority.
Consume/surface to the user is MAI-20 slice 2.
"""

from __future__ import annotations

from typing import Any

from ....contracts.clarification_plan import (
    ClarificationPlanBundleV1,
    ClarificationPlanStatus,
    ClarificationTargetKind,
    ClarificationTargetV1,
)
from ....contracts.event_frame import FrameStatus
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-20.0.1-slice1"
AUTHORITY = "ADR_0037"

# Higher information-gain first within each kind. Ambiguous always outranks
# missing required (disambiguation before inventing money/roles).
_FIELD_GAIN: dict[str, int] = {
    "quantity_candidate": 100,
    "amount": 90,
    "party": 80,
    "report_type": 85,
    "item": 50,
    "payment_mode": 40,
    "date": 30,
}

_QUESTIONS: dict[str, str] = {
    "amount": "कति रकम हो? (What is the amount?)",
    "party": "Party ko naam k ho? (Who is the party?)",
    "report_type": "Which report do you need (balance sheet, P&L, etc.)?",
    "item": "Which item?",
    "payment_mode": "Cash, bank, eSewa/Khalti, or credit?",
    "date": "What is the date?",
    "quantity_candidate": (
        "Is that a quantity or an amount? Please clarify with unit or Rs."
    ),
}


def _gain(field: str) -> int:
    return int(_FIELD_GAIN.get(field, 10))


def _question_for(field: str) -> str:
    return _QUESTIONS.get(field, f"Please provide {field}.")


def build_clarification_plan_bundle(
    request: CanonicalAIRequestV1,
) -> ClarificationPlanBundleV1:
    frame = request.event_frame
    if frame is None:
        return ClarificationPlanBundleV1(
            analysis_status=ClarificationPlanStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            warnings=("NO_EVENT_FRAME",),
            silent_applications=0,
            draft_mutations=0,
        )

    missing = tuple(frame.missing_required_fields or ())
    ambiguous = tuple(frame.ambiguous_fields or ())
    frame_status = (
        frame.status.value if isinstance(frame.status, FrameStatus) else str(frame.status)
    )

    if frame.status == FrameStatus.COMPLETE and not ambiguous:
        return ClarificationPlanBundleV1(
            analysis_status=ClarificationPlanStatus.NOT_NEEDED,
            runtime_version=RUNTIME_VERSION,
            event_type=frame.event_type,
            frame_status=frame_status,
            remaining_missing_required=(),
            remaining_ambiguous=(),
            silent_applications=0,
            draft_mutations=0,
        )

    if frame.event_type in {"unknown", "dialogue", "accounting_qa"} and not missing:
        return ClarificationPlanBundleV1(
            analysis_status=ClarificationPlanStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            event_type=frame.event_type,
            frame_status=frame_status,
            remaining_missing_required=missing,
            remaining_ambiguous=ambiguous,
            warnings=("NON_TRANSACTION_FRAME",),
            silent_applications=0,
            draft_mutations=0,
        )

    if not missing and not ambiguous:
        return ClarificationPlanBundleV1(
            analysis_status=ClarificationPlanStatus.NOT_NEEDED,
            runtime_version=RUNTIME_VERSION,
            event_type=frame.event_type,
            frame_status=frame_status,
            silent_applications=0,
            draft_mutations=0,
        )

    ranked: list[tuple[int, ClarificationTargetV1]] = []
    for field in ambiguous:
        ranked.append(
            (
                1000 + _gain(field),
                ClarificationTargetV1(
                    field_name=field,
                    kind=ClarificationTargetKind.AMBIGUOUS,
                    information_gain_rank=1,
                    reason_codes=("AMBIGUOUS_FIELD", "INFO_GAIN"),
                ),
            )
        )
    for field in missing:
        ranked.append(
            (
                _gain(field),
                ClarificationTargetV1(
                    field_name=field,
                    kind=ClarificationTargetKind.MISSING_REQUIRED,
                    information_gain_rank=1,
                    reason_codes=("MISSING_REQUIRED", "INFO_GAIN"),
                ),
            )
        )

    ranked.sort(key=lambda x: (-x[0], x[1].field_name))
    targets: list[ClarificationTargetV1] = []
    for i, (_, t) in enumerate(ranked, start=1):
        targets.append(t.model_copy(update={"information_gain_rank": i}))

    primary = targets[0].field_name if targets else None
    question = _question_for(primary) if primary else None

    return ClarificationPlanBundleV1(
        analysis_status=ClarificationPlanStatus.ASK,
        runtime_version=RUNTIME_VERSION,
        event_type=frame.event_type,
        frame_status=frame_status,
        targets=tuple(targets),
        primary_field=primary,
        question_text=question,
        remaining_missing_required=missing,
        remaining_ambiguous=ambiguous,
        silent_applications=0,
        draft_mutations=0,
    )


def attach_clarification_plan_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_clarification_plan_bundle(request)
    return request.model_copy(update={"clarification_plan_bundle": bundle})


def clarification_plan_to_metadata(
    bundle: ClarificationPlanBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "event_type": bundle.event_type,
        "frame_status": bundle.frame_status,
        "primary_field": bundle.primary_field,
        "question_text": bundle.question_text,
        "target_count": len(bundle.targets),
        "targets": [
            {
                "field_name": t.field_name,
                "kind": t.kind.value,
                "information_gain_rank": t.information_gain_rank,
                "reason_codes": list(t.reason_codes),
            }
            for t in bundle.targets
        ],
        "remaining_missing_required": list(bundle.remaining_missing_required),
        "remaining_ambiguous": list(bundle.remaining_ambiguous),
        "silent_applications": bundle.silent_applications,
        "draft_mutations": bundle.draft_mutations,
        "is_execution_authority": False,
    }


__all__ = [
    "AUTHORITY",
    "RUNTIME_VERSION",
    "attach_clarification_plan_to_request",
    "build_clarification_plan_bundle",
    "clarification_plan_to_metadata",
]
