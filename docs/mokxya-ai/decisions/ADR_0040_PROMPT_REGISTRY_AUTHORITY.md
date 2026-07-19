# ADR_0040 — Prompt Registry Authority

- **Status:** Accepted (2026-07-19); slice 2 addendum (2026-07-19)
- **Phase:** MAI-23-PROMPT-REGISTRY-AND-STRUCTURED-OUTPUT (slice 2)
- **Extends:** ADR_0001, ADR_0039

## Context

MAI-22 annotates and may overlay a provider cascade. Prompt construction today
is ad-hoc (`prompt_grounding` + response-register directives) without a
versioned template id or structured-output schema ref on the canonical request.
MAI-23 must first own annotation of those refs without silent model calls, then
consume them as a guide in provider system prompts.

## Decision

1. MAI-23 owns `PromptRegistryBundleV1` on `CanonicalAIRequestV1` after
   PROVIDER_CASCADE.
2. Slice 1: annotation-only template id + schema ref from typed-plan event type
   when COMPLETE and clarification is not ASK; `model_invocations=0`;
   `is_execution_authority=false`.
3. Slice 2: forward registry metadata into `RouteDecision.policy_decisions` and
   append a system-prompt directive via
   `append_prompt_registry_to_system_prompt` in `HttpProviderAdapter` when
   COMPLETE and authority fields are clean. Guide only — does not grant
   posting, mutate drafts, or invoke models from the registry service.
4. Gaps GAP-P1-004 / GAP-P1-008 stay REDUCED.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Invoke models from ingress | Side effects / wrong authority |
| Replace prompt_grounding in slice 1–2 | Broader scope; deferred |
| Select template while clarification ASK | Incomplete frame; fail-closed |
| Treat registry directive as execution authority | Constitution violation |

## Related

- `docs/mokxya-ai/MAI_23_PROMPT_REGISTRY_AND_STRUCTURED_OUTPUT.md`
- `erp_bot/src/oip/modules/conversation/application/prompt_registry_service.py`
