# ADR_0066 — Production Capability Release Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-49-PRODUCTION-CAPABILITY-RELEASE (slice 1)
- **Extends:** ADR_0001, ADR_0003

## Context

MAI-36–48 cover legal research through governed-improvement candidates.
Production capability release needs an explicit candidate policy before any
production-approved claim, cutover authorization, or traffic enablement.

## Decision

1. MAI-49 owns `ProductionCapabilityReleaseBundleV1` on
   `CanonicalAIRequestV1` after GOVERNED_IMPROVEMENT_FINE_TUNING.
2. Semantic gate: cue detection only (production release / capability
   checklist / residual risk / owner sign-off / cutover / rollback / release
   gate) — **not** MAI-48 fine-tune apply or prior approvals.
3. Slice 1: declare
   `pilot_scope=PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `production_approved=false`,
   `production_capability_released=false`,
   `release_checklist_complete=false`,
   `residual_risk_accepted=false`,
   `owner_signoff_proven=false`,
   `cutover_authorized=false`,
   `rollback_proven=false`,
   `production_traffic_enabled=false`,
   `gap_p2_008_status=OPEN`.
4. Never invent production approval, cutover, or traffic enablement from cue
   detection alone.
5. Engineering-gated: ledger `production_approved=false` remains false.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-48 governed_change_approved | Change must stay unapproved |
| Claim production_approved in slice 1 | Owner acceptance + residual risk required |
| Enable production traffic from cues | Explicit multi-party release required |
| Close GAP-P2-008 / GAP-P0-001 | Honesty + security review still required |
| Auto-cutover | Rollback proof and owner sign-off required |

## Related

- `docs/mokxya-ai/MAI_49_PRODUCTION_CAPABILITY_RELEASE.md`
- `docs/mokxya-ai/baselines/MAI_49_SLICE1_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/production_capability_release_service.py`
