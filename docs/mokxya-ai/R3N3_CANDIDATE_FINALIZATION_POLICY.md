# R3N3 Candidate Finalization Policy

**Policy ID:** `mai-07-r3n3.1.0.0`  
**Implementation:** `r3n3_candidate_finalization.py`  
**Activation:** explicit R3N3 factory only

## Algorithm (reserved slots)

```
validate → ensure_exact_identity_present → surface_dedupe
  → reserve [exact identity]
  → reserve [protected / policy-required]
  → reserve [best Devanagari non-identity]
  → fill remaining by stable ranked order (cap hard)
  → postcondition check → fail-closed identity-only if violated
```

## Public helpers

| Function | Purpose |
|----------|---------|
| `construct_exact_identity(raw_surface)` | Authoritative identity candidate; surface equals raw code-point slice |
| `ensure_exact_identity_present(ranked, raw_surface=…)` | Inject or merge duplicate exact identities before capping |
| `finalize_candidates_r3n3(…)` | Full finalization with diagnostics |
| `apply_finalizer_twice_idempotent(…)` | Scorer/helper idempotence probe |

## Postconditions (must hold or fail-closed)

- Exactly one exact-identity candidate for `raw_surface`
- `len(out) ≤ max_candidates`
- No duplicate surfaces in output
- Idempotent re-application

## Non-goals

- Does not modify active R3F/R3N2 finalize paths
- Does not read holdout prediction JSONL
- Does not promote pack to default

## Holdout outcome

R3N3 Attempt 001: `FAILED_HOLDOUT_QUALITY`. English, romanized, acronym, identifier, protected, and caps lanes passed; identity and finalizer_idempotence gates failed. Monotonic split failed only `finalizer_idempotence`.

## Related

- `R3N3_IDENTITY_CANDIDATE_INVARIANT.md`
- `MAI_07_R3N3_FRESH_HOLDOUT_IDENTITY_CORRECTIVE_REPORT.md`
- `decisions/ADR_0017_R3N3_RESERVED_IDENTITY_AND_FAILED_PARENT.md`
