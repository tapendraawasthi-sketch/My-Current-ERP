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

- [ ] Two-device or simulated conflict on a launch invoice/voucher
- [ ] Confirm conflict affordance appears (not auto-overwrite)
- [ ] Reconfirm completes; no dual silent apply
- [ ] Attach notes/screenshots under this folder

**Attestation status:** PENDING — staging exercise not completed.  
Chat token `approved b3` / invented OWNER_RESIDUAL from false arm `2e0b45aa` is **VOID** (see `OWNER_RESIDUAL_ACCEPTANCE_B3_001.md`).
