# PR-B3 — Sync Honesty Residual (GAP-P1-002)

**Date:** 2026-07-19  
**Step:** PR-B3  
**ADR:** ADR_0086 (extends ADR_0074)  

## Proven (engineering)

| Claim | Evidence |
|-------|----------|
| Post-success pending ≠ Synced | `syncStatusPresentation` + ui6 / maiPrB3 tests |
| Aggregate pending ≠ Synced | `syncStatusAggregate` pendingCount gate + ui3 tests |
| Accounting → EVENT_SYNC_QUEUE only | `isAccountingEntitySyncBlocked` + noDoubleSync / maiNext04 |
| Conflict = reconfirm (policy) | ADR_0074 / ADR_0086; narrative doc |

## Staging / operator

| Row | Status |
|-----|--------|
| Connected sync green on staging URL | PENDING (see PR-B1 TICKET-PR-B1-002) |
| Conflict → reconfirm exercised once | PENDING (TICKET-PR-B3-001) |

## Residual dual badge

Aggregate may count legacy non-accounting outbox pending + event queue.
Documented exception; must not label Synced while pending > 0.
`syncCoordinator` not rewritten this step.

## Gap

- **GAP-P1-002 = REDUCED** (not CLOSED)
- Runtime dual OPEN

## Pointer

recommended_next_step → **PR-B4**
