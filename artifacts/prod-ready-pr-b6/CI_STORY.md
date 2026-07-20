# PR-B6 — CI story (runnable by another engineer)

**Date:** 2026-07-19  
**ADR:** ADR_0089  

## Required (launch-critical)

```bash
# From repo root
npm run test:prod-ready-honesty
npm run test:prod-ready-orbix
```

Or one-shot:

```bash
bash scripts/run_prod_ready_hygiene.sh
# Windows:
pwsh scripts/run_prod_ready_hygiene.ps1
```

GitHub Actions: workflow **Prod-ready hygiene** (`.github/workflows/prod-ready-hygiene.yml`)
runs honesty pytest + Orbix vitest on path-relevant pushes/PRs.

## Optional (secrets / browser)

```bash
npx playwright install chromium
RUN_PLAYWRIGHT_LAUNCH_SLICE=1 bash scripts/run_prod_ready_hygiene.sh
# or
npm run test:e2e:orbix-launch-slice
```

Workflow dispatch input `run_playwright=true` enables the optional job.

## Explicit non-claims

- Full-project `npx tsc --noEmit` is **not** required green for this pack
  (inventory frozen; InvoicePrint syntax cleared).
- Playwright launch slice is **not** required for PR-B6 DONE.
- `production_approved` remains false; PR-B1/B3/B5 staging tickets still block PR-C.
