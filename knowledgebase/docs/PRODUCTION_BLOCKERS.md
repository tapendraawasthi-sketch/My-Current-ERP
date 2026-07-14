# Production blockers — Nepali Language KB

Updated: 2026-07-14 (owner close-out complete)

## Gate

- Status: **`production_owner_attested`**
- `production_approved`: **true** (owner attestation)
- `licensed_ca_opinion`: **false**
- `kb_posting_authority`: **false** (always)

## Checklist

1. [x] Specialist slots filled + residual tax phrases owner-accepted (interpretation-only)
2. [x] Language naturalness spot-check (GOLD sample)
3. [x] Security adversarial corpus reviewed (promote_to_gold)
4. [x] Ops enable + rollback drill (`rollback_drill_report.json`)
5. [x] Owner production attestation (`OWNER_PRODUCTION_ATTESTATION.json`)
6. [x] Gate re-run → `production_owner_attested`

## Runtime enable (operator)

```powershell
# In environment / .env — not auto-written
ORBIX_NP_KB_ENABLED=true
ORBIX_NP_KB_ROOT=knowledgebase
```

Rollback: set `ORBIX_NP_KB_ENABLED=false`.

## Remaining optional

- [ ] Expand semantic index when Ollama is available
- [ ] Optional: later obtain a licensed CA opinion (attestation explicitly is not one)

## Hard invariants

- KB never posts / never sets `execution_allowed=true`
- Owner attestation ≠ licensed CA / legal certification
