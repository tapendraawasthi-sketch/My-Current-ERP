# MAI-07R3I Baseline Summary

- Phase: `MAI-07R3I-FROZEN-REAUTHORIZED`
- Verdict: `FAILED_QUALITY`
- Authorization: `EXPLICIT_USER_AUTHORIZATION_MAI_07R3I_FROZEN_REAUTHORIZED`
- Attempt: `MAI_07R3I_FROZEN_V2_ATTEMPT_001` (consumed; `prohibited_rerun=true`)
- Selected RC: `MAI_07R3H2_SHARED_COLLISION_RELEASE_CANDIDATE_001`
- Candidate pack: `mai-07.1.5-r3h2-shared` / `8716589a…e60a` (**not promoted**)
- Active default (unchanged): `mai-07.1.3-r3f-sealnew` / `16174253…e930`
- Frozen V2 opened: **yes** (one-shot)
- MAI-08 touched: **no**

## Frozen gates (integer authority)

| Metric | Observed | Status |
| --- | ---: | --- |
| TARGET_TOP1 | 240/288 | FAIL |
| TARGET_RECALL@5 | 281/288 | PASS |
| TARGET_MRR | 0.9045 | PASS |
| CORE_RECALL@5 | 267/272 | PASS |
| UNAMBIGUOUS_TOP1 | 228/255 | FAIL |
| ENGLISH_IDENTITY | 99/102 | FAIL |
| FALSE_DEVANAGARI | 3/102 | FAIL |
| PROTECTED_MUTATIONS | 6 | FAIL |
| RAW / CAPS / DETERMINISM | 0 / 696/696 / 1.0 | PASS |

## Predictions

- Raw JSONL: `15f6ba5537d52682e57647eebc225e655f17d61c29c26f82a65c56967beb4e92`
- Canonical/semantic: `38864d9e4097248804e65271400a65047a652a991abb2ce92c27107bd83836c2`

## Flags

`QUALITY_GATES_PASSED=false` · `LINGUIST_APPROVED=false` · `PRODUCTION_APPROVED=false` · GAP-P1-011 OPEN

## Next

Governance decision for independently reviewed V3 and/or professional adjudication. Do not retune from frozen V2 cases. Do not start MAI-08 in this turn.
