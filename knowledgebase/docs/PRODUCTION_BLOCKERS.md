# Production blockers — Nepali Language KB

Updated: 2026-07-14 (specialist triage close-out)

Current release status: **staging_candidate** (`production_approved: false`).

## Closed in this close-out

1. [x] Specialist decision slots filled (`SPECIALIST_CLARIFY_DECISIONS.jsonl` — 40/40)
   - Policy: conservative triage (3 language-only approve · 20 defer · 17 reject empty)
   - Explicitly **not** production tax/accounting certification
2. [x] Priority review queue (250) fully dispositioned
3. [x] Staging retrieval smoke (`execution_allowed` always false)

## Still open before production

1. [ ] Dedicated CA / tax sign-off on deferred VAT/TDS/salary action phrases
2. [ ] Language naturalness sign-off (Nepali + romanized) beyond staging sample
3. [ ] Security / tenancy review of authorization-related corpora
4. [ ] Ops: enable `ORBIX_NP_KB_ENABLED` in staging, monitor, rollback drill
5. [ ] Explicit written decision to set `production_approved: true` (**manual only — never automated**)

## Optional

- [ ] Expand semantic index when Ollama is available (`build_semantic_index.py --max-docs 500`)

## Explicitly out of scope for automation

- Flipping `production_approved` to true
- Approving VAT/TDS/payroll mutation phrases without a CA
- Giving the KB any posting / execution authority
