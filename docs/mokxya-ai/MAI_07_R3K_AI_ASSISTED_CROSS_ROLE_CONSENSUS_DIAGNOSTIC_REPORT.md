# MAI-07R3K — AI-Assisted Cross-Role Consensus Diagnostic

**Verdict:** `PASSED_ENGINEERING_DIAGNOSTIC`  
**Date:** 2026-07-17  
**Semantic hash:** `42d1a5ffc170d201f8a4bf92e4cef4f156dde57c07e847c960835e26080ddafc`

## Correction notice (MAI-07R3K-CLOSURE)

A conversational summary briefly cited accounting by joining semantic prefix `b96bec29` with ZIP raw suffix `1cdb68` (hybrid abbreviation). That was a **report-only** error. Canonical R3K inputs/outputs already used the full semantic hash below. Closure verdict: `PASSED_CLOSURE` / `defect_scope=REPORT_ONLY`. See `MAI_07_R3K_HASH_CONTRACT_CLOSURE_REPORT.md` and `reviews/mai07_v3_ai_assisted/cross_role_diagnostic/R3K_INPUT_AUTHORITY_MANIFEST.json`.

## Flags (unchanged / hard-coded)

| Flag | Value |
|------|--------|
| `independent_human_review` | false |
| `professional_linguist_adjudication` | false |
| `linguist_approved` / `production_approved` / `QUALITY_GATES_PASSED` | false |
| `official_round_a_lock_eligible` / `ROUND_A_LOCKED` | false |
| `round_b_authorized` / `ROUND_B_READY` | false |
| `frozen_v3_quality_gate_authorized` | false |
| `majority_voting_is_gold` | **false** |
| `agreement_is_independent_human_irr` | **false** |
| `prohibited_for_training` | true |
| MAI-07 / MAI-08 | `NEEDS_CORRECTIVE_WORK` / `NOT_STARTED` |

## Inputs verified

| Input | Kind | Full SHA-256 |
|-------|------|----------------|
| Accounting package ZIP | raw file | `f558fefdc186ba79bbe2a8757569204b88ce1aa1ed27400cda7705c1551cdb68` |
| Accounting import | semantic | `b96bec29e30ddcdc6dce1a5ef09a2003ee9de003a336cd98b43341c6e55e363b` |
| Remaining-roles import | semantic | `1cc783d79cc3cc5f3f2daa288ae8b4721238fed584dbfb540597c8f883a8f4a1` |

Join key: V3 blind-mapping `source_item_id` (1111 unique cases).

Display abbreviations (each derived from **one** full hash only):

- Accounting semantic display: `b96bec29…5e363b`
- Accounting ZIP raw display: `f558fefd…1cdb68`
- Remaining semantic display: `1cc783d7…a8f4a1`
- R3K semantic display: `42d1a5ff…0ddafc`

## Population

| Population | Count |
|------------|------:|
| Unique cases (`source_item_id`) | 1111 |
| PRODUCT_POLICY judgments | 1111 |
| NEPALI_FLUENT_A judgments | 1111 |
| PROFESSIONAL_LINGUIST_B (AI simulation) | 1111 |
| ACCOUNTING_DOMAIN judgments | 611 |
| **Total judgments** | **3944** |
| Four-role cases | 611 |
| Three-role cases (no accounting) | 500 |

## Agreement diagnostics (AI-output similarity only)

**Not human inter-rater reliability.** Roles share draft provenance (accounting content map + identical HEURISTIC_V1), so disposition agreement is artificially perfect:

| Metric | Value |
|--------|------:|
| Three-role exact disposition agreement | 1111/1111 = **1.0** |
| Four-role exact disposition agreement | 611/611 = **1.0** |
| Unanimous / majority / all-different | 1111 / 0 / 0 |
| Abstention-containing | 43 |
| Review-vs-required conflicts | 0 |

Pairwise disposition agreement rates are all **1.0** where both roles exist.

Source buckets:

- ACCOUNTING_MAP_INHERITED_NO_HEURISTIC: n=611, three-role exact agree=611  
- HEURISTIC_V1_PRESENT: n=500, three-role exact agree=500  

## Source-method contamination

Cross-role “agreement” is **contaminated** by non-independent generation:

1. Remaining-role drafts reused ACCOUNTING verified labels for 611 content pairs.
2. The same HEURISTIC_V1 function filled the other 500 pairs for every remaining role.
3. Therefore exact disposition agreement measures **shared generator consistency**, not independent role reasoning.

This diagnostic documents that contamination; it must not be cited as multi-rater reliability.

## Risk queue

| Tier | Count |
|------|------:|
| TIER_2_HIGH | 501 |
| TIER_3_MEDIUM | 199 |
| **Total** | **700** |

Primary inclusion drivers: `HEURISTIC_V1_SAFETY_SENSITIVE` (500), soft/optional dispositions, LOW/MEDIUM confidence, `ABSTAIN_PRESENT` (43), suspected ambiguity.

## Targeted blinded packet

`docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic/targeted_review_packet/`

- 700 rows; opaque `TGT-*` IDs; text + span + neutral instructions only
- Private mapping under `private_adjudication_import_only/` (not for reviewers)
- Not official Round A; not placed in `round_a_inbox`
- Leakage scan passed

## Canonical outputs

`docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic/`

- `canonical/CROSS_ROLE_DECISIONS.jsonl`
- `canonical/RISK_QUEUE.jsonl`
- `reports/CONSENSUS_DIAGNOSTIC_REPORT.json`
- `reports/AGREEMENT_DIAGNOSTIC.json`
- `reports/SEMANTIC_HASH.json`
- `reports/HASH_CONTRACT.json` (closure sidecar)
- `R3K_INPUT_AUTHORITY_MANIFEST.json` (closure)

## Implementation

- `mai07_r3k_cross_role_contracts.py`
- `mai07_r3k_cross_role_consensus_diagnostic.py`
- `mai07_r3k_hash_contract.py`
- ADR_0012 (+ closure note)

## Explicit non-claims

No majority gold, official lock, Round B, frozen V3, runtime promotion, linguist/production approval, or MAI-08.
