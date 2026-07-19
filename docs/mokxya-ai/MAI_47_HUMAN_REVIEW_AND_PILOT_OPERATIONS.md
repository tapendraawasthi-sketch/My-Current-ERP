# MAI-47 — Human Review and Pilot Operations

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0064](decisions/ADR_0064_HUMAN_REVIEW_PILOT_OPERATIONS_AUTHORITY.md)  
**Runtime:** `mai-47.0.2-slice2` (engineering; not production-approved)

## Objective

Declare a candidate policy for human review and pilot-operations topics
(human/honesty review, pilot ops, gold suite, reviewer sign-off, ops runbook,
acceptance criteria, go-live checklist) without claiming review complete,
pilot approved, or go-live authorized.

## Slice 1

1. Ingress `HUMAN_REVIEW_PILOT_OPERATIONS_*` after
   BACKUP_RESTORE_DISASTER_LIFECYCLE
2. Semantic input: cue detection (not MAI-46 DR / prior approvals)
3. Scope: `HUMAN_REVIEW_PILOT_OPERATIONS_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `human_review_complete=false`; `pilot_approved=false`;
   `production_pilot_authorized=false`; `go_live_authorized=false`
7. GAP-P2-008 OPEN (and other open gaps remain open)

## Slice 2

1. `resolve_human_review_pilot_operations_consume_mode` /
   `build_human_review_pilot_operations_candidate`
2. Default `CANDIDATE_ONLY` — review / pilot / gold / signoff / runbook /
   acceptance / go-live packets / definitive = null
3. Fake review-complete claim → `BLOCKED`; non-pilot → `SKIP`
4. Live path forces `allow_reviewer_signoff=false` / `allow_go_live=false`
5. Metadata: `human_review_pilot_operations_consume_ready` +
   `human_review_pilot_operations_candidate`

## Gates

| Case | Expect |
|------|--------|
| Human review / pilot ops / gold / sign-off / runbook / acceptance / go-live cues | COMPLETE → `CANDIDATE_ONLY` |
| Fake human_review_complete claim | `BLOCKED` |
| Purchase / VAT / DR-only without review cues | SKIP |
| Any live path | never claim review complete / never authorize go-live; gaps OPEN |

## Non-goals

- Completing professional human review
- Accepting gold suite / signing reviewers
- Live pilot ops / go-live authorization
- Closing GAP-P2-008 or GAP-P0-001
- Production capability release
