# ADR_0043 — Temporal / Amendment / Cross-Reference Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-26-TEMPORAL-AMENDMENT-AND-CROSS-REFERENCE (slice 1)
- **Extends:** ADR_0001, ADR_0042

## Context

MAI-25 owns structural segmentation and extraction/OCR planning. Knowledge
documents have `EffectiveDateRange` fields, but Nepal-law effective dates and
amendment application are not proven on the request path. MAI-26 must first
annotate temporal and cross-reference cues without claiming legal proof.

## Decision

1. MAI-26 owns `TemporalCrossRefBundleV1` on `CanonicalAIRequestV1` after
   EXTRACTION_OCR_PLAN.
2. Slice 1: deterministic cue detection when knowledge-source governance is
   COMPLETE; optional `as_of_candidate` from date surface forms;
   `legal_effective_dates_proven=false`; `amendment_applied=false`;
   `documents_mutated=0`; `is_execution_authority=false`.
3. Does not rewrite knowledge documents, apply supersession, or assert law
   currency.
4. Slice 2 (later): consume cues into retrieval `as_of` / amendment filters
   under fail-closed gates (still without claiming legal proof unless gated).
5. GAP-P2-008 stays OPEN; GAP-P1-004 / GAP-P1-008 stay REDUCED.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Claim Nepal-law dates proven in slice 1 | Ledger blocker / false authority |
| Auto-apply amendments | Side effects / wrong authority |
| Mutate knowledge documents | Immutability violation |

## Related

- `docs/mokxya-ai/MAI_26_TEMPORAL_AMENDMENT_AND_CROSS_REFERENCE.md`
- `erp_bot/src/oip/modules/conversation/application/temporal_cross_ref_service.py`
