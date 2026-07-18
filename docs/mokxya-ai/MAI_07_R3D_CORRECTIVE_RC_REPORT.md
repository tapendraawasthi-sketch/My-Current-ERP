# MAI-07R3D — Corrective Release Candidate Report

**Verdict:** `PASSED_CORRECTIVE_RC`  
**Frozen V2:** not rerun (QUALITY_GATES_PASSED remains false)  
**LINGUIST_APPROVED:** false  
**PRODUCTION_APPROVED:** false  
**Overlay:** disabled  
**Next:** MAI-07R3E (frozen V2 release evaluation)

## Runtime / resources

| Item | Value |
| --- | --- |
| Runtime | `mai-07.1.1-r3d` |
| Resource pack | `mai-07.1.1-r3d` |
| Resource content hash | `083bce288907c0db882bdf7082bf9093e9086035c653dadcd4964625b61e966f` |
| Parent pre-R1 resource hash | `18628335c0feb74a4f28f65ca70b2683f8b54a54790fd03e9033d8cd08ed4566` |
| RC manifest SHA-256 | `2ebe29fac17b836849e3c3e1054c704a03d762bc5f28879a9a0de2f5a62d2c26` |
| Holdout predictions SHA-256 | `1d3b04d60d6621af4ffe3c46c2776a85630043ba4194269c31b2604fa8c0b4b5` |

## Corrective datasets (non-frozen)

Path: `evals/mai07_r3d_corrective/`

| Split | Cases | SHA-256 |
| --- | ---: | --- |
| DEVELOPMENT | 930 | `4c4f2988e56ba205db532e010b068586b708ec4383a6f70b4a0a35c766ca37aa` |
| HOLDOUT_VALIDATION | 477 | `f60d19b851dd05b7be27fb8c3c908e77ed5c8f34ed1d5dbfbf326eaa99aa5d7a` |
| SAFETY_CHALLENGE | 633 | `993a065146b4fc2ede0f1fe12a4f8b0dc9171d0efbb64e73f389bee4926533c6` |

Total unique ≥1250. Frozen V2 case bodies not used. V1 exact sentence/ID collisions = 0. Vocabulary overlap with V1 reported honestly (~297 tokens).

## Locked holdout gates (one-shot)

All engineering gates passed on HOLDOUT_VALIDATION after RC lock. Dual scorers agreed on metrics. Harm count = 0. Protected mutations = 0. English identity top-1 = 76/76. False Devanagari on English = 0/76. Target top-1 / recall@5 / MRR / core recall@5 = 212/212 (1.0) on labeled target cases.

**Non-claim:** Non-frozen holdout is **not** equivalent to frozen V2 quality gates.

## Firewall

R3D runtime/eval builders do not import frozen V2 predictions, per-case audits, or R3B review packages. Proven by `test_mai07_r3d_firewall.py`.

## language_runtime suite comparison

| Point | Passed | Skipped | Failed |
| --- | ---: | ---: | ---: |
| Pre-R3D | 232 | 6 | 0 |
| Post-R3D (temp R3A skip) | 255 | 7 | 0 |
| Post-R3D (skip resolved) | **256** | **6** | **0** |

The temporary seventh skip (`test_active_runtime_reproduces_prer1_semantic_hash`) was **not** retained. It was replaced by active `test_sealed_prer1_v1_semantic_hash_authority_unchanged` (sealed `pre_closure_semantic_hash` + parent hashes). Remaining six skips are historical R1/R2 overlay dispositions only — see `docs/mokxya-ai/baselines/MAI_07R3D_LANGUAGE_RUNTIME_SKIP_DISPOSITION.md`.
