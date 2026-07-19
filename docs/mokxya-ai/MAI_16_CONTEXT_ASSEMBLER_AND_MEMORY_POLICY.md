# MAI-16 — Context Assembler and Memory Policy

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING` (not production-approved)  
**Authority:** [ADR_0033](decisions/ADR_0033_CONTEXT_ASSEMBLY_AND_MEMORY_POLICY_AUTHORITY.md)  
**Runtime:** `mai-16.0.2-slice2` (engineering; not production-approved)

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

## Slice 2

1. Forward `metadata.context_assembly` into `route.policy_decisions`
2. Copy into `ExecutionContext.metadata`; DATA-ONLY system-prompt append
3. Optional RO `memory.recall` → `context_assembly_recall` summaries
4. Skip memory store/update/consolidate when `write_allowed=false`

## Gates

| Case | Expect |
|------|--------|
| Active draft FOUND + awaiting_clarification | `active_task` + unresolved slices included |
| TrustedScope present | company/tenant echoed; TRUSTED_SCOPE included |
| Policy `write_allowed=true` on contract | ValidationError |
| Provider path with assembly | DATA-ONLY block present |
| Memory store with assembly policy | SKIPPED (no content write) |
| Any assembly run | `memory_writes=0`, not execution authority |

## Non-goals

- OIP/NIOS/layered_memory rewrite
- Cross-company memory
- Closing GAP-P1-004 / GAP-P1-008
- Production approval
