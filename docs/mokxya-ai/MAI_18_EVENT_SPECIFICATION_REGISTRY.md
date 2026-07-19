# MAI-18 — Event Specification Registry

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0035](decisions/ADR_0035_EVENT_SPECIFICATION_REGISTRY_AUTHORITY.md)  
**Runtime:** `mai-18.0.1-slice1` (engineering; not production-approved)

## Objective

Expose a typed, deterministic registry of ERP event specifications on the
canonical request path after MAI-17 — without filling EventFrame or mutating
drafts.

## Slice 1

1. `EventSpecRegistryBundleV1` + `EventSpecCandidateV1` on `CanonicalAIRequestV1`
2. Lookup from router `(intent_family, operation_class, intent_hint)`
3. Ingress `EVENT_SPEC_REGISTRY_*` after ROUTING; metadata `event_spec_registry`
4. OOD / UNKNOWN → `unknown_v1`; never execution authority

## Slice 2 (planned) / MAI-19

1. Consume `selected_spec_id` to guide EventFrame extraction
2. Surface missing required fields for clarification
3. Still no silent draft writes

## Gates

| Case | Expect |
|------|--------|
| Purchase create cue | `purchase_v1` selected |
| Balance sheet | `report_v1` |
| OOD gibberish | `unknown_v1` |
| Missing router | PARTIAL + `unknown_v1` |
| Any registry run | `draft_mutations=0`, not execution authority |

## Non-goals

- EventFrame population (MAI-19)
- Planner / ExecutionIntentRegistry rewrite
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
