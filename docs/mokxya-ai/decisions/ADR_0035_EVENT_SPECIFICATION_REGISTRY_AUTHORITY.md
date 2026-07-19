# ADR_0035 — Event Specification Registry Authority

- **Status:** Accepted (2026-07-19); slice 2 addendum same day
- **Phase:** MAI-18-EVENT-SPECIFICATION-REGISTRY (slice 2)
- **Extends:** ADR_0001, ADR_0034

## Context

MAI-17 provides domain / intent-family / OOD on the request path, but there is
no typed registry of ERP event specifications (required fields, prohibited
assumptions) keyed by those routing signals. `EventFrameV1` remains an
extraction target (MAI-19); `execution_intent_registry` is planner/OEC-facing
and must not become silent request authority.

## Decision

1. MAI-18 owns `EventSpecRegistryBundleV1` + `EventSpecCandidateV1` on
   `CanonicalAIRequestV1`.
2. Slice 1: annotation-only after MAI-17 routing; deterministic seed specs
   keyed by `(intent_family, operation_class, intent_hint)`;
   `is_execution_authority=false`.
3. Slice 2: project selected spec into `EventFrameV1` skeleton on the
   request (`missing_required_fields`, `prohibited_assumptions`);
   `values` / `explicit_values` stay empty; `authorizes_posting=false`.
4. MAI-19 owns structured value extraction into the frame.
5. Does not call `ExecutionIntentRegistry.resolve()` as authority; may reuse
   intent names as `spec_id` aliases only.
6. OOD abstain / UNKNOWN → `unknown_v1` + EMPTY skeleton (fail-closed).
7. Gaps GAP-P1-004 / GAP-P1-008 stay REDUCED.
8. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Fill EventFrame in slice 1 | Belongs to MAI-19 |
| Planner rewrite via ExecutionIntentRegistry | Wrong layer / authority |
| Treat selected_spec as execution authority | Violates constitution |

## Related

- `docs/mokxya-ai/MAI_18_EVENT_SPECIFICATION_REGISTRY.md`
- `erp_bot/src/oip/modules/conversation/application/event_spec_registry_service.py`
