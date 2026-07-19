# MAI-23 — Prompt Registry and Structured Output

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0040](decisions/ADR_0040_PROMPT_REGISTRY_AUTHORITY.md)  
**Runtime:** `mai-23.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate selected prompt template id + structured-output schema ref, then
consume those refs as a system-prompt guide for providers — without granting
posting authority or invoking models from the annotation path.

## Slice 1

1. Ingress `PROMPT_REGISTRY_*` after PROVIDER_CASCADE
2. `PromptRegistryBundleV1` on `CanonicalAIRequestV1` (annotation only)
3. COMPLETE typed plan → template id + schema ref from event_type map
4. Clarification ASK / typed plan SKIP → SKIP
5. `model_invocations=0`; `is_execution_authority=false`

## Slice 2

1. Format COMPLETE registry into a system-prompt directive
2. Forward `prompt_registry` metadata via `policy_decisions` into execution context
3. Append directive in `HttpProviderAdapter._system_prompt` (after MAI-11 register)
4. SKIP / authority-violating bundles → no directive
5. Still annotation authority: no draft mutations; no model calls from registry service

## Gates

| Case | Expect |
|------|--------|
| Complete purchase | COMPLETE; directive includes `erp.purchase.preview.v1` |
| Complete report | COMPLETE; directive includes `erp.report.read.v1` |
| Incomplete / OOD | SKIP; empty directive |
| Any bundle | `model_invocations=0` |

## Non-goals

- Replacing `prompt_grounding.py`
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
