# Error budget & incident loop — launch rows V1

**Date:** 2026-07-20  
**Step:** PR-D1 / ADR_0097  
**Pack status:** **READY**  
**14-day stable claimed:** **false**

## 1. Purpose

Weekly review of launch AI monitoring so P0/P1 defects become hotfixes
with tests. Complements the operator runbook (ADR_0096).

## 2. Signals (minimum)

| Signal | P0 if… | P1 if… |
|--------|--------|--------|
| Confirm token denial rate | Spike blocks all confirms | Elevated but workarounds exist |
| `posting_failed` rate | Posts fail after confirm | Intermittent failures |
| Sync pending age | Queue never drains; data loss risk | Slow drain / backlog |
| Ask abstain rate | Sudden refuse storm on known-good asks | Gradual drift |
| Mode / launch-event restriction | Unexpected block of launch intents | Noise from out-of-set asks |
| Unexpected mutation attempt | Ask→post or NL-assent post path | Residual dual-writer probes |

Sources: Orbix/OIP traces, posting receipts, `eventSyncQueue` ages
(see release dossiers §Monitoring).

## 3. Weekly loop

1. **Collect** signal snapshots for the past 7 days (or since arm).
2. **Triage** new P0/P1; link to commits / tickets.
3. **Hotfix** P0 within 24h with regression test (no assertion weakening).
4. **Schedule** P1 into next continuum ship; do not widen launch set.
5. **Record** notes under `artifacts/prod-ready-pr-d1/weekly/` (local OK).
6. **Rollback** per runbook if P0 posting/sync cannot be contained.

## 4. Severity rules

- **P0:** AI posts wrong money/party, silent dual write, NL assent posts,
  sync shows Synced when queued, or confirm path fully down.
- **P1:** Language clarify failures, abstain over-refuse, badge wording,
  non-launch event noise.
- **Not incidents:** Known disclosed residuals (GAP REDUCED notes) unless
  they regress into silent wrong answers or posts.

## 5. Stability gate (future)

“Stable production” (plan acceptance) requires **14 consecutive days**
without P0 AI-posting incident on armed launch rows — **not claimed here**.

## 6. Pointers

| Doc | Path |
|-----|------|
| Operator runbook | `OPERATOR_RUNBOOK_LAUNCH_V1.md` |
| Day-0 smoke | `DAY0_PRODUCTION_SMOKE_V1.md` |
| Sales/purchase dossier | `LAUNCH_ACCOUNTANT_SALES_PURCHASE_V1.md` |
| Ask reports dossier | `LAUNCH_ASK_COMPANY_REPORTS_V1.md` |

## Explicit non-claims

- Not production_approved  
- Not 14-day stable  
- Not zero incidents proven  
- Not NEXT-20 DONE  
