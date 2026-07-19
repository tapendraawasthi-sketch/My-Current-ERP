# MAI-15 — Reference, Coreference, and Correction

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING` (not production-approved)  
**Authority:** [ADR_0032](decisions/ADR_0032_REFERENCE_COREFERENCE_CORRECTION_AUTHORITY.md)  
**Runtime:** `mai-15.0.2-slice2` (engineering; not production-approved)

## Objective

Expose typed discourse mention and correction candidates, then consume
parseable amount corrections into pending purchase/sale drafts under a
strict CORRECT gate.

## Slice 1

1. `ReferenceCoreferenceBundleV1` on `CanonicalAIRequestV1` after MAI-14
2. Lexicon: negate-replace amounts, `make it N`, prior cues
3. Never `applied=true` on candidates

## Slice 2

1. Project correction payloads in `metadata.reference_coreference`
2. Thread into `mode_aware` via preprocess
3. `select_amount_correction_overlay` → `field_overrides` on purchase/sale
4. Emit `AppliedCorrectionReceipt` after save; candidates stay `applied=false`
5. Only when `turn_relation == CORRECT_ACTIVE_DRAFT`

## Gates

| Case | Expect |
|------|--------|
| CORRECT + `500 hoina 600` + pending purchase | `total_amount=600` + receipt |
| CONFIRMATION | no amount write |
| ANSWER_CLARIFICATION + amount meta | no MAI-15 overlay |
| GENERIC_CORRECT (no value) | no write |

## Non-goals

- Party/field corrections beyond amount
- Changing `allows_pending_merge`
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
