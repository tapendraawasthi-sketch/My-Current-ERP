# Conflict → reconfirm narrative (PR-B3)

**Policy:** `REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT` (ADR_0074 / ADR_0086)  
**Forbidden:** auto-overwrite of material conflicts  

## Product story (operator)

1. Device A posts a launch sales/purchase via Orbix Confirm (Dexie).
2. Badge shows **Waiting to sync** / pending (not Synced) until ack.
3. If Device B has a material conflicting edit before ack resolves:
   - UI surfaces **Conflict** (not silent merge).
   - Operator must **reconfirm** the intended version (or governed correction).
4. After remote acknowledgement with no conflict → badge may show **Synced**.

## Staging exercise checklist (TICKET-PR-B3-001)

- [x] Two-device or simulated conflict on a launch invoice/voucher — **engineering E2E** `e2e/orbix-launch-conflict.spec.ts` (2026-07-20)
- [x] Confirm conflict affordance appears (not auto-overwrite) — Device B queue `status=conflict` / `invoice_number_collision`; A invoice not applied onto B
- [x] Reconfirm completes; no dual silent apply — **engineering** `reconfirmMaterialConflict(abandon_conflicting_push)` + SyncStatusControl Reconfirm; E2E asserts `status=resolved`, local B kept, A not applied
- [x] Attach notes/screenshots under this folder — `artifacts/prod-ready-pr-b3/e2e/`

**Attestation status:** Engineering collision + reconfirm **PASS**; operator staging **PASS** (`OPERATOR_ATTESTATION_B3_001.md`, 2026-07-20 Proceed).  
Chat token `approved b3` / invented OWNER_RESIDUAL from false arm `2e0b45aa` remains **VOID** (superseded by dated attestation + evidence).

## Engineering evidence

| Item | Path |
|------|------|
| Spec | `e2e/orbix-launch-conflict.spec.ts` |
| API | `src/platform/sync/reconfirmMaterialConflict.ts` |
| UI | `src/components/shell/SyncStatusControl.tsx` (`sync-reconfirm-abandon`) |
| JSON | `artifacts/prod-ready-pr-b3/e2e/LAUNCH_PURCHASE_CONFLICT_EVIDENCE.json` |
| Log | `artifacts/prod-ready-pr-b3/e2e/playwright-launch-conflict.log` |
| Screenshot | `artifacts/prod-ready-pr-b3/e2e/device-b-after-conflict.png` |
| Screenshot | `artifacts/prod-ready-pr-b3/e2e/device-b-after-reconfirm.png` |
