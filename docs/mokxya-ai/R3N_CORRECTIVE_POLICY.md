# R3N Corrective Policy

Phase: **MAI-07R3N-NON-FROZEN-POLICY-CONFORMANCE-CORRECTIVE**

## Purpose

Define precedence and corrective lanes for the R3N candidate runtime (`mai-07.1.6-r3n-policyconf`). This is engineering policy-conformance work — not language-quality gold and not production promotion.

## Precedence (highest first)

1. **Protected span** — no raw mutation; identity retained.
2. **Identifier / acronym protection** — codes, mixed alnum identifiers, acronyms stay Latin top-1.
3. **Strong Romanized Nepali evidence** — Nepali particles + lexicon/morphology → Devanagari candidate @5.
4. **Decisive English multi-signal** — English/technical form alone is insufficient; require context signals.
5. **Shared / ambiguous policy** — conservative identity-first when collision evidence is weak.
6. **Deterministic fallback** — preserve base candidate order when no lane fires.

Parent policy: `mai-07-r3h2.1.0.0`. R3N policy version: `mai-07-r3n.1.0.0` (`r3n_policy_conformance_policy.json`).

## Corrective lanes (from R3M closure)

| Lane | Expectation |
|------|-------------|
| `ENGLISH_IDENTITY_GUARD` | Identity top-1; forbid false Devanagari top-1 |
| `IDENTITY_CANDIDATE_INVARIANT` | Identity retained and top-1 |
| `ACRONYM_OR_IDENTIFIER_PROTECTION` | Acronym/identifier identity top-1 |

Nine **authorized code-corrective** cases are loaded into the R3N **DEVELOPMENT** split only (`AUTHORIZED_CODE_CORRECTIVE` population). They are `prohibited_for_training` and must not enter holdout families.

## Candidate runtime fixes (policy-conformance)

| Mechanism | Intent |
|-----------|--------|
| R3N-gated `english_identity_guard` | Multi-signal English identity; lexicon-alone must not flip ENGLISH form |
| `refine_overmerged_identifier_spans` | Undo MAI-05 over-merged phrase identifiers |
| `coalesce_structural_identifiers` | Rejoin structural letter-digit identifiers split by the tokenizer |
| Explicit candidate factory | Load `mai-07.1.6-r3n-policyconf` without mutating active R3F |

No resource lexicon / target spelling edits in R3N.

## Active runtime boundary

- Default active pack remains `mai-07.1.3-r3f-sealnew`.
- R3N is **explicit activation only** via `mai07_r3n_candidate_runtime.py`.
- Do not mutate active runtime packs or enable promotion overlay during R3N evaluation.
- `PASSED_CORRECTIVE_RC` is engineering-only; it is not promotion, linguist, or quality-gate approval (see ADR_0015).
