# MAI-07R3I-FROZEN-REAUTHORIZED — Frozen V2 Evaluation Report

## Verdict

**MAI-07R3I-FROZEN-REAUTHORIZED = FAILED_QUALITY**

| Flag | Value |
| --- | --- |
| Frozen V2 opened | **yes** (one-shot consumed) |
| Attempt locked | **yes** (`LOCKED_NOT_RUN` body immutable) |
| One-shot executed | **yes** (696/696) |
| QUALITY_GATES_PASSED | **false** |
| AUTOMATED_ENGINEERING_GATES_PASSED | **false** (this frozen quality attempt) |
| LINGUIST_APPROVED | **false** |
| PRODUCTION_APPROVED | **false** |
| MAI-07 overall | **NEEDS_CORRECTIVE_WORK** |
| GAP-P1-011 | **OPEN** |
| GAP-P1-012 | **OPEN** |
| GAP-P0-001 | **OPEN** |
| R3H2 pack promoted | **no** (active remains R3F) |
| MAI-08 | **NOT_STARTED** |

## Candidate authority

| Item | Value |
| --- | --- |
| Selected RC | `MAI_07R3H2_SHARED_COLLISION_RELEASE_CANDIDATE_001` |
| Lock semantic | `bec4b8662a5ba9973253b05555151d71366a329f0425fa382a35a5916364d03c` |
| Candidate pack | `mai-07.1.5-r3h2-shared` |
| Resource content | `8716589a172b47c4d4b3a2419ee442b5b3c0aa170e2bb5e9aff742810878e60a` |
| Policy | `mai-07-r3h2.1.0.0` |
| Overlay | disabled |
| Default active pack (unchanged) | `mai-07.1.3-r3f-sealnew` / `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930` |

Authorization: `EXPLICIT_USER_AUTHORIZATION_MAI_07R3I_FROZEN_REAUTHORIZED`

## Attempt

| Field | Value |
| --- | --- |
| Attempt ID | `MAI_07R3I_FROZEN_V2_ATTEMPT_001` |
| Manifest semantic SHA-256 | `0f1568baa184e1263a36677c9b0e05bf607327ce371243bdc70c5759354c2e65` |
| On-disk lock file SHA-256 | `72aa46d7334507766d07890aea7678003ef0c12523ac388c4903ce7b6815f1f7` |
| Status (immutable body) | `LOCKED_NOT_RUN` |
| Attempt consumed | **true** |
| Prohibited rerun | **true** |
| Mid-score recovery | Predictions completed in first execute; scoring resumed from existing JSONL without re-invoking runtime on frozen cases |

## Frozen authorities (unchanged)

| Item | SHA-256 |
| --- | --- |
| V1 dataset | `5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208` |
| V2 dataset | `0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9` |
| V2 manifest | `17331e4d0c703977b80ca893eb5261bb126aa52a6813fe8b4f548b1178c716be` |
| Population manifest | `a8461f62acac98561605e5b2ffb2475bb73a3d15cf0f32ef7b98f1247de85632` |
| Frozen thresholds | `aa4b5d68852edbed7cdc5f025b8051b3235078a65fb78bb0aca3a342fcdf04ef` |
| Canonical scorer (LF) | `6e8e30c9c6e2c38d3ea61243e0a22a72e8eb3e17e3d854a0a9a3467b130e9336` |
| Audit scorer (LF) | `c0d7799b5d54057ea768b8c67f9516edefc713d8ebd2d59120f16df3bc102450` |

R3H2 non-frozen thresholds (`c79c77ec…`) were **not** substituted.

## Predictions

| Field | Value |
| --- | --- |
| Submitted / completed | 696 / 696 |
| Exceptions / timeouts | recovery note only / 0 |
| Accounting mutation attempts / successful | 0 / 0 |
| Raw JSONL SHA-256 | `15f6ba5537d52682e57647eebc225e655f17d61c29c26f82a65c56967beb4e92` |
| Canonical / semantic list SHA-256 | `38864d9e4097248804e65271400a65047a652a991abb2ce92c27107bd83836c2` |

## Integer gate results

| Metric | Required | Observed | Status |
| --- | ---: | ---: | --- |
| TARGET_TOP1 | ≥254/288 | **240/288** | **FAIL** |
| TARGET_RECALL@5 | ≥274/288 | 281/288 | PASS |
| TARGET_MRR | ≥0.90 | 0.9045 | PASS |
| CORE_RECALL@5 | ≥267/272 | 267/272 | PASS |
| UNAMBIGUOUS_TOP1 | ≥235/255 | **228/255** | **FAIL** |
| ENGLISH_IDENTITY_TOP1 | ≥100/102 | **99/102** | **FAIL** |
| FALSE_DEVANAGARI_ON_ENGLISH | ≤2/102 | **3/102** | **FAIL** |
| PROTECTED_MUTATIONS | 0 | **6** | **FAIL** |
| RAW_VIEW_MUTATIONS | 0 | 0 | PASS |
| CAPS_RESPECTED | 696/696 | 696/696 | PASS |
| DETERMINISTIC_OUTPUT | 1 | 1 | PASS |

Canonical ↔ independent audit scorer: **agree**. Mathematical invariants: **hold**.

## R3G-002 differential (aggregate only)

| Metric | R3G-002 | R3I | Delta |
| --- | ---: | ---: | ---: |
| Target top-1 | 258/288 | 240/288 | −18 |
| Target recall@5 | 281/288 | 281/288 | 0 |
| MRR | 0.9358 | 0.9045 | −0.0313 |
| Core recall@5 | 267/272 | 267/272 | 0 |
| Unambiguous top-1 | 246/255 | 228/255 | −18 |
| English identity | 98/102 | 99/102 | +1 |
| False Devanagari | 4/102 | 3/102 | −1 |
| Protected mutations | 0 | 6 | +6 |

Identity→target transitions (aggregate): 40. Target→identity: 19. No frozen text published. Diagnostics must not retune this candidate.

## Post-run immutability

`CLOSEOUT.post_run_immutability.ok = true`. R3H2 lock/chain/qualification, default active pack, V1/V2/populations/thresholds/scorers, and historical frozen attempts remain unchanged. R3H2 pack **not** promoted.

## Security / accounting

No production tenant/company identifiers in public reports. No posting, confirm, sync, or OEC routes invoked. Accounting mutation guard: 0/0. Protected-span mutations counted by frozen scorer: 6 (quality fail).

## Recommended next governed phase

**Do not** automatically recommend another V2-tuned correction. Prefer a **governance decision** for an independently reviewed **V3** frozen benchmark and/or professional linguist adjudication. **MAI-08 remains NOT_STARTED.** Do not promote `mai-07.1.5-r3h2-shared`.
