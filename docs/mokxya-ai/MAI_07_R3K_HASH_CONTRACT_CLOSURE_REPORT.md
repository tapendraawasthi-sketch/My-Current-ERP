# MAI-07R3K-CLOSURE — Input Hash Contract Reconciliation

**Verdict:** `PASSED_CLOSURE`  
**Defect classification:** `REPORT_ONLY`  
**Date:** 2026-07-17  
**Phase:** MAI-07R3K-CLOSURE-INPUT-HASH-CONTRACT-RECONCILIATION

## Correction notice

A conversational R3K summary incorrectly cited accounting by joining:

| Fragment | Source |
|----------|--------|
| Prefix `b96bec29` | Accounting **import semantic** hash |
| Suffix `1cdb68` | Accounting package **ZIP raw** hash |

(The forbidden joined display form is not repeated here so scanners do not treat correction prose as an authority citation.)

Canonical R3K machine artifacts already stored the full correct accounting **semantic** hash. No R3K canonical JSONL, semantic object, or input manifest contained the hybrid value. R3K outputs were **not** rebuilt; the R3K semantic hash is preserved.

## Recomputed authorities (full SHA-256)

| Authority | Kind | Value |
|-----------|------|-------|
| Accounting package ZIP | raw file | `f558fefdc186ba79bbe2a8757569204b88ce1aa1ed27400cda7705c1551cdb68` |
| Accounting canonical JSONL | raw file | `89305364ea86fd60637d1787aca07aba523781f77473805a9022516f6ff0de9b` |
| Accounting import | semantic object | `b96bec29e30ddcdc6dce1a5ef09a2003ee9de003a336cd98b43341c6e55e363b` |
| Remaining-roles canonical JSONL | raw file | `a647bf36b534a990bd3cf1ab174caf3a7c1c413abe14a5ca4abb138f85a6e707` |
| Remaining-roles import | semantic object | `1cc783d79cc3cc5f3f2daa288ae8b4721238fed584dbfb540597c8f883a8f4a1` |
| R3K decisions JSONL | raw file | `6cfec7a53234cd74c68612bf2992f8c660b059498ca7220e1dea1f43a4d52935` |
| R3K risk queue JSONL | raw file | `dc8984510f701d2312c12750032e10e8f9a4aca8e12d9735c9d7ec3979c6c6cf` |
| R3K diagnostic | semantic object (old = final) | `42d1a5ffc170d201f8a4bf92e4cef4f156dde57c07e847c960835e26080ddafc` |

## Population reconciliation

| Population | Count |
|------------|------:|
| Unique `source_item_id` | 1111 |
| Four-role cases | 611 |
| Three-role cases | 500 |
| Total role judgments | 3944 |
| PRODUCT_POLICY / NEPALI_FLUENT_A / PROFESSIONAL_LINGUIST_B | 1111 each |
| ACCOUNTING_DOMAIN | 611 |
| Risk queue | 700 |

## Authority manifest

`docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic/R3K_INPUT_AUTHORITY_MANIFEST.json`

- Manifest SHA-256: `65bfa6847a8d3d58af4e092f4217d65b3b6e5d51035c401e7304be1ed77fe2b8`
- `defect_scope=REPORT_ONLY`
- `r3k_canonical_outputs_changed=false`
- `r3k_semantic_hash_preserved=true`
- Machine fields are full 64-character lowercase hex only

## Recurrence prevention

- `mai07_r3k_hash_contract.py`: typed fields; display abbreviations from one full hash; reject hybrid citations; refuse silent manifest overwrite
- Diagnostic writer: `hash_contract` on isolated builds; historical DEFAULT_OUT canonical/report bytes preserved; `HASH_CONTRACT.json` sidecar only

## Tests

`erp_bot/tests/oip/language_runtime/test_mai07_r3k_hash_contract_closure.py` (17 cases), including pre-closure hybrid rejection demonstration.

## Governance (unchanged)

| Flag | Value |
|------|--------|
| `majority_voting_is_gold` | false |
| `agreement_is_independent_human_irr` | false |
| `independent_human_review` | false |
| `professional_linguist_adjudication` / `linguist_approved` | false |
| `quality_gates_passed` / `production_approved` | false |
| `official_round_a_lock_eligible` / `round_b_ready` | false |
| `frozen_v3_quality_gate_authorized` | false |
| `prohibited_for_training` | true |
| MAI-07 | `NEEDS_CORRECTIVE_WORK` |
| MAI-08 | `NOT_STARTED` |

R3K remains an **engineering diagnostic**, not quality evidence.

## Recommended next phase

`MAI-07R3L-AI-ASSISTED-RUNTIME-CONFORMANCE-DIAGNOSTIC` (not implemented in this phase).
