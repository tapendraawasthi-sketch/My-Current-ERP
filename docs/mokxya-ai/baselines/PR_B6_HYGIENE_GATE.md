# PR-B6 — Hygiene Gate (NEXT-H1 / NEXT-H2 subset)

**Date:** 2026-07-19  
**Step:** PR-B6  
**ADR:** ADR_0089  

## Pytest collect/pass baseline (launch-critical)

| Pack | Command | Evidence |
|------|---------|----------|
| Honesty language_runtime (all) | `cd erp_bot && python -m pytest tests/oip/language_runtime/ --collect-only -q` | **1672** collected (2026-07-19) |
| Honesty NEXT/PR-B pack | `npm run test:prod-ready-honesty` | **99** passed (2026-07-19); no vacuous skip |

## TypeScript debt freeze

| Item | Status |
|------|--------|
| Historical `InvoicePrint.tsx` TS1005/TS1109 | **Cleared** (0 InvoicePrint hits in current `tsc`) |
| Full-project `npx tsc --noEmit` | Still red — inventory frozen in `docs/typescript-baseline.md` |
| Policy | No net-new errors on launch-touched Orbix/honesty files without updating inventory |

## CI story (runnable by another engineer)

1. `npm run test:prod-ready-honesty`
2. `npm run test:prod-ready-orbix` (testTimeout 30s)
3. Optional: `npm run test:e2e:orbix-launch-slice` when Playwright + secrets available
4. Or: `bash scripts/run_prod_ready_hygiene.sh` / GitHub Actions `prod-ready-hygiene.yml`

## Gaps

- **GAP-P1-005 = REDUCED** (pack documented; not full suite CLOSED)
- **GAP-P2-004 = REDUCED** (InvoicePrint syntax fixed; residual tsc inventory)

## Pointer

recommended_next_step → **PR-C1** (shipped package; active pointer now PR-C1-ARM)
