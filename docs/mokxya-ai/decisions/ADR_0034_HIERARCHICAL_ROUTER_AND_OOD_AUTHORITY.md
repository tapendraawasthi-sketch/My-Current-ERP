# ADR_0034 — Hierarchical Router and OOD Authority

- **Status:** Accepted (2026-07-19); slice 2 addendum same day
- **Phase:** MAI-17-HIERARCHICAL-ROUTER-AND-OOD (slice 2)
- **Extends:** ADR_0001, ADR_0033

## Context

Flat `operation_classifier` and MAI-10 concept→intent bridging exist, but the
canonical request path lacks a typed hierarchical routing decision
(domain → intent family) and an explicit out-of-distribution (OOD) signal.
Provider `RouterService` remains tool/model routing and must not be rewritten
here.

## Decision

1. MAI-17 owns `RouterDecisionBundleV1` + `OodSignalV1` on
   `CanonicalAIRequestV1`.
2. Slice 1: annotation-only after MAI-16 context assembly; wraps
   `classify_operation` + concept bridge as evidence; `is_execution_authority=false`.
3. Slice 2: consume OOD abstain into `mode_aware` / preprocess — clarify
   response, no draft mutations; pending clarify + allow-merge turn-relation
   is never blocked; soft `is_ood` only blocks mutating operation classes.
4. Does not replace OIP provider `RouterService` or planner pipeline.
5. Gaps GAP-P1-004 / GAP-P1-008 stay REDUCED.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Rewrite provider RouterService | Wrong layer (tools/models vs intent hierarchy) |
| Apply routing as execution authority | Violates constitution; silent mutations |
| Close GAP-P1-004/008 here | Needs broader MAI-04 proof |

## Related

- `docs/mokxya-ai/MAI_17_HIERARCHICAL_ROUTER_AND_OOD.md`
- `erp_bot/src/oip/modules/conversation/application/hierarchical_router_service.py`
