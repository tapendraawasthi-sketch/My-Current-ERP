# ADR_0038 — Typed Planner Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-21-TYPED-PLANNER-AND-TOOL-LOOP (slice 1)
- **Extends:** ADR_0001, ADR_0037

## Context

MAI-20 produces a clarification plan and may ASK. Downstream planning needs a
typed `PlanV1` on the request path without becoming tool-execution or posting
authority. The legacy `PlannerService` / SQLite planner remains a separate
module; GAP-P0-004 (HTTP import) is already CLOSED and is not a MAI-21 blocker.

## Decision

1. MAI-21 owns `TypedPlanBundleV1` on `CanonicalAIRequestV1` after
   CLARIFICATION_PLAN.
2. Slice 1: annotation-only DRAFT `PlanV1` when EventFrame is COMPLETE and
   clarification is not ASK; READ steps only; `proposed_tool_calls=()`;
   `tool_executions=0`; `is_execution_authority=false`.
3. Always prohibit `erp.confirm_draft` in annotated plans.
4. Does not call `PlannerService.create_plan`, execute tools, or post.
5. Slice 2 (later): authorized tool proposals / loop under constitution gates.
6. Gaps GAP-P1-004 / GAP-P1-008 stay REDUCED.
7. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Call PlannerService from ingress | Wrong authority / side effects |
| Authorize confirm_draft in slice 1 | Posting path forbidden |
| Plan while clarification ASK | Incomplete frame; fail-closed |

## Related

- `docs/mokxya-ai/MAI_21_TYPED_PLANNER_AND_TOOL_LOOP.md`
- `erp_bot/src/oip/modules/conversation/application/typed_plan_service.py`
