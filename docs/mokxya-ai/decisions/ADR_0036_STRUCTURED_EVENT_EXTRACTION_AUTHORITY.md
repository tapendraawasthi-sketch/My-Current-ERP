# ADR_0036 — Structured Event Extraction Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-19-STRUCTURED-EVENT-EXTRACTION (slice 1)
- **Extends:** ADR_0001, ADR_0035

## Context

MAI-18 attaches an EventFrame skeleton with required fields marked missing.
Downstream clarification (MAI-20) and planning need deterministic value fill
from the user message without silent draft writes or posting authority.

## Decision

1. MAI-19 owns deterministic extraction into `CanonicalAIRequestV1.event_frame`
   after EVENT_SPEC_REGISTRY.
2. Slice 1: purchase/sales/report only — party, amount, report_type via
   draft extractors + Nepali-aware cues; unknown/dialogue/qa skip fill.
3. Update `missing_required_fields` / `status`; `authorizes_posting` stays false.
4. Never call `start_or_merge_*` / `save_draft` from this path.
5. Slice 2 (later): richer fields; clarification consume remains MAI-20.
6. Gaps GAP-P1-004 / GAP-P1-008 stay REDUCED.
7. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Extract inside MAI-18 skeleton attach | Mixes registry vs extraction authority |
| Silent draft merge on extract | Violates fail-closed constitution |
| LLM extraction in slice 1 | Non-deterministic; deferred |

## Related

- `docs/mokxya-ai/MAI_19_STRUCTURED_EVENT_EXTRACTION.md`
- `erp_bot/src/oip/modules/conversation/application/event_frame_extraction_service.py`
