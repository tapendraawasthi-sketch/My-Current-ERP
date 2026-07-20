# TypeScript baseline (accepted debt)

Root command:

```bash
npx tsc --noEmit --pretty false
```

Config: `tsconfig.json` (`include: ["src"]`, `strict: false`).

| Snapshot | Commit / tree | Diagnostics | Exit | Notes |
|----------|---------------|------------:|-----:|-------|
| Pre-uncommitted Orbix tree | `753fc80e` | 127 | 2 | historical |
| Post Phase 6.5 typing fixes | working tree | 156 | 2 | historical |
| MAI-00 audit | MAI-00 | 2 (`InvoicePrint` TS1005/TS1109) | 2 | historical |
| **PR-B6 hygiene freeze (2026-07-19)** | PR-B6 / ADR_0089 | Inventory file | 2 | `InvoicePrint` **0** hits; residual projections/sync/store errors remain — see `artifacts/prod-ready-pr-b6/TSC_INVENTORY.txt` |

## PR-B6 freeze policy (NEXT-H2)

1. **No claim** that full-project `tsc --noEmit` is green.
2. **InvoicePrint syntax** historical blockers are cleared.
3. Launch-touched Orbix/honesty files must not introduce **net-new** diagnostics without updating this inventory + `artifacts/prod-ready-pr-b6/TSC_INVENTORY.txt`.
4. Root `.github/workflows/test.yml` still runs full `tsc`; treat red full-project tsc as known residual until inventory is cleared (hygiene pack does **not** require it).

Phase 6.5 gate: **zero diagnostics** in Phase 6.5-owned paths (see `artifacts/typescript-phase65-gate-report.md`) remains a separate historical note.
