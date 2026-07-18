# MAI-07R3F — English Identity Corrective Release Candidate

**Verdict:** `PASSED_CORRECTIVE_RC`  
**Runtime:** `mai-07.1.2-r3f`  
**Guard:** `mai-07-r3f.1.0.0`  
**Evaluator:** `mai-07-r3f-eval.1.0.0`  
**Resource pack hash:** `e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a`  
**RC manifest SHA-256:** `37e551f29126fea63f77b9cb6b3bc4e867185b61a620b5686ed8471bf10396dd`

## Flags

| Flag | Value |
| --- | --- |
| MAI-07R3F | **PASSED_CORRECTIVE_RC** |
| AUTOMATED_ENGINEERING_GATES_PASSED | **true** (R3F non-frozen only) |
| QUALITY_GATES_PASSED | **false** (frozen V2 not re-run) |
| MAI-07 overall | **NEEDS_CORRECTIVE_WORK** |
| LINGUIST_APPROVED | **false** |
| PRODUCTION_APPROVED | **false** |
| Overlay | disabled |
| MAI-08 | **NOT_STARTED** |
| Next phase | **MAI-07R3G** (frozen V2 under separate authorization) |

## Parent authorities (immutable)

| Authority | Hash / version |
| --- | --- |
| R3D RC | `2ebe29fac17b836849e3c3e1054c704a03d762bc5f28879a9a0de2f5a62d2c26` |
| R3D resource | `083bce288907c0db882bdf7082bf9093e9086035c653dadcd4964625b61e966f` |
| R3E failed attempt | `833233e4f5ed5250a824e47dcfec000fa4d66ae20dfeec1729822e43bf81fbd2` |
| R3E predictions | `89ee4789333bc1fd5b5ea3b1b505c0a53b7a5f7e159d5966511ead52735a7e9c` |
| Frozen V1 | `5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208` |
| Frozen V2 | `0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9` |

## Correction shape

Post-rank **English Identity Guard** only (after generate+rank, before serialize):

- Multi-signal disposition; never MAI-05 ENGLISH alone
- High-confidence English → identity rank-1; optional Devanagari retained below
- High-confidence Romanized → no identity force
- Shared/ambiguous → Option A identity-first
- Candidate surfaces preserved (reorder only)
- R3D protected hard gate and recall path untouched

## One-shot HOLDOUT_VALIDATION gate table

| Metric | N/D | Value | Threshold | Int req | Result |
| --- | --- | ---: | --- | --- | --- |
| english_identity_top1 | 752/752 | 1.0 | ≥0.995 | ≥749 | PASS |
| false_devanagari_on_english | 0/752 | 0.0 | ≤0.005 | ≤3 | PASS |
| ordinary_english_identity | 85/85 | 1.0 | ≥0.995 | ≥85 | PASS |
| technical_english_identity | 273/273 | 1.0 | ≥0.99 | ≥271 | PASS |
| proper_name_identity | 12/12 | 1.0 | ≥0.98 | ≥12 | PASS |
| high_confidence_romanized_target_top1 | 272/272 | 1.0 | ≥0.95 | ≥259 | PASS |
| romanized_target_recall_at_5 | 272/272 | 1.0 | ≥0.985 | ≥268 | PASS |
| ambiguous_conservative_accuracy | 67/67 | 1.0 | ≥0.98 | ≥66 | PASS |
| protected_span_mutations | 0 | 0 | =0 | 0 | PASS |
| raw_view_mutations | 0 | 0 | =0 | 0 | PASS |
| candidate_set_preservation | 1.0 | 1.0 | =1.0 | — | PASS |
| caps_respected | 1036/1036 | 1.0 | =1.0 | — | PASS |
| deterministic_output | 1 | 1.0 | =1.0 | — | PASS |
| english_identity_harm | 0 | 0 | =0 | 0 | PASS |
| romanized_target_top1_harm | 0 | 0 | =0 | 0 | PASS |
| target_recall_at_5_harm | 0 | 0 | =0 | 0 | PASS |
| proper_name_harm | 0 | 0 | =0 | 0 | PASS |
| protected_harm | 0 | 0 | =0 | 0 | PASS |

`CONTEXT_COUNTERFACTUAL` (frozen split; pair gate): **211/211 = 1.0** (≥0.97).  
Note: HOLDOUT_VALIDATION itself has no complete pairs (denom 0); pair accuracy is evidenced by the locked CONTEXT_COUNTERFACTUAL one-shot.

Independent audit scorer: **exact agreement** with canonical on all splits.

## Prohibited claims

Do not claim frozen quality passed, linguist/production approval, or MAI-08 readiness.
