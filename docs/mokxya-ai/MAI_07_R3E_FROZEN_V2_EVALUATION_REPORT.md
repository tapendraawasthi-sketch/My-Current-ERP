# MAI-07R3E — Frozen V2 Evaluation of Sealed R3D RC

**Verdict:** `FAILED_QUALITY`  
**Authorization:** EXPLICIT_USER_AUTHORIZATION_R3E (one-shot)  
**Runtime evaluated:** `mai-07.1.1-r3d`  
**Resource hash:** `083bce288907c0db882bdf7082bf9093e9086035c653dadcd4964625b61e966f`  
**R3D RC content SHA-256:** `2ebe29fac17b836849e3c3e1054c704a03d762bc5f28879a9a0de2f5a62d2c26`  
**Predictions SHA-256:** `89ee4789333bc1fd5b5ea3b1b505c0a53b7a5f7e159d5966511ead52735a7e9c`

## Flags

| Flag | Value |
| --- | --- |
| QUALITY_GATES_PASSED | **false** |
| AUTOMATED_ENGINEERING_GATES_PASSED | **false** (frozen quality incomplete) |
| LINGUIST_APPROVED | **false** |
| PRODUCTION_APPROVED | **false** |
| MAI-08 | **NOT_STARTED** |
| Overlay | disabled |

## Canonical metrics (locked R3C V2 thresholds)

| Metric | N/D | Value | Threshold | Integer req | Result |
| --- | --- | ---: | --- | --- | --- |
| TARGET_TOP1 | 258/288 | 0.8958 | ≥0.88 | ≥254 | PASS |
| TARGET_RECALL@5 | 281/288 | 0.9757 | ≥0.95 | ≥274 | PASS |
| TARGET_MRR | — | 0.9358 | ≥0.90 | — | PASS |
| CORE_RECALL@5 | 267/272 | 0.9816 | ≥0.98 | ≥267 | PASS |
| UNAMBIGUOUS_TOP1 | 246/255 | 0.9647 | ≥0.92 | ≥235 | PASS |
| ENGLISH_IDENTITY_TOP1 | 98/102 | 0.9608 | ≥0.98 | ≥100 | **FAIL** |
| FALSE_DEVANAGARI_ON_ENGLISH | 4/102 | 0.0392 | ≤0.02 | ≤2 | **FAIL** |
| PROTECTED_MUTATIONS | 0 | 0 | =0 | 0 | PASS |
| RAW_VIEW_MUTATIONS | 0 | 0 | =0 | 0 | PASS |
| CAPS_RESPECTED | 696/696 | 1.0 | =1.0 | — | PASS |
| DETERMINISTIC_OUTPUT | 1 | 1.0 | =1.0 | — | PASS |

Independent audit scorer: **exact agreement** with canonical on target populations/gates.

## vs R3C pre-R1 baseline (diagnostic)

| Metric | R3C | R3E |
| --- | --- | --- |
| TARGET_TOP1 | 254/288 | **258/288** (improved) |
| TARGET_RECALL@5 | 277/288 | **281/288** (improved) |
| TARGET_MRR | 0.9219 | **0.9358** (improved) |
| CORE_RECALL@5 | 263/272 | **267/272** (improved; now PASS) |
| UNAMBIGUOUS_TOP1 | 246/255 | 246/255 (unchanged) |
| English identity | 98/102 | 98/102 (unchanged FAIL) |
| False Devanagari | 4/102 | 4/102 (unchanged FAIL) |
| Protected mutations | 6 | **0** (eliminated; PASS) |

## Protocol notes

- One-shot attempt consumed; `prohibited_rerun=true`.
- No runtime/resource/scorer/threshold/V2 modifications.
- Failed R3D RC preserved; failed R3E predictions/reports preserved.
- Recommended next phase: **MAI-07R3F** non-frozen English-identity corrective (not R3E rerun; not MAI-08).

## Prohibited claims

Do not claim MAI-07 passed, linguist/production approval, or MAI-08 readiness.
