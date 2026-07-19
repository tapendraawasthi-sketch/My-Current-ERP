# MAI-15 — Reference, Coreference, and Correction

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0032](decisions/ADR_0032_REFERENCE_COREFERENCE_CORRECTION_AUTHORITY.md)  
**Runtime:** `mai-15.0.1-slice1` (engineering; not production-approved)

## Objective

Expose typed discourse mention and correction candidates so later slices can
fill slots / refine turn-relation — without applying mutations in slice 1.

## Slice 1

1. `ReferenceCoreferenceBundleV1` on `CanonicalAIRequestV1` after MAI-14
2. Lexicon: negate-replace amounts, `make it N`, prior cues (`tyo` / `pahile ko`)
3. Bind FOUND draft when available; else AMBIGUOUS / UNRESOLVED
4. Metadata + ingress stages; never `applied=true`
5. `evals/mai15` + baseline

## Gates

| Case | Expect |
|------|--------|
| `500 hoina 600` + FOUND draft | amount correction candidate |
| `tyo` without draft | AMBIGUOUS prior mention |
| confirm-only | no corrections |
| Bundle | `silent_applications=0`; raw_text unchanged |

## Non-goals

- Applying corrections into pending drafts (slice 2)
- Changing `allows_pending_merge`
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
