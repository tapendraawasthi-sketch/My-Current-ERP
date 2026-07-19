# MAI-26 — Temporal, Amendment, and Cross-Reference Model

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0043](decisions/ADR_0043_TEMPORAL_CROSS_REF_AUTHORITY.md)  
**Runtime:** `mai-26.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate temporal / cross-reference cues, then consume `as_of_candidate` into
knowledge retrieval filtering — without proving legal effective dates or
applying amendments.

## Slice 1

1. Ingress `TEMPORAL_CROSS_REF_*` after EXTRACTION_OCR_PLAN
2. `TemporalCrossRefBundleV1` cue detection when governance COMPLETE
3. Optional `as_of_candidate`; `legal_effective_dates_proven=false`

## Slice 2

1. `resolve_retrieval_as_of` → normalized timestamp when COMPLETE + candidate
2. `KnowledgeStageAdapter` passes `as_of` into `knowledge.retrieve`
3. Amendment language → `amendment_cues_present` / `CUES_ONLY` (never applied)
4. False `legal_effective_dates_proven` / `amendment_applied` blocks consume
5. Forward cues into `policy_decisions` with authority flags stripped

## Gates

| Case | Expect |
|------|--------|
| Date cue | as_of applied to retrieval; not proven |
| Amendment cue | cues present; `amendment_applied=false` |
| OOD / no date | no as_of override |
| Proven claim in metadata | consume blocked |

## Non-goals

- Proven Nepal-law effective-date registry
- Applying supersession to knowledge docs
- Closing GAP-P2-008 / GAP-P1-004 / GAP-P1-008
- Production approval
