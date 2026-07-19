# MAI-17 — Hierarchical Router and OOD

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0034](decisions/ADR_0034_HIERARCHICAL_ROUTER_AND_OOD_AUTHORITY.md)  
**Runtime:** `mai-17.0.2-slice2` (engineering; not production-approved)

## Objective

Expose a typed hierarchical routing decision (domain → intent family) and an
OOD abstain signal on the canonical request path after MAI-16 — without
granting execution authority or mutating drafts.

## Slice 1

1. `RouterDecisionBundleV1` + `OodSignalV1` on `CanonicalAIRequestV1`
2. Deterministic wrap of `classify_operation` + domain concept evidence
3. Ingress `ROUTING_*` after CONTEXT_ASSEMBLY; metadata `router_decision`
4. Candidates / OOD annotation only; never posts or merges

## Slice 2

1. Forward `metadata.router_decision` into preprocess / mode_aware
2. `should_abstain_router_decision` → clarify `ModeAwareResult` (no drafts)
3. Pending clarify + allow-merge turn-relation never blocked
4. Soft `is_ood` without abstain only blocks mutating op classes

## Gates

| Case | Expect |
|------|--------|
| Purchase / sale create cue | `ERP_OPS` + `TRANSACTION`, not OOD; proceeds |
| Balance sheet | `REPORTING` + `REPORT` |
| Gibberish / weak fallthrough | abstain clarify; no draft |
| Soft OOD + transaction_create | abstain |
| Soft OOD + general_question | no abstain |
| Pending clarify + ANSWER_CLARIFICATION | never abstain |
| Any route | `is_execution_authority=false` |

## Non-goals

- Rewriting OIP provider RouterService
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
