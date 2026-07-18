# MAI-07R3J-A Automated Review Operations Report

## Verdict

**MAI-07R3J-A-REVIEW-OPS = PASSED_AUTOMATION**

| Flag | Value |
| --- | --- |
| Workflow state | **WAITING_FOR_ROUND_A_SUBMISSIONS** |
| Human blocker | BLOCKED_PENDING_INDEPENDENT_HUMAN_REVIEW |
| QUALITY_GATES_PASSED | false |
| LINGUIST_APPROVED | false |
| PRODUCTION_APPROVED | false |
| MAI-08 | NOT_STARTED |
| Answers generated | **no** |
| Model evaluation | **none** |

## Sealed authorities

- Packet: `29d16a3ee43d4981515d31a3763aa277a5d98dd5ab84499d58ead7da8723fc6c` ✓
- Blind mapping: `d0875db79185b034b080e69f77f1220417cdc24dae5a6fb755a56b472af414f1` ✓

## Round A ZIPs to send

| Role | Batches | Rows | ZIP |
| --- | ---: | ---: | --- |
| PRODUCT_POLICY | 10 | 1111 | `docs/mokxya-ai/reviews/mai07_v3/review_operations/reviewer_packages/MokXya_MAI07_V3_ROUND_A_PACKAGE__PRODUCT_POLICY.zip` |
| NEPALI_FLUENT_A | 10 | 1111 | `.../MokXya_MAI07_V3_ROUND_A_PACKAGE__NEPALI_FLUENT_A.zip` |
| PROFESSIONAL_LINGUIST_B | 10 | 1111 | `.../MokXya_MAI07_V3_ROUND_A_PACKAGE__PROFESSIONAL_LINGUIST_B.zip` |
| ACCOUNTING_DOMAIN | 6 | 611 | `.../MokXya_MAI07_V3_ROUND_A_PACKAGE__ACCOUNTING_DOMAIN.zip` |

## Inboxes for completed returns

`docs/mokxya-ai/reviews/mai07_v3/review_operations/round_a_inbox/<ROLE>/`

## One-click

- `docs/mokxya-ai/reviews/mai07_v3/review_operations/RUN_REVIEW_WORKFLOW.bat`
- `docs/mokxya-ai/reviews/mai07_v3/review_operations/CHECK_REVIEW_STATUS.bat`
- Dashboard: `docs/mokxya-ai/reviews/mai07_v3/review_operations/REVIEW_STATUS.html`

## Next human action

1. Choose real reviewers  
2. Send each role ZIP  
3. Place completed batch `.xlsx` files into the matching `round_a_inbox/<ROLE>/` folder  
4. Manually verify credentials (`CREDENTIALS_DECLARED_PENDING_MANUAL_VERIFICATION`)  
5. Run `RUN_REVIEW_WORKFLOW.bat`  

Do not start Round B until Round A locks.
