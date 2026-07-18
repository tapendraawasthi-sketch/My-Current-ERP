# R3N4 Finalization Path Authority

**Finalizer version:** `mai-07-r3n4.finalizer.1.0.0`  
**Authoritative boundary:** `apply_r3n4_finalize_bundle`

## Rule

Every R3N4 output path that returns candidates must invoke the R3N4 finalizer **exactly once** with a valid `IdentityAnchorV1`. Paths that cannot construct a valid anchor return a typed identity-safe fail-closed result — they do not bypass finalization.

## Required path families

- protected
- skipped_english
- abstention
- ordinary_romanized_generation
- english_guard_reorder
- acronym
- structural_identifier
- refined_identifier
- coalesced_identifier
- multi_token_phrase
- optional_ambiguous
- failure_fallback
- cap_pressure
- empty_generator_result

Registry: `r3n4_finalization_path_registry.py`.

## Finalizer steps

1. Validate anchor  
2. Construct canonical identity from anchor  
3. Remove malformed/duplicate identity candidates  
4. Deduplicate non-identity deterministically  
5. Reserve exact identity  
6. Reserve highest-ranked valid Devanagari  
7. Reserve protected/policy-required  
8. Rank remaining  
9. Apply deterministic cap  
10. Verify postconditions  
11. Return canonical stable output  

## Idempotence

```
canonical_serialize(finalize(anchor, finalize(anchor, candidates)))
  == canonical_serialize(finalize(anchor, candidates))
```

Comparison includes surfaces, IDs, kinds, identity flags, order, alignments, provenance, review metadata, and Decimal-canonical scores.

## Relationship to inner hooks

`transliterate_frame`'s optional `finalize_candidates_fn` is stubbed through on the R3N4 path. The outer `apply_r3n4_finalize_bundle` is the single authoritative finalization boundary so protected / IDENTITY_ONLY / ABSTAIN / empty-generator routes cannot skip identity anchoring.
