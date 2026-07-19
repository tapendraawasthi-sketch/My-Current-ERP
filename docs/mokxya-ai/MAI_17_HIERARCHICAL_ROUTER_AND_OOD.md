# MAI-17 — Hierarchical Router and OOD

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0034](decisions/ADR_0034_HIERARCHICAL_ROUTER_AND_OOD_AUTHORITY.md)  
**Runtime:** `mai-17.0.1-slice1` (engineering; not production-approved)

## Objective

Expose a typed hierarchical routing decision (domain → intent family) and an
OOD abstain signal on the canonical request path after MAI-16 — without
granting execution authority or mutating drafts.

## Slice 1

1. `RouterDecisionBundleV1` + `OodSignalV1` on `CanonicalAIRequestV1`
2. Deterministic wrap of `classify_operation` + domain concept evidence
3. Ingress `ROUTING_*` after CONTEXT_ASSEMBLY; metadata `router_decision`
4. Candidates / OOD annotation only; never posts or merges

## Slice 2 (planned)

1. Consume high-OOD / abstain into mode_aware / preprocess clarify path
2. Optional family gate beside flat operation classification
3. Still no silent draft writes

## Gates

| Case | Expect |
|------|--------|
| Purchase / sale create cue | `ERP_OPS` + `TRANSACTION`, not OOD |
| Balance sheet | `REPORTING` + `REPORT` |
| Gibberish / weak fallthrough | `is_ood=true` |
| ANSWER_CLARIFICATION + short answer | `CLARIFY`, OOD reduced |
| Any route | `is_execution_authority=false` |

## Non-goals

- Rewriting OIP provider RouterService
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
