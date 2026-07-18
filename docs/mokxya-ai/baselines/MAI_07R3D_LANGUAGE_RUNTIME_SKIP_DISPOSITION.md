# MAI-07R3D — language_runtime skip disposition and suite delta

## Verified suite comparison

| Point | Passed | Skipped | Failed |
| --- | ---: | ---: | ---: |
| Pre-R3D (R3C disposition baseline) | 232 | 6 | 0 |
| Post-R3D (after skip resolution) | **256** | **6** | **0** |
| Net delta vs pre-R3D | **+24 passed** | **0 skips** | **0 new failures** |

Discovery comparison (before skip resolution):

- Pre-R3D: **232 passed, 6 skipped, 0 failed**
- Post-R3D (with temporary R3A skip): **255 passed, 7 skipped, 0 failed**
- Delta then: **+23 passed, +1 skipped, 0 new failures**

After converting the R3A skip into an active sealed-authority test: **256 passed, 6 skipped, 0 failed**.

## Pre-R3D six skips (retained)

1. `test_mai07_r1_ranker.py::test_same_token_different_disposition_by_context`  
   Reason: `HISTORICAL_R2_OVERLAY_EXPECTATION`  
   Authority: MAI-07R3C historical disposition; failed R2 overlay not active.

2. `test_mai07_r1_ranker.py` skip at line ~236  
   Reason: `R1 disposition superseded by MAI-07R2 base ranker + overlay`  
   Authority: historical R1 → R2 supersession (R3C retained).

3. `test_mai07_r1_ranker.py` skip at line ~241  
   Same reason/authority as (2).

4. `test_mai07_r1_ranker.py` skip at line ~246  
   Same reason/authority as (2).

5. `test_mai07_r2_overlay.py::test_identity_first_base_may_be_promoted_without_demoting_existing_target`  
   Reason: `HISTORICAL_R2_OVERLAY_EXPECTATION`  
   Authority: MAI-07R3C; `ENABLE_PROMOTION_OVERLAY=false`.

6. `test_mai07_r2_overlay.py::test_romanized_lexicon_promotes_when_identity_first_at_base`  
   Reason: `HISTORICAL_R2_OVERLAY_EXPECTATION`  
   Authority: MAI-07R3C; overlay disabled.

## Seventh skip introduced during R3D (resolved)

7. ~~`test_mai07_r3a_review.py::test_active_runtime_reproduces_prer1_semantic_hash`~~  
   Temporary reason: active runtime advanced to `mai-07.1.1-r3d`.  
   **Resolution:** replaced with active test `test_sealed_prer1_v1_semantic_hash_authority_unchanged` that:
   - asserts sealed pre-R1 semantic hash baseline remains `b28e8240…`;
   - asserts parent pre-R1 resource hash remains recorded;
   - asserts active runtime is R3D and overlay stays disabled;
   - does **not** re-evaluate frozen V1 against active R3D (would be frozen retune signal).

Governing authority for the resolution: MAI-07R3A/R3C sealed baselines + MAI-07R3D protocol (active pack may advance; parent hashes immutable; no unexplained active-suite skips).

## Unexplained skips / failures

None. Remaining six skips are historical R1/R2 overlay dispositions only.
