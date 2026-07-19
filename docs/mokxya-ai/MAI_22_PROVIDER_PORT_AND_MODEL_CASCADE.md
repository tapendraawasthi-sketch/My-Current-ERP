# MAI-22 — Provider Port and Model Cascade

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0039](decisions/ADR_0039_PROVIDER_CASCADE_AUTHORITY.md)  
**Runtime:** `mai-22.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate a deterministic provider cascade (selected provider + ordered
fallbacks) on the canonical request when a typed plan is COMPLETE — without
invoking models or mutating drafts.

## Slice 1

1. Ingress `PROVIDER_CASCADE_*` after TYPED_PLAN
2. `ProviderCascadeBundleV1` on `CanonicalAIRequestV1` (annotation only)
3. COMPLETE typed plan → selected provider + cascade_order / fallback_chain
4. Clarification ASK / typed plan SKIP → SKIP
5. `model_invocations=0`; `is_execution_authority=false`

## Slice 2

1. `apply_provider_cascade_to_route` overlays COMPLETE cascade onto RouteDecision
2. Wired in ExecutionStageAdapter before `start_execution`
3. SKIP / non-COMPLETE → keep router cascade (no-op)
4. Bundle remains non-execution-authority; runtime invokes via existing provider path

## Gates

| Case | Expect |
|------|--------|
| Complete purchase | COMPLETE; route primary overridden |
| Incomplete (qty/amount missing) | SKIP; route unchanged |
| OOD gibberish | SKIP |
| Any bundle | `is_execution_authority=false` |

## Non-goals

- Prompt registry (MAI-23)
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
