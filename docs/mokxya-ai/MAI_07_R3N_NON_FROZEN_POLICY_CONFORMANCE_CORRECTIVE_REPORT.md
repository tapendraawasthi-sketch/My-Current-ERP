# MAI-07R3N Non-Frozen Policy-Conformance Corrective Report

**Historical engineering verdict (superseded for release authority):** `PASSED_CORRECTIVE_RC`  
**Integrity-closure status (authoritative):** `INVALIDATED_HOLDOUT_CONTAMINATION_NEW_RC_REQUIRED`  
**See:** `docs/mokxya-ai/MAI_07_R3N_INTEGRITY_CLOSURE_REPORT.md` (2026-07-18)  
**Date:** 2026-07-18  
**Phase:** `MAI-07R3N-NON-FROZEN-POLICY-CONFORMANCE-CORRECTIVE`  
**RC:** `MAI_07R3N_POLICY_CONFORMANCE_RELEASE_CANDIDATE_002`  
**Attempt:** `MAI_07R3N_HOLDOUT_ATTEMPT_002`  
**RC locked semantic sha256:** `539ea32caa270060c9de28b35e989cb7bd6a1ade9670264b8e143977b0d3b24a`

> **Integrity note:** Attempt 002 reused the Attempt 001 case-ID/template-family/seed holdout after post-observation runtime and gate-semantics changes. RC_002 bytes are retained but are **not** eligible as an independently evaluated corrective RC or frozen-V3 input. Next governed phase: `MAI-07R3N2-FRESH-HOLDOUT-POLICY-CONFORMANCE-CORRECTIVE`.

## Non-claims

Engineering holdout qualification only. Does **not** grant linguist approval, product quality gates, production approval, frozen V2/V3 execution, Round B, or MAI-08 start. `PASSED_CORRECTIVE_RC` is **not** pack promotion. Private R3M/R3L case source texts are not reproduced here.

## Candidate and active boundary

| Role | Pack / policy | Status |
|------|---------------|--------|
| R3N candidate | `mai-07.1.6-r3n-policyconf` / policy `mai-07-r3n.1.0.0` | Explicit activation only; **not promoted** |
| Active parent | `mai-07.1.3-r3f-sealnew` | Immutable default |
| Active resource content sha256 | `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930` | Unchanged |
| Promotion overlay | disabled | Non-authoritative |

Default runtime construction continues to load R3F sealnew. R3N is reached only via `mai07_r3n_candidate_runtime.py` (explicit candidate factory). No lexicon / target / resource spelling edits landed in R3N.

## Authority chain (preserved)

| Authority | Full SHA-256 |
|-----------|--------------|
| R3L semantic | `ca134c346414a2d30a448dddabb72287eac809965165a1a037431ee7c3cad6de` |
| R3M semantic | `bd9a9608fe540eb9f10753668df0b99337fee6acf08a15edaa71be6678002b09` |
| R3M closure semantic | `f39432c6e085c89964e2551fe27921d32c79235061fea218262f6d3093e00afd` |

Historical semantics are unchanged. Corrective authority remains the nine-case code queue from R3M closure.

## Authorized code-corrective population (nine cases)

Loaded into R3N **DEVELOPMENT** only (`AUTHORIZED_CODE_CORRECTIVE`). Holdout-family splits must not carry these cases. Resource corrective queue remains **0**.

| Lane | Count |
|------|------:|
| `ENGLISH_IDENTITY_GUARD` | 5 |
| `IDENTITY_CANDIDATE_INVARIANT` | 3 |
| `ACRONYM_OR_IDENTIFIER_PROTECTION` | 1 |
| Resource lexicon / target edits | 0 |
| **Sum (code)** | **9** |

## Root causes (engineering)

1. **English identity guard / lexicon neighbor false positive** — Guard treated lexicon-neighbor tokens as Nepali particles; `ENGLISH` form could flip from lexicon evidence alone without decisive multi-signal context.
2. **MAI-05 over-merged phrase identifiers** — Phrase-level span merging pulled identifier fragments into larger spans, defeating acronym/identifier protection.
3. **Structural letter-digit identifier split** — Tokenizer split contiguous mixed letter-digit identifiers (optional `-` / `.` / `/` separators), so protection saw fragments instead of the full token.

## Fixes shipped (candidate-only)

| Fix | Role |
|-----|------|
| R3N-gated `english_identity_guard` | Multi-signal English disposition; lexicon-alone insufficient to flip ENGLISH form |
| `refine_overmerged_identifier_spans` | Split over-merged phrase spans back to identifier-safe units |
| `coalesce_structural_identifiers` | Rejoin structural letter-digit identifiers split by tokenization |
| Explicit candidate factory (`mai07_r3n_candidate_runtime.py`) | Activate `mai-07.1.6-r3n-policyconf` without mutating active pack / overlay |

## Attempt history

| Attempt / RC | Engineering verdict | Notes |
|--------------|---------------------|-------|
| `RC_001` / `ATTEMPT_001` | `FAILED_HOLDOUT_QUALITY` | Scorer treated empty optional pops as required; weak synthetic romanized population; structural coalesce missing |
| `RC_002` / `ATTEMPT_002` | `PASSED_CORRECTIVE_RC` | Protocol + runtime fixes; **not** threshold weakening. Locked semantic `539ea32caa270060c9de28b35e989cb7bd6a1ade9670264b8e143977b0d3b24a` |

RC_001 remains historical evidence. Qualification for RC_002: `status=PASSED_HOLDOUT`, `gate_all_pass=true`, `engineering_verdict=PASSED_CORRECTIVE_RC`.

## Split-aware required gates (scorer)

- Core policy gates are required on `DEVELOPMENT` and `HOLDOUT_VALIDATION` when populations are non-empty.
- Empty optional populations → `NOT_APPLICABLE` (not fail).
- `AUTHORIZED_CODE_CORRECTIVE` is **DEVELOPMENT-only**; empty on holdout → `NOT_APPLICABLE`.
- No `max(1, denominator)`; empty required population on a split that requires that gate → `INVALID_REQUIRED_POPULATION`.

Dataset tree: `evals/mai07_r3n_policy_conformance/`.

## Governance flags (product bar unchanged)

| Flag | Value |
|------|-------|
| `QUALITY_GATES_PASSED` | `false` |
| `LINGUIST_APPROVED` | `false` |
| `PRODUCTION_APPROVED` | `false` |
| `MAI-07` | `NEEDS_CORRECTIVE_WORK` |
| `MAI-08` | `NOT_STARTED` |
| `candidate_promoted` | `false` |
| Frozen V2 opened | **no** |

## Related policy / decisions

- `docs/mokxya-ai/R3N_CORRECTIVE_POLICY.md`
- `docs/mokxya-ai/R3N_NON_FROZEN_EVALUATION_PROTOCOL.md`
- `docs/mokxya-ai/decisions/ADR_0015_ISOLATED_CANDIDATE_CORRECTIVE_NON_PROMOTION.md`
- `docs/mokxya-ai/baselines/MAI_07R3N_BASELINE_SUMMARY.md`
- Prior: R3L / R3M / R3M-CLOSURE reports and ADR_0013 / ADR_0014

## Next phase

**MAI-07R3O-INDEPENDENT-V3-REVIEW-RESOLUTION-AND-FREEZE** (explicit authorization required). Do not infer linguist, quality-gate, or production readiness from this RC.
