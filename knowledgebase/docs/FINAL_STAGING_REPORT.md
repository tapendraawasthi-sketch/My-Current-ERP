# Final Staging Report — Nepali Language KB

Generated: 2026-07-14 (pendings close-out)

## Verdict

- Release: **staging_candidate**
- Production: **not approved**
- Specialist decision slots: **40/40 filled** (conservative triage)
- Priority queue: **complete**
- Smoke: **36 hits / execution always forbidden**

## Overlay mix

| Decision | Count |
|----------|------:|
| approve | 30 |
| defer | 229 |
| reject | 17 |
| **total** | **276** |

## Specialist triage policy

- Lexical fragments (e.g. `tax period`, `13% VAT`) → approve as **language-only**
- VAT/TDS/salary action or Q&A → **defer** (CA/payroll later)
- Empty tax-name records → **reject**

## What remains for production

See `PRODUCTION_BLOCKERS.md`. Do not set `production_approved: true` from automation.
