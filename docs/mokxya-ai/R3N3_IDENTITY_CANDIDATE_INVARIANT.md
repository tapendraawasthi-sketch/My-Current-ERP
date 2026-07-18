# R3N3 Identity Candidate Invariant

**Policy version:** `mai-07-r3n3.1.0.0`  
**Finalizer version:** `mai-07-r3n3.finalizer.1.0.0`  
**Candidate pack:** `mai-07.1.8-r3n3-identityinv`

## Invariant (per span, after finalization)

1. **Exactly one** candidate satisfies exact raw identity: `is_identity=true`, `kind=IDENTITY`, `surface == raw_surface` (Unicode code-point slice).
2. Identity is **never evicted** by candidate-cap pressure or Devanagari target reservation.
3. Candidate count ≤ `MAX_CANDIDATES_PER_SPAN` (5); surfaces deduplicated.
4. Finalizer is **idempotent**: applying `finalize_candidates_r3n3` twice yields identical surfaces, identity flags, and ranks.

## Root cause addressed

Legacy `_finalize_candidates` could backfill identity at the end of the ranked window and then drop it when reserving a Devanagari slot. R3N3 reserves identity first, then protected/policy-required, then best Devanagari, then fills by stable rank.

## Scope

- Applies **only** to the R3N3 explicit candidate factory (`transliterate_r3n3` / `finalize_candidates_r3n3`).
- Active default R3F path unchanged.
- Failed parent R3N2 (`FAILED_HOLDOUT_QUALITY`) remains consumed; not release evidence.

## Holdout evidence (Attempt 001)

| Metric | Result | Required |
|--------|--------|----------|
| identity_retention | 288/300 | == 1.0 **FAIL** |
| exact_raw_identity | 288/300 | == 1.0 **FAIL** |
| exactly_one_identity | 288/300 | == 1.0 **FAIL** |
| identity_invariant_analogue | 238/250 | == 1.0 **FAIL** |
| cap_pressure_identity_retention | 238/250 | == 1.0 **FAIL** |
| finalizer_idempotence | 1188/1200 | == 1.0 **FAIL** |

Residual gaps concentrate under multi-token cap-pressure after reserved finalizer — see GAP-P2-029.

## Next corrective

`MAI-07R3N4-FRESH-HOLDOUT-IDENTITY-INVARIANT-CORRECTIVE` — new version + fresh holdout; do not repair R3N3 in-place.
