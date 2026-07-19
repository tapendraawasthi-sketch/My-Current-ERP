# MAI-23 — Prompt Registry and Structured Output

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0040](decisions/ADR_0040_PROMPT_REGISTRY_AUTHORITY.md)  
**Runtime:** `mai-23.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate a selected prompt template id and structured-output schema ref on
the canonical request when a typed plan is COMPLETE — without assembling
provider prompts or invoking models.

## Slice 1

1. Ingress `PROMPT_REGISTRY_*` after PROVIDER_CASCADE
2. `PromptRegistryBundleV1` on `CanonicalAIRequestV1` (annotation only)
3. COMPLETE typed plan → template id + schema ref from event_type map
4. Clarification ASK / typed plan SKIP → SKIP
5. `model_invocations=0`; `is_execution_authority=false`

## Gates

| Case | Expect |
|------|--------|
| Complete purchase | COMPLETE; `erp.purchase.preview.v1` |
| Complete report | COMPLETE; `erp.report.read.v1` |
| Incomplete / OOD | SKIP |
| Any bundle | `model_invocations=0` |

## Non-goals

- Provider prompt assembly / consume (later slice)
- Replacing `prompt_grounding.py`
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
