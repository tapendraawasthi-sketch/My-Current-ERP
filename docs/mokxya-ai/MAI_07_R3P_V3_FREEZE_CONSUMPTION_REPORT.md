# MAI-07R3P V3 Freeze Consumption Report

**Date:** 2026-07-18  
**Phase status:** `V3_DATASET_FROZEN_AWAITING_AUTHORIZED_EVAL`  
**Authority:** ADR_0022 (consume sealed human-review freeze only)

## Verdict

`MAI_07_ROMANIZED_TRANSLITERATION_V3` was built deterministically from the sealed
V3 human-review freeze. Thresholds are locked **before** any model observation.
No runtime evaluation was performed.

## Inputs (pinned)

| Artifact | SHA256 |
|---|---|
| Human-review freeze manifest | `adcee2904dc34df8e305d0de9e0a12f61c20b130da86d20ec1f225678587397c` |
| Blind mapping | `d0875db79185b034b080e69f77f1220417cdc24dae5a6fb755a56b472af414f1` |

## Outputs

| Artifact | Value |
|---|---|
| Dataset ID | `MAI_07_ROMANIZED_TRANSLITERATION_V3` |
| Dataset hash | `6ad2a824a6fe0cb1248d7640692f8c45635b4290ee33647d5cbe4b82af2bdde8` |
| Cases | 1111 |
| FROZEN_EVALUATION pool | 583 |
| POLICY_DEVELOPMENT pool | 528 |
| Threshold manifest | `evals/mai07/manifests/MAI_07_R3P_THRESHOLDS_V3.manifest.json` |
| Dataset manifest | `evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V3.manifest.json` |
| Suite files | `evals/mai07/frozen_v3/*.jsonl` |

## Population counts

- CONTEXT_DEPENDENT_ENGLISH: 198
- IDENTITY_REQUIRED: 168
- NO_TRANSLITERATION_ALLOWED: 18
- PROTECTED_IDENTITY: 277
- TRANSLITERATION_OPTIONAL: 281
- TRANSLITERATION_REQUIRED: 169

Fluent A vs Linguist B disposition mismatches: **0**  
Option A mechanical remap provenance: **recorded on every case**

## Explicit non-claims

- `QUALITY_GATES_PASSED` = **false**
- `PRODUCTION_APPROVED` = **false**
- Candidate `mai-07.1.11-r3n6-chaincomplete` **not** promoted
- Active runtime remains `mai-07.1.3-r3f-sealnew`
- MAI-08 remains `NOT_STARTED`
- No frozen V3 quality one-shot was executed (requires separate authorization)

## Tests

`erp_bot/tests/oip/language_runtime/test_mai07_r3p_dataset_v3.py` — 5 passed

## Next

Authorize and run **one-shot** frozen V3 evaluation against an explicitly loaded
candidate (R3P-2) only under separate product authorization. That step is what
may flip `QUALITY_GATES_PASSED`; this consumption step does not.
