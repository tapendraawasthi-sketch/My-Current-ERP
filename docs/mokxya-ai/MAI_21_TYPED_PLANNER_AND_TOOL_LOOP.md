# MAI-21 — Typed Planner and Tool Loop

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0038](decisions/ADR_0038_TYPED_PLANNER_AUTHORITY.md)  
**Runtime:** `mai-21.0.1-slice1` (engineering; not production-approved)

## Objective

Attach a typed `PlanV1` annotation to the canonical request from a COMPLETE
EventFrame when clarification is not pending — without executing tools or
posting.

## Slice 1

1. Ingress `TYPED_PLAN_*` after CLARIFICATION_PLAN
2. `TypedPlanBundleV1` on `CanonicalAIRequestV1` (annotation only)
3. COMPLETE purchase/report → DRAFT `PlanV1` with READ steps only
4. ASK clarification / incomplete / OOD → SKIP (no plan)
5. `erp.confirm_draft` always prohibited; `proposed_tool_calls` empty
6. `is_execution_authority=false`; `tool_executions=0`

## Gates

| Case | Expect |
|------|--------|
| Complete purchase | COMPLETE; DRAFT plan; no confirm tool |
| Incomplete (qty/amount missing) | SKIP |
| OOD gibberish | SKIP |
| Any bundle | `tool_executions=0` |

## Non-goals

- Tool loop execution (later slice)
- `PlannerService` / SQLite plan writes from ingress
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
