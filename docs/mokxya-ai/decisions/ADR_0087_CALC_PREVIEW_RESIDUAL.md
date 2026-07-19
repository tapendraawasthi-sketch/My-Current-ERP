# ADR_0087 — Calc / Preview Residual (PR-B4 / GAP-P2-002)

- **Status:** Accepted (2026-07-19)
- **Step:** PR-B4
- **Extends:** ADR_0078 calc authority honesty
- **Gap:** GAP-P2-002 remains **REDUCED** (not CLOSED)

## Context

NEXT-11 labeled invoice form and Orbix confirm totals as non-authoritative and
declared Dexie domain engines as confirm/post calc owners. Residual work is to
prove labels stay wired to policy constants and that launch item fixtures show
zero paisa drift between UI display estimate and posted ledger grand total —
without claiming CLOSED while voucherSlice dual-calc display estimates remain.

## Decision

1. **Confirm/post calc owner** remains `DEXIE_DOMAIN_ENGINE` (unchanged).
2. **Invoice form + Orbix card** must render `INVOICE_FORM_TOTALS_DISCLAIMER` /
   `ORBIX_CONFIRM_PREVIEW_*` from `calcAuthorityPolicy` (no unlabeled
   “authoritative” totals).
3. **Spot-check** three launch fixtures (sale cash untaxed, purchase cash,
   sale VAT exclusive): display estimate vs posted ledger paisa drift = 0.
4. **GAP-P2-002** stays **REDUCED**; `gap_p2_002_closed=false`;
   `production_approved=false`.
5. Do not thrash voucherSlice / dual writers in this step.

## Rejected

| Alternative | Why |
|-------------|-----|
| Mark GAP-P2-002 CLOSED | Display estimates + dual-calc residual remain |
| Treat UI totals as ledger authority | Violates ADR_0078 |
| Rewrite voucherSlice now | Out of PR-B4 scope |

## Related

- `docs/mokxya-ai/MAI_CALC_PREVIEW_RESIDUAL_REGISTRY.json`
- `docs/mokxya-ai/MAI_CALC_AUTHORITY_REGISTRY.json`
- `artifacts/prod-ready-pr-b4/`
- `src/platform/calc/calcPreviewResidualPolicy.ts`
