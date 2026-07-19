# ADR_0043 — Temporal / Amendment / Cross-Reference Authority

- **Status:** Accepted (2026-07-19); slice 2 addendum (2026-07-19)
- **Phase:** MAI-26-TEMPORAL-AMENDMENT-AND-CROSS-REFERENCE (slice 2)
- **Extends:** ADR_0001, ADR_0042

## Context

MAI-25 owns structural segmentation and extraction/OCR planning. Knowledge
documents have `EffectiveDateRange` fields, but Nepal-law effective dates and
amendment application are not proven on the request path. MAI-26 must annotate
temporal/cross-reference cues, then consume `as_of` as a retrieval filter hint
without claiming legal proof.

## Decision

1. MAI-26 owns `TemporalCrossRefBundleV1` on `CanonicalAIRequestV1` after
   EXTRACTION_OCR_PLAN.
2. Slice 1: deterministic cue detection when knowledge-source governance is
   COMPLETE; optional `as_of_candidate` from date surface forms;
   `legal_effective_dates_proven=false`; `amendment_applied=false`;
   `documents_mutated=0`; `is_execution_authority=false`.
3. Slice 2: `resolve_retrieval_as_of` feeds `KnowledgeStageAdapter` →
   `knowledge.retrieve(as_of=...)` when COMPLETE + candidate present;
   amendment stays `CUES_ONLY` (`amendment_applied=false`); false proof /
   amendment flags block consume.
4. Does not rewrite knowledge documents, apply supersession, or assert law
   currency.
5. GAP-P2-008 stays OPEN; GAP-P1-004 / GAP-P1-008 stay REDUCED.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Claim Nepal-law dates proven | Ledger blocker / false authority |
| Auto-apply amendments / supersession | Side effects / wrong authority |
| Mutate knowledge documents | Immutability violation |
| Apply as_of when proof flag true | Fail-closed against false authority |

## Related

- `docs/mokxya-ai/MAI_26_TEMPORAL_AMENDMENT_AND_CROSS_REFERENCE.md`
- `erp_bot/src/oip/modules/conversation/application/temporal_cross_ref_service.py`
