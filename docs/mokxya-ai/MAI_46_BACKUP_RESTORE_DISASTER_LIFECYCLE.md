# MAI-46 — Backup, Restore, Disaster, and Data Lifecycle

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0063](decisions/ADR_0063_BACKUP_RESTORE_DISASTER_LIFECYCLE_AUTHORITY.md)  
**Runtime:** `mai-46.0.1-slice1` (engineering; not production-approved)

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

## Gates

| Case | Expect |
|------|--------|
| Backup / restore / DR / RPO-RTO / retention / archival / purge cues | COMPLETE → `POLICY_DECLARED` |
| Purchase / VAT / perf-only without DR cues | SKIP |
| Any live path | never claim DR proven / never silent purge; gap OPEN |

## Non-goals

- Measured backup/restore/DR drills
- RPO/RTO met claim
- Silent purge / lifecycle apply
- Production DR approval
- Closing GAP-P2-008
