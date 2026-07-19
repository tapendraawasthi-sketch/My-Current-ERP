# MAI-26 — Temporal, Amendment, and Cross-Reference Model

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0043](decisions/ADR_0043_TEMPORAL_CROSS_REF_AUTHORITY.md)  
**Runtime:** `mai-26.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate temporal, amendment, and cross-reference cues on the canonical request
when knowledge-source governance is COMPLETE — without proving legal effective
dates or applying amendments.

## Slice 1

1. Ingress `TEMPORAL_CROSS_REF_*` after EXTRACTION_OCR_PLAN
2. `TemporalCrossRefBundleV1` on `CanonicalAIRequestV1`
3. Detect date / FY / amendment / section / act-rule cues in raw_text
4. Optional `as_of_candidate` from parseable date surfaces (candidate only)
5. `legal_effective_dates_proven=false`; `amendment_applied=false`
6. Governance SKIP / empty text → SKIP

## Gates

| Case | Expect |
|------|--------|
| Plain purchase | COMPLETE; may have zero cues |
| Date / FY / amendment language | matching temporal cues; not proven |
| Section / Act ref | cross-ref cues |
| OOD | SKIP |
| Any bundle | `legal_effective_dates_proven=false` |

## Non-goals

- Proven Nepal-law effective-date registry
- Applying supersession to knowledge docs
- Closing GAP-P2-008 / GAP-P1-004 / GAP-P1-008
- Production approval
