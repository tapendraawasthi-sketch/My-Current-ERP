# MAI-22 — Provider Port and Model Cascade

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0039](decisions/ADR_0039_PROVIDER_CASCADE_AUTHORITY.md)  
**Runtime:** `mai-22.0.1-slice1` (engineering; not production-approved)

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

## Gates

| Case | Expect |
|------|--------|
| Complete purchase | COMPLETE; selected_provider_id set |
| Incomplete (qty/amount missing) | SKIP |
| OOD gibberish | SKIP |
| Any bundle | `model_invocations=0` |

## Non-goals

- Live adapter.invoke / start_execution consume (later slice)
- Prompt registry (MAI-23)
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
