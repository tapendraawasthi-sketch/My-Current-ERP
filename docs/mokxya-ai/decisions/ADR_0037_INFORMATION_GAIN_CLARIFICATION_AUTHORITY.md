# ADR_0037 — Information-Gain Clarification Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-20-INFORMATION-GAIN-CLARIFICATION (slice 1)
- **Extends:** ADR_0001, ADR_0036

## Context

MAI-19 fills EventFrame values and leaves `missing_required_fields` /
`ambiguous_fields`. Downstream UX still uses draft-slot `clarification_message`
helpers and NLU slot planners that are not EventFrame-authoritative. MAI-20
must rank questions by information gain without becoming posting authority.

## Decision

1. MAI-20 owns `ClarificationPlanBundleV1` on `CanonicalAIRequestV1` after
   EVENT_FRAME_EXTRACTION.
2. Slice 1: annotation-only plan — ranked targets + one `question_text`;
   `is_execution_authority=false`; `silent_applications=0`; `draft_mutations=0`.
3. Ambiguous fields (e.g. qty-unit) outrank missing required so numbers are
   never silently treated as money.
4. Slice 2 (later): consume/surface the plan in response path; may bridge
   legacy `clarification_message` helpers as non-authoritative presentation.
5. Does not call `start_or_merge_*` / `save_draft` from this path.
6. Gaps GAP-P1-004 / GAP-P1-008 stay REDUCED.
7. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Ask all missing fields at once | Low information density; poor UX |
| Treat plan as execution authority | Violates constitution |
| Silent draft merge on plan attach | Fail-closed violation |

## Related

- `docs/mokxya-ai/MAI_20_INFORMATION_GAIN_CLARIFICATION.md`
- `erp_bot/src/oip/modules/conversation/application/clarification_plan_service.py`
