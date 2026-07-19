# MAI-21 — Typed Planner and Tool Loop

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0038](decisions/ADR_0038_TYPED_PLANNER_AUTHORITY.md)  
**Runtime:** `mai-21.0.2-slice2` (engineering; not production-approved)

## Objective

Attach a typed `PlanV1` annotation to the canonical request from a COMPLETE
EventFrame when clarification is not pending — without executing tools or
posting.

## Slice 1

1. Ingress `TYPED_PLAN_*` after CLARIFICATION_PLAN
2. `TypedPlanBundleV1` on `CanonicalAIRequestV1` (annotation only)
3. COMPLETE purchase/report → DRAFT `PlanV1` with READ steps only
4. ASK clarification / incomplete / OOD → SKIP (no plan)
5. `erp.confirm_draft` always prohibited
6. `is_execution_authority=false`; `tool_executions=0`

## Slice 2

1. Propose READ `ToolCallV1` from plan steps
2. Constitution-style gate → AUTHORIZED / DENIED
3. READY plan when ≥1 AUTHORIZED; still no execution
4. Ingress `assert_typed_plan_authority` rejects mutation/confirm/executing

## Gates

| Case | Expect |
|------|--------|
| Complete purchase | COMPLETE; AUTHORIZED preview proposal |
| Incomplete (qty/amount missing) | SKIP; no proposals |
| OOD gibberish | SKIP |
| confirm_draft | DENIED / never proposed |
| Any bundle | `tool_executions=0` |

## Non-goals

- Actual tool execution / observation loop
- `PlannerService` / SQLite plan writes from ingress
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
