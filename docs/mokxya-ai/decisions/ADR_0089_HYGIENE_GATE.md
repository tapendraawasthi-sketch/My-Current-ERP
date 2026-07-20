# ADR_0089 — Hygiene Gate (PR-B6 / NEXT-H1 / NEXT-H2 subset)

- **Status:** Accepted (2026-07-19)
- **Step:** PR-B6
- **Covers:** NEXT-H1 pytest baseline subset; NEXT-H2 TS debt freeze
- **Does not:** claim production_approved or clear PR-B1/B3/B5 staging tickets

## Context

Production-ready engineering residuals (PR-B1…PR-B5) need a documented,
runnable hygiene gate so another engineer can re-run launch-critical honesty
pytest + Orbix vitest without vacuous greens, and so TypeScript debt is
frozen with an explicit baseline (InvoicePrint syntax no longer the sole
blocker).

## Decision

1. **Launch-critical pytest pack** is documented and scripted under
   `scripts/run_prod_ready_hygiene.*` / npm `test:prod-ready-honesty`.
2. **Orbix vitest pack** (maiNext*/maiPrB* + sales/purchase posting) is
   scripted via `test:prod-ready-orbix` with elevated timeout (no vacuous skip).
3. **Playwright launch slice** remains optional until secrets/browser cache
   available; documented in CI story (does not block PR-B6 DONE).
4. **TS debt freeze:** `InvoicePrint.tsx` historical syntax errors cleared;
   remaining `tsc --noEmit` diagnostics are inventory-frozen in
   `docs/typescript-baseline.md` + artifacts — no claim of full-project green.
5. **GAP-P1-005** stays REDUCED with documented collect/pass baseline;
   **GAP-P2-004** → REDUCED (InvoicePrint syntax fixed; residual tsc OPEN inventory).

## Rejected

| Alternative | Why |
|-------------|-----|
| Fix all project tsc errors in PR-B6 | Blast radius; out of hygiene-gate scope |
| Claim CI fully green including Playwright | Staging tickets / secrets still PENDING |
| Vacuous skip of posting tests | Forbidden by NEXT-H4 spirit |

## Related

- `docs/mokxya-ai/MAI_HYGIENE_GATE_REGISTRY.json`
- `artifacts/prod-ready-pr-b6/`
- `.github/workflows/prod-ready-hygiene.yml`
- `docs/typescript-baseline.md`
