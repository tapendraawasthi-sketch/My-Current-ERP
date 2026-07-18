# R3L Residual Risk Policy

Phase: MAI-07R3L-AI-ASSISTED-RUNTIME-CONFORMANCE-DIAGNOSTIC

## Principle

Every non-clean case remains auditable. Non-selected packet rows stay in the full residual queue.

## Tiers

### TIER_1_CRITICAL

Raw mutation, protected/identifier mutation, acronym corruption, false forced Devanagari for ENGLISH_IDENTITY/ACRONYM/PROTECTED, runtime exception, cap/boundedness failure, alignment corruption, security-sensitive output, execution/accounting mutation attempt.

### TIER_2_HIGH

Expected Devanagari behavior but no Devanagari candidate; expected identity-first but identity not top-1; ABSTAIN force-transliterated; unresolved/ambiguous span; missing required runtime capability; R3K TIER_2_HIGH with policy mismatch.

### TIER_3_MEDIUM

OPTIONAL with identity missing; CONTEXT_DEPENDENT without diversity/review signal; low/medium confidence; suspected ambiguity; natural_context_ok=false; HEURISTIC_V1 safety-sensitive; duplicates/candidate-quality warnings.

## Packet selection

1. Include every TIER_1_CRITICAL item.
2. Deterministic greedy coverage across disposition, provenance, reason, accounting/non-accounting, ambiguity/confidence.
3. Prefer ≥5 examples per uncovered reason family when available.
4. Cap 200 rows unless critical alone exceeds 200.
5. Never write to official Round A inbox.
6. Private mapping: adjudication-import-only; prohibited for runtime and training.
