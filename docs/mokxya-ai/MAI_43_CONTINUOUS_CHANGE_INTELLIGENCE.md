# MAI-43 — Continuous Change Intelligence

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0060](decisions/ADR_0060_CONTINUOUS_CHANGE_INTELLIGENCE_AUTHORITY.md)  
**Runtime:** `mai-43.0.2-slice2` (engineering; not production-approved)

## Objective

Declare a candidate policy for continuous legal/regulatory change intelligence
(amendments, gazettes, circulars, notifications, ordinances, effective-date /
rate changes) without applying changes, treating unreviewed detections as
production truth, or proving effective dates.

## Slice 1

1. Ingress `CONTINUOUS_CHANGE_INTELLIGENCE_*` after JUDICIAL_DECISION_INTELLIGENCE
2. Semantic input: MAI-36 research mode COMPLETE + active (not MAI-42 case retrieve)
3. Scope: `CONTINUOUS_CHANGE_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `unreviewed_as_production_truth=false`; `cache_invalidated=false`;
   `change_applied=false`; `legal_effective_dates_proven=false`
7. GAP-P2-008 OPEN

## Slice 2

1. `resolve_continuous_change_consume_mode` / `build_continuous_change_candidate`
2. Default `CANDIDATE_ONLY` — change refs / impact / queue / cache / rollback / definitive null
3. Fake apply claim → `BLOCKED`; non-pilot → `SKIP`
4. Live path forces `allow_change_apply=false` / `allow_cache_invalidate=false`
5. Metadata: `continuous_change_consume_ready` + `continuous_change_candidate`

## Gates

| Case | Expect |
|------|--------|
| Amendment / gazette / circular / effective-date / rate cues | COMPLETE → `CANDIDATE_ONLY` |
| Fake change-applied claim | `BLOCKED` |
| VAT-only / purchase / court-only without change cues | SKIP |
| Any live path | never apply/invalidate as truth; GAP-P2-008 OPEN |

## Non-goals

- Applying amendments or rate changes
- Unreviewed detection as production truth
- Cache invalidation as live side-effect
- Proving effective dates
- Closing GAP-P2-008
- Production approval
