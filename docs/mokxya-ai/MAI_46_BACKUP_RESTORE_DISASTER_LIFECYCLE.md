# MAI-46 — Backup, Restore, Disaster, and Data Lifecycle

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0063](decisions/ADR_0063_BACKUP_RESTORE_DISASTER_LIFECYCLE_AUTHORITY.md)  
**Runtime:** `mai-46.0.2-slice2` (engineering; not production-approved)

## Objective

Declare a candidate policy for backup/restore/disaster-recovery and data-
lifecycle topics (backup, restore, DR, RPO/RTO, retention, archival, purge)
without claiming DR proven, allowing silent purge, or production DR approval.

## Slice 1

1. Ingress `BACKUP_RESTORE_DISASTER_LIFECYCLE_*` after LOAD_LATENCY_FAILOVER
2. Semantic input: cue detection (not MAI-45 SLO / MAI-44 pen-test)
3. Scope: `BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `backup_proven=false`; `restore_proven=false`;
   `disaster_recovery_proven=false`; `silent_purge_allowed=false`;
   `production_dr_approved=false`
7. GAP-P2-008 OPEN

## Slice 2

1. `resolve_backup_restore_disaster_lifecycle_consume_mode` /
   `build_backup_restore_disaster_lifecycle_candidate`
2. Default `CANDIDATE_ONLY` — backup/restore/DR/retention/archival/purge
   plans / definitive = null
3. Fake DR claim → `BLOCKED`; non-pilot → `SKIP`
4. Live path forces `allow_dr_drill=false` / `allow_purge_apply=false`
5. Metadata: `backup_restore_disaster_lifecycle_consume_ready` +
   `backup_restore_disaster_lifecycle_candidate`

## Gates

| Case | Expect |
|------|--------|
| Backup / restore / DR / RPO-RTO / retention / archival / purge cues | COMPLETE → `CANDIDATE_ONLY` |
| Fake disaster_recovery_proven claim | `BLOCKED` |
| Purchase / VAT / perf-only without DR cues | SKIP |
| Any live path | never claim DR proven / never silent purge; gap OPEN |

## Non-goals

- Measured backup/restore/DR drills
- RPO/RTO met claim
- Silent purge / lifecycle apply
- Production DR approval
- Closing GAP-P2-008
