# ADR_0039 — Provider Cascade Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-22-PROVIDER-PORT-AND-MODEL-CASCADE (slice 1)
- **Extends:** ADR_0001, ADR_0038

## Context

MAI-21 annotates a typed plan and may authorize READ tool proposals. Downstream
provider selection today lives in router `FallbackChain` +
`ProviderInvocationStage`, which actually invoke adapters. MAI-22 must first
own a request-path annotation of selected provider + cascade order without
silent model calls.

## Decision

1. MAI-22 owns `ProviderCascadeBundleV1` on `CanonicalAIRequestV1` after
   TYPED_PLAN.
2. Slice 1: annotation-only cascade from settings/defaults when typed plan is
   COMPLETE and clarification is not ASK; `model_invocations=0`;
   `is_execution_authority=false`.
3. Does not call `ProviderRuntimeService.start_execution` or adapter `invoke`.
4. Slice 2 (later): consume annotated cascade in orchestrator/runtime under
   constitution gates.
5. Gaps GAP-P1-004 / GAP-P1-008 stay REDUCED.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Invoke models from ingress | Side effects / wrong authority |
| Live health probes mutating workflow | Non-deterministic; not slice 1 |
| Cascade while clarification ASK | Incomplete frame; fail-closed |

## Related

- `docs/mokxya-ai/MAI_22_PROVIDER_PORT_AND_MODEL_CASCADE.md`
- `erp_bot/src/oip/modules/conversation/application/provider_cascade_service.py`
