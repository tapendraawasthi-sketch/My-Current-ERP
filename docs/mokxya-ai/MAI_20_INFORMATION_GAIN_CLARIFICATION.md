# MAI-20 — Information-Gain Clarification Engine

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0037](decisions/ADR_0037_INFORMATION_GAIN_CLARIFICATION_AUTHORITY.md)  
**Runtime:** `mai-20.0.1-slice1` (engineering; not production-approved)

## Objective

Turn MAI-19 `EventFrame.missing_required_fields` / `ambiguous_fields` into a
ranked clarification plan — one highest information-gain question at a time —
without posting or mutating drafts.

## Slice 1

1. Ingress `CLARIFICATION_PLAN_*` after EVENT_FRAME_EXTRACTION
2. `ClarificationPlanBundleV1` on `CanonicalAIRequestV1` (annotation only)
3. Ambiguous fields outrank missing required; amount/party high among required
4. `is_execution_authority=false`; no draft store writes
5. Surface/consume into user reply remains slice 2

## Gates

| Case | Expect |
|------|--------|
| Complete purchase | `NOT_NEEDED` |
| `bought 50 kg rice from Ram` | `ASK`; primary qty or amount |
| OOD gibberish | `SKIP` |
| Any plan | `is_execution_authority=false` |

## Non-goals

- Typed planner / tool loop (MAI-21)
- Draft merge / posting
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
