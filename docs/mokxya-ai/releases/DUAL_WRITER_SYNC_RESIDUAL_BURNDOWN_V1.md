# Dual-writer / sync residual burn-down — V1

**Date:** 2026-07-20  
**Step:** PR-D3 / ADR_0099  
**Pack status:** **READY**  
**GAP-P0-001 / GAP-P1-002:** still **REDUCED** (not CLOSED)

## 1. Purpose

Schedule work to move dual-writer and dual-sync residuals toward CLOSED
after launch, without silently reintroducing second writers on the AI
launch path.

## 2. Current honest state

| Gap | Status | Product truth |
|-----|--------|---------------|
| GAP-P0-001 | REDUCED | Dexie `executeOrbixConfirm` product path; Node/OEC launch hard-deny (ADR_0085); `oec_sole=false` |
| GAP-P1-002 | REDUCED | EVENT_SYNC_QUEUE authority; queued ≠ synced; conflict → reconfirm (ADR_0086) |

## 3. Burn-down schedule (ordered)

### Phase A — Guardrails (already landed; keep green)

1. Launch-marked Node/OEC writers stay hard-denied.
2. Honesty tests forbid `oec_sole=true` and false `gap_*_closed`.
3. Sync badge must not label queued as Synced.

### Phase B — Inventory (next engineering windows)

1. List remaining non-launch write entrypoints that can touch accounting.
2. List residual legacy outbox / aggregate badge paths.
3. File paths under `artifacts/prod-ready-pr-d3/inventory/` (local OK).

### Phase C — Convergence (after arm + stable)

1. Prefer strangler tickets over big-bang OEC sole claim.
2. One accounting sync write→ack narrative; retire silent dual enqueue.
3. Close gaps only with tests + owner note — never by deleting honesty flags.

## 4. Forbidden during burn-down

- Silently re-enable Node/OEC launch posts
- Claim `oec_sole=true` while Dexie remains product path
- Label Waiting-to-sync as Synced
- Mark GAP-P0-001 / P1-002 CLOSED without acceptance evidence

## 5. Exit (future)

Gaps become CLOSED only when acceptance conditions in
`MAI_00_GAP_REGISTER.md` are met and registry honesty flips with evidence —
**not claimed in this ship**.

## Explicit non-claims

- Not GAP-P0-001 CLOSED  
- Not GAP-P1-002 CLOSED  
- Not production_approved  
- Not sole-OEC  
