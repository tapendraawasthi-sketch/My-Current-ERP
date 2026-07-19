# ADR_0033 — Context Assembly and Memory Policy Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-16-CONTEXT-ASSEMBLER-AND-MEMORY-POLICY (slice 1)
- **Extends:** ADR_0001, ADR_0032

## Context

Prior MAI stages attach TrustedScope, object references, turn relation, and
reference/coreference onto `CanonicalAIRequestV1`. Downstream providers still
lack a typed, budgeted view of which request-local slices may be assembled and
under what memory policy. Legacy OIP/NIOS/layered memory paths must not become
silent write authorities from ingress.

## Decision

1. MAI-16 owns `ContextAssemblyBundleV1` + `MemoryPolicyV1` on
   `CanonicalAIRequestV1`.
2. Slice 1: annotation-only assembly from request-local slices
   (TrustedScope, conversation id, active draft, turn relation,
   reference/coreference, UI context). `write_allowed=false`,
   `memory_writes=0`, `is_execution_authority=false`.
3. Slice 2 (later): consume included slices into provider/orchestrator
   assembly and optional read-only recall — still no silent draft writes.
4. Does not rewrite OIP/NIOS/layered_memory stores or inject LLM prompts
   in slice 1.
5. Gaps GAP-P1-004 / GAP-P1-008 stay REDUCED.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Write memory from ingress | Violates authority; silent mutation risk |
| Cross-company memory | Tenant/company isolation |
| LLM prompt injection in slice 1 | Premature; needs slice-2 consume design |
| Close GAP-P1-004/008 here | Needs broader MAI-04 proof |

## Related

- `docs/mokxya-ai/MAI_16_CONTEXT_ASSEMBLER_AND_MEMORY_POLICY.md`
- `erp_bot/src/oip/modules/conversation/application/context_assembly_service.py`
