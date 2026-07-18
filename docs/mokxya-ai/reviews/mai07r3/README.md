# MAI-07R3 Review Packet + R3B Import

Status: **R3B_REVIEW_IMPORT_POLICY_LOCK_PASSED** (import/governance only)

MAI-07 overall remains **NEEDS_CORRECTIVE_WORK**.  
`QUALITY_GATES_PASSED=false`. `LINGUIST_APPROVED=false`. `PRODUCTION_APPROVED=false`.  
**MAI-08 NOT_STARTED.**

This directory contains blinded Round A/B materials, locked human responses, the
official five-label Round B conversion (mechanical bulk mapping), completed
import object, unblinded adjudication (import-only), and V2 evaluation semantics.

It does **not** activate a new ranker, rewrite frozen V1, enable the failed R2
overlay, or authorize a frozen quality pass.

## Authority

| Artifact | Role |
|----------|------|
| Round A locked CSV | Product-ranking / population authority |
| Round B broad locked CSV | Three-label source evidence (immutable) |
| Round B official locked CSV | Five-label labels via authorized bulk mapping |
| Blind mapping | `adjudication_import_only` — never runtime/training/reviewer UI |
| Import JSONL | `mai07r3_review_import_v1` completed object |
| ADR_0009 | Option A product policy approved; implementation pending |

## Bulk mapping (explicit user authorization)

- `ACCEPTABLE` → `ACCEPTABLE_PREFERRED`
- `UNACCEPTABLE` → `UNNATURAL_BUT_POSSIBLE`
- `CANNOT_DECIDE` → `CANNOT_DECIDE`

Not a professional-linguist candidate-by-candidate five-label review.

## Process (completed through R3B import)

1. Round A completed and locked.
2. Round B completed and locked (three-label).
3. Official five-label conversion via authorized bulk mapping.
4. Import via `import_mai07r3b_reviews.py` (hash + cardinality fail-closed).
5. Frozen quality evaluation remains **unauthorized** until a later governed phase.

## Key hashes

| Item | SHA-256 |
|------|---------|
| Round A locked | `f01270e3017162259d2d305e158e86e386eb86841e4928b99546cd613d037f49` |
| Round B broad locked | `79e229ebb381f76599e83c68a69fd40324a1efba196202e82afa15bfc44c8a61` |
| Round B official | `642bc6f39d6eb2797974e704cd32034f520abf0c5df43cb8aa9dcb06a8438021` |
| Blind mapping | `b6888bfd207d0dd225ecf2c9d403dad9a5c761eede1ddcfba4cd97d1701bcfd6` |
| Import completed | `6cfb5a7bdaacfb3a4bbe63a4d35c5e6077dadb0e620c22454413a774ef2ce9e3` |
| Frozen V1 parent | `5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208` |

See also `MAI_07R3B_IMPORT_LOCK_MANIFEST.json`.
