# ADR_0063 — Backup, Restore, Disaster, and Data Lifecycle Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-46-BACKUP-RESTORE-DISASTER-AND-DATA-LIFECYCLE (slice 1)
- **Extends:** ADR_0001, ADR_0003

## Context

MAI-36–45 cover legal research through load/latency/failover candidates.
Backup/restore/disaster-recovery and data-lifecycle work needs an explicit
candidate policy before any DR-proven claim, silent purge, or production DR
approval.

## Decision

1. MAI-46 owns `BackupRestoreDisasterLifecycleBundleV1` on
   `CanonicalAIRequestV1` after LOAD_LATENCY_FAILOVER.
2. Semantic gate: cue detection only (backup/restore/DR/RPO-RTO/retention/
   archival/purge lifecycle) — **not** MAI-45 SLO pass or MAI-44 pen-test.
3. Slice 1: declare
   `pilot_scope=BACKUP_RESTORE_DISASTER_LIFECYCLE_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `backup_proven=false`,
   `restore_proven=false`,
   `disaster_recovery_proven=false`,
   `rpo_rto_proven=false`,
   `data_lifecycle_applied=false`,
   `retention_enforced=false`,
   `archival_proven=false`,
   `silent_purge_allowed=false`,
   `purge_executed=false`,
   `production_dr_approved=false`,
   `gap_p2_008_status=OPEN`.
4. Never invent DR proof, silent purge, or production DR approval from cue
   detection alone.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-45 pilot_slos_met | Perf SLOs must stay unmet |
| Claim DR proven in slice 1 | Restore drills / owner acceptance required |
| Silent purge under lifecycle | Fail-closed; explicit confirmation required |
| Production DR approval | Residual risk / RPO-RTO proof required |
| Close GAP-P2-008 | Honesty review still required |

## Related

- `docs/mokxya-ai/MAI_46_BACKUP_RESTORE_DISASTER_LIFECYCLE.md`
- `docs/mokxya-ai/baselines/MAI_46_SLICE1_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/backup_restore_disaster_lifecycle_service.py`
