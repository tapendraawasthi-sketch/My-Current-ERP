# TypeScript baseline (accepted debt)

Root command:

```bash
npx tsc --noEmit --pretty false
```

Config: `tsconfig.json` (`include: ["src"]`, `strict: false`).

| Snapshot | Commit / tree | Diagnostics | Exit |
|----------|---------------|------------:|-----:|
| Pre-uncommitted Orbix tree | `753fc80e` | 127 | 2 |
| Post Phase 6.5 typing fixes | working tree | 156 | 2 |

Phase 6.5 gate: **zero diagnostics** in Phase 6.5-owned paths (see `artifacts/typescript-phase65-gate-report.md`).

Do not treat a red full-project `tsc` as a Phase 6.5 failure unless the diagnostic-difference gate attributes new errors to Phase 6.5 files or shared-type regressions.
