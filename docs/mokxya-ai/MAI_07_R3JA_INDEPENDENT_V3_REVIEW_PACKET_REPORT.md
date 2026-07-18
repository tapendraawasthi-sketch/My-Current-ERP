# MAI-07R3J-A — Independent V3 Governance and Review Packet

## Verdict

**MAI-07R3J-A = REVIEW_PACKET_READY**

| Flag | Value |
| --- | --- |
| Overall blocker | **BLOCKED_PENDING_INDEPENDENT_HUMAN_REVIEW** |
| QUALITY_GATES_PASSED | false |
| LINGUIST_APPROVED | false |
| PRODUCTION_APPROVED | false |
| MAI-07 | NEEDS_CORRECTIVE_WORK |
| MAI-08 | NOT_STARTED |
| Model evaluation in this phase | **none** |
| Runtime/resources modified | **no** |
| Next | **MAI-07R3J-B-ADJUDICATION-AND-V3-FREEZE** |

## V2 retirement

`HISTORICAL_BENCHMARK_EXHAUSTED_FOR_MODEL_SELECTION` (ADR_0010).

## Packet

Directory: `docs/mokxya-ai/reviews/mai07_v3/`

- Items: **1111** unique independently sourced review items
- Pools: POLICY_DEVELOPMENT + FROZEN_EVALUATION (family-level hash; hidden from reviewers)
- Reviewer workbooks: product policy, Nepali fluent A, professional linguist B, accounting domain, adjudicator template
- Human decisions included: **false**

## Exact human actions

1. Assign qualified reviewers.
2. Give each reviewer only their individual Round A workbook under `reviewers/`.
3. Obtain signed reviewer declarations.
4. Complete Round A independently.
5. Return and hash-lock Round A files.
6. Release Round B only after Round A lock.
7. Complete Round B independently.
8. Return and hash-lock Round B files.
9. Run agreement analysis.
10. Send disagreements to the independent adjudicator.
11. Return adjudication file.
12. Begin R3J-B only after all required evidence exists.

Do not edit blind mappings or import schemas. Do not claim professional approval before evidence exists.
