# PR-B4 — Calc / Preview Residual (GAP-P2-002)

**Date:** 2026-07-19  
**Step:** PR-B4  
**ADR:** ADR_0087 (extends ADR_0078)  

## Proven (engineering)

| Claim | Evidence |
|-------|----------|
| Invoice form labeled non-authoritative | `INVOICE_FORM_TOTALS_DISCLAIMER` wired in SalesInvoiceForm |
| Orbix card labeled confirm preview | `ORBIX_CONFIRM_PREVIEW_*` wired in OrbixJournalCard |
| Confirm/post owner = Dexie domain | ADR_0078 / ADR_0087 unchanged |
| 3 launch fixtures 0 paisa drift | `maiPrB4CalcPreviewResidual.test.ts` + PAISA_SPOTCHECK.md |

## Gap

- **GAP-P2-002 = REDUCED** (not CLOSED)
- UI display estimates + voucherSlice dual-calc residual remain
- Runtime OPEN

## Pointer

recommended_next_step → **PR-B5** (shipped; active pointer now PR-B6)
