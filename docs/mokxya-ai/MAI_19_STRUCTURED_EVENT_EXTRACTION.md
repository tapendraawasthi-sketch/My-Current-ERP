# MAI-19 — Structured Event Extraction

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0036](decisions/ADR_0036_STRUCTURED_EVENT_EXTRACTION_AUTHORITY.md)  
**Runtime:** `mai-19.0.1-slice1` (engineering; not production-approved)

## Objective

Fill the MAI-18 EventFrame skeleton with deterministic field values from the
user message — without posting or mutating drafts.

## Slice 1

1. Ingress `EVENT_FRAME_EXTRACTION_*` after EVENT_SPEC_REGISTRY
2. Purchase/sales: party + amount; report: report_type
3. Unknown / dialogue / accounting_qa: skip fill
4. `authorizes_posting=false`; no draft store writes

## Slice 2 (planned)

1. Richer optional fields (payment_mode, item, date)
2. Ambiguous number handling
3. Hand off missing fields to MAI-20 clarification

## Gates

| Case | Expect |
|------|--------|
| `Ram bata 500 ko saman kine` | COMPLETE; party+amount |
| `show balance sheet` | COMPLETE; report_type=balance_sheet |
| OOD gibberish | EMPTY; no values |
| Any extraction | `authorizes_posting=false` |

## Non-goals

- Clarification engine (MAI-20)
- Draft merge / posting
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
