# MAI-18 — Event Specification Registry

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING` (not production-approved)  
**Authority:** [ADR_0035](decisions/ADR_0035_EVENT_SPECIFICATION_REGISTRY_AUTHORITY.md)  
**Runtime:** `mai-18.0.2-slice2` (engineering; not production-approved)

## Objective

Expose a typed, deterministic registry of ERP event specifications on the
canonical request path after MAI-17 — without filling EventFrame or mutating
drafts.

## Slice 1

1. `EventSpecRegistryBundleV1` + `EventSpecCandidateV1` on `CanonicalAIRequestV1`
2. Lookup from router `(intent_family, operation_class, intent_hint)`
3. Ingress `EVENT_SPEC_REGISTRY_*` after ROUTING; metadata `event_spec_registry`
4. OOD / UNKNOWN → `unknown_v1`; never execution authority

## Slice 2

1. Attach `EventFrameV1` skeleton from selected spec
2. `missing_required_fields` = spec required fields; values stay empty
3. Metadata `event_frame`; ingress rejects non-empty values / posting marks
4. MAI-19 will extract values into the frame

## Gates

| Case | Expect |
|------|--------|
| Purchase create cue | `purchase_v1` + frame missing `{party, amount}` |
| Balance sheet | `report_v1` + missing `report_type` |
| OOD gibberish | `unknown_v1` + EMPTY frame |
| Missing router | PARTIAL + `unknown_v1` |
| Any registry/skeleton | `values=[]`, `authorizes_posting=false` |

## Non-goals

- EventFrame population (MAI-19)
- Planner / ExecutionIntentRegistry rewrite
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
