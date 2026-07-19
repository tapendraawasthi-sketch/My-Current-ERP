# MAI-49 — Production Capability Release

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0066](decisions/ADR_0066_PRODUCTION_CAPABILITY_RELEASE_AUTHORITY.md)  
**Runtime:** `mai-49.0.1-slice1` (engineering; not production-approved)

## Objective

Declare a candidate policy for production capability release topics
(production release, capability checklist, residual risk, owner sign-off,
cutover/rollback plans, release gates) without claiming production approved,
capability released, or cutover authorized.

## Slice 1

1. Ingress `PRODUCTION_CAPABILITY_RELEASE_*` after
   GOVERNED_IMPROVEMENT_FINE_TUNING
2. Semantic input: cue detection (not MAI-48 apply / fine-tune)
3. Scope: `PRODUCTION_CAPABILITY_RELEASE_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `production_approved=false`; `production_capability_released=false`;
   `cutover_authorized=false`; `production_traffic_enabled=false`
7. GAP-P2-008 OPEN (and other open gaps remain open)

## Gates

| Case | Expect |
|------|--------|
| Production release / checklist / residual risk / owner / cutover / rollback / gate cues | COMPLETE → `POLICY_DECLARED` |
| Purchase / VAT / fine-tune-only without release cues | SKIP |
| Any live path | never claim production approved / never cutover; gaps OPEN |

## Non-goals

- Production approval
- Enabling production traffic
- Closing GAP-P2-008 or GAP-P0-001
- Auto-cutover
