# ADR_0064 — Human Review and Pilot Operations Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-47-HUMAN-REVIEW-AND-PILOT-OPERATIONS (slice 2)
- **Extends:** ADR_0001, ADR_0003

## Context

MAI-36–46 cover legal research through backup/restore/DR candidates.
Human review and pilot operations need an explicit candidate policy before any
review-complete claim, pilot approval, or go-live authorization.

## Decision

1. MAI-47 owns `HumanReviewPilotOperationsBundleV1` on
   `CanonicalAIRequestV1` after BACKUP_RESTORE_DISASTER_LIFECYCLE.
2. Semantic gate: cue detection only (human review / pilot ops / gold suite /
   reviewer sign-off / ops runbook / acceptance / go-live checklist) —
   **not** MAI-46 DR proven or prior production approvals.
3. Slice 1: declare
   `pilot_scope=HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `human_review_complete=false`,
   `pilot_approved=false`,
   `production_pilot_authorized=false`,
   `reviewer_signoff_proven=false`,
   `gold_suite_accepted=false`,
   `ops_runbook_live=false`,
   `acceptance_criteria_met=false`,
   `go_live_authorized=false`,
   `gap_p2_008_status=OPEN`.
4. Slice 2: consume builds `human_review_pilot_operations_candidate` /
   `human_review_pilot_operations_consume_ready` under default
   `CANDIDATE_ONLY`. Review packet, pilot ops plan, gold suite packet,
   signoff packet, ops runbook, acceptance packet, go-live packet, and
   definitive answer stay null. Live ingress forces
   `allow_reviewer_signoff=false` and `allow_go_live=false`. Label-only
   invoke modes exist for unit tests only.
5. Never invent review complete, pilot approval, or go-live authorization from
   cue detection alone.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-46 disaster_recovery_proven | DR must stay unproven |
| Claim human review complete in slice 1–2 | Professional reviewers required |
| Live reviewer sign-off / go-live in slice 2 | Authority / honesty risk |
| Auto-approve pilot / go-live | Owner acceptance / residual risk required |
| Close GAP-P2-008 / GAP-P0-001 | Honesty + security review still required |
| Production approval | Explicit production capability release is later |

## Related

- `docs/mokxya-ai/MAI_47_HUMAN_REVIEW_AND_PILOT_OPERATIONS.md`
- `docs/mokxya-ai/baselines/MAI_47_SLICE1_BASELINE_SUMMARY.md`
- `docs/mokxya-ai/baselines/MAI_47_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/human_review_pilot_operations_service.py`
- `erp_bot/src/oip/modules/conversation/application/human_review_pilot_operations_consume_service.py`
