# MAI-07R3G-REAUTHORIZED-002 — Frozen V2 Evaluation Report

## Verdict

**MAI-07R3G-REAUTHORIZED-002 = FAILED_QUALITY**

| Flag | Value |
| --- | --- |
| Frozen V2 opened | **yes** (one-shot consumed) |
| Attempt locked | **yes** (`LOCKED_NOT_RUN` body immutable) |
| One-shot executed | **yes** (696/696) |
| QUALITY_GATES_PASSED | **false** |
| AUTOMATED_ENGINEERING_GATES_PASSED | **false** |
| LINGUIST_APPROVED | **false** |
| PRODUCTION_APPROVED | **false** |
| MAI-07 overall | **NEEDS_CORRECTIVE_WORK** |
| GAP-P1-011 | **OPEN** |
| GAP-P1-012 | **OPEN** |
| GAP-P0-001 | **OPEN** |
| MAI-08 | **NOT_STARTED** |

## Candidate authority

| RC | Disposition |
| --- | --- |
| **RC_002** `MAI_07R3F_LOCK_CHAIN_RELEASE_CANDIDATE_002` | **SELECTED** — physically preserved lock-before-fresh-holdout chain |
| RC_001 `MAI_07R3F_SEAL_NEW_RELEASE_CANDIDATE_001` | `HISTORICAL_RECOVERED_EQUIVALENT_NOT_SELECTED` |

Selection rule: evidence-strength only (not quality-based). Semantic runtime/resource/guard binding identical between chains.

Selection artifact: `evals/mai07/r3g_reauthorized_002/MAI_07R3G_REAUTHORIZED_002_CANDIDATE_SELECTION.json`  
Selection semantic SHA-256: `73350ac500eb021e3a3f2cdd7587b1937c20b7e8fc9316734ad2cd0731dbe46f`

## Attempt

| Field | Value |
| --- | --- |
| Attempt ID | `MAI_07R3G_REAUTHORIZED_002_FROZEN_V2_ATTEMPT_001` |
| Authorization | `EXPLICIT_USER_AUTHORIZATION_MAI_07R3G_REAUTHORIZED_002` |
| Manifest semantic SHA-256 | `1f436834b3abe445072d79f77757ea73d691277bd0fb27a96ad9752b556276ce` |
| Status (immutable body) | `LOCKED_NOT_RUN` |
| Attempt consumed | **true** |
| Prohibited rerun | **true** |

## Runtime / resource / frozen authorities

| Item | SHA-256 / value |
| --- | --- |
| Runtime | `mai-07.1.3-r3f-sealnew` |
| Resource content | `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930` |
| Overlay | disabled |
| V2 dataset | `0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9` |
| V2 manifest | `17331e4d0c703977b80ca893eb5261bb126aa52a6813fe8b4f548b1178c716be` |
| Population manifest | `a8461f62acac98561605e5b2ffb2475bb73a3d15cf0f32ef7b98f1247de85632` |
| Threshold manifest | `aa4b5d68852edbed7cdc5f025b8051b3235078a65fb78bb0aca3a342fcdf04ef` |
| Canonical scorer (LF) | `6e8e30c9c6e2c38d3ea61243e0a22a72e8eb3e17e3d854a0a9a3467b130e9336` |
| Audit scorer (LF) | `c0d7799b5d54057ea768b8c67f9516edefc713d8ebd2d59120f16df3bc102450` |

## Predictions

| Field | Value |
| --- | --- |
| Submitted / completed | 696 / 696 |
| Exceptions / timeouts | 0 / 0 |
| Mutation attempts / successful | 0 / 0 |
| Raw JSONL SHA-256 | `4e8e0f8c12da0f48a2063a97fb895f322195b3da627dd71dfde8ba7c99c5a4a4` |
| Canonical list SHA-256 | `8c071d494a77b3580a7d94e7874120c76da1445df0c74a73166eb96127db3153` |

## Integer gate results

| Metric | Required | Observed | Status |
| --- | ---: | ---: | --- |
| TARGET_TOP1 | ≥254/288 | 258/288 | PASS |
| TARGET_RECALL@5 | ≥274/288 | 281/288 | PASS |
| TARGET_MRR | ≥0.90 | 0.9358 | PASS |
| CORE_RECALL@5 | ≥267/272 | 267/272 | PASS |
| UNAMBIGUOUS_TOP1 | ≥235/255 | 246/255 | PASS |
| ENGLISH_IDENTITY_TOP1 | ≥100/102 | **98/102** | **FAIL** |
| FALSE_DEVANAGARI_ON_ENGLISH | ≤2/102 | **4/102** | **FAIL** |
| PROTECTED_MUTATIONS | 0 | 0 | PASS |
| RAW_VIEW_MUTATIONS | 0 | 0 | PASS |
| CAPS_RESPECTED | 696/696 | 696/696 | PASS |
| DETERMINISTIC_OUTPUT | 1 | 1 | PASS |

Canonical ↔ independent audit scorer: **agree** on all gates and numerators.

## R3E differential (aggregate only)

Identical to R3E on all reported aggregates: English identity 98/102, false Devanagari 4/102, target top-1 258/288, recall@5 281/288. No protected-span regression.

## Post-run immutability

All pinned RC chains, selection, attempt body, R3E artifacts, V1/V2/scorers/thresholds: **unchanged** (`CLOSEOUT.post_run_immutability.ok = true`).

## Historical artifacts preserved

- `evals/mai07/r3e/**` — unchanged  
- `evals/mai07/r3g/**` — unchanged  
- `evals/mai07/r3g_reauthorized/**` blocked preflight — unchanged  

## Security / accounting

No production tenant/company identifiers in predictions. No posting, confirm, sync, or mutation routes invoked. Mutation guard: 0/0.

## Recommended next governed phase

**New non-frozen corrective phase** for English identity / false-Devanagari frozen failure (separate authorization before any re-run). **MAI-08 not started.**
