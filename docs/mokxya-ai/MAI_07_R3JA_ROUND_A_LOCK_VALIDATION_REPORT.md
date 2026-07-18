# MAI-07R3J-A Round A Lock and Validation Report

## Verdict

**BLOCKED_ROUND_A_CORRECTION_REQUIRED**

| Flag | Value |
| --- | --- |
| ROUND_A_LOCKED | false |
| ROUND_B_READY | false |
| Round B released | **no** |
| QUALITY_GATES_PASSED | false |
| LINGUIST_APPROVED | false |
| MAI-08 | NOT_STARTED |
| Human answers altered/generated | **no** |
| Model evaluation | **none** |
| Runtime modified | **no** |

## Sealed authorities

| Artifact | Expected | Observed | Match |
| --- | --- | --- | --- |
| V3_PACKET_MANIFEST.json | `29d16a3ee43d4981515d31a3763aa277a5d98dd5ab84499d58ead7da8723fc6c` | same | yes |
| V3_BLIND_MAPPING.json | `d0875db79185b034b080e69f77f1220417cdc24dae5a6fb755a56b472af414f1` | same | yes |

## Files received

No completed Round A workbooks were found in:

`docs/mokxya-ai/reviews/mai07_v3/round_a_submissions_inbox/`

Blank packet templates under `reviewers/` were **not** treated as returned submissions (0 dispositions / unsigned declarations).

| Role | Received | Rows completed | Declaration |
| --- | --- | ---: | --- |
| PRODUCT_POLICY | none | 0 / 1111 | missing |
| NEPALI_FLUENT_A | none | 0 / 1111 | missing |
| PROFESSIONAL_LINGUIST_B | none | 0 / 1111 | missing |
| ACCOUNTING_DOMAIN | none | 0 / 611 | missing |

## Corrections required (each reviewer)

1. Complete the assigned workbook (not the blank template alone).
2. Sign **REVIEWER_DECLARATION** (name, email, independence, no-AI, no-runtime-predictions, date, signature).
3. Fill **disposition + confidence** for every Round A row (allowed enums only).
4. Professional linguist: fill `professional_linguist_credentials` / qualification.
5. Place the completed file into `round_a_submissions_inbox/` using the exact filename.
6. Re-run Round A lock validation. **Do not start Round B.**

Per-reviewer JSON reports:
`docs/mokxya-ai/reviews/mai07_v3/round_a_validation/`

## Next human action

Return corrected Round A workbooks to the inbox, then re-run **MAI-07R3J-A-ROUND-A-LOCK-AND-VALIDATION**.
