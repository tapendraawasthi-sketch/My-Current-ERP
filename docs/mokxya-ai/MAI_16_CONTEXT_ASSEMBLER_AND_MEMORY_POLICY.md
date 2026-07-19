# MAI-16 — Context Assembler and Memory Policy

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0033](decisions/ADR_0033_CONTEXT_ASSEMBLY_AND_MEMORY_POLICY_AUTHORITY.md)  
**Runtime:** `mai-16.0.1-slice1` (engineering; not production-approved)

## Objective

Expose a typed, budgeted context-assembly candidate bundle and a fail-closed
memory policy on the canonical request path after MAI-15 — without writing
memory or mutating drafts.

## Slice 1

1. `ContextAssemblyBundleV1` + `MemoryPolicyV1` on `CanonicalAIRequestV1`
2. Request-local slices only (TrustedScope, conversation id, active draft,
   unresolved clarification, turn relation, reference/coreference, UI context)
3. Token/slice budget ranks include vs exclude; candidates stay `applied=false`
4. `write_allowed=false`, `memory_writes=0`, no LLM prompt injection

## Slice 2 (planned)

1. Consume included slices into provider/orchestrator assembly
2. Optional read-only recall under the same policy
3. Still no silent draft / memory writes from ingress

## Gates

| Case | Expect |
|------|--------|
| Active draft FOUND + awaiting_clarification | `active_task` + unresolved slices included |
| TrustedScope present | company/tenant echoed; TRUSTED_SCOPE included |
| Policy `write_allowed=true` | ValidationError |
| Any assembly run | `memory_writes=0`, not execution authority |

## Non-goals

- OIP/NIOS/layered_memory rewrite
- Cross-company memory
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
