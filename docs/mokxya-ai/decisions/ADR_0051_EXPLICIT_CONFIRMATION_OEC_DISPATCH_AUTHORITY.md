# ADR_0051 — Explicit Confirmation / OEC Dispatch Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-34-EXPLICIT-CONFIRMATION-AND-OEC-DISPATCH (slice 1)
- **Extends:** ADR_0001, ADR_0050

## Context

MAI-33 annotates preview/edit-loop policy and emits preview candidates without
live cards. Product mutation today remains Dexie `executeOrbixConfirm` (Model B);
Action→OEC is not the product path. GAP-P0-001 tracks dual mutation authority.
MAI-34 must declare explicit-confirm and OEC-dispatch policy before any token
mint, Action/OEC dispatch, or post. CR-34 keeps mode_aware / khata / Dexie
posting / Node confirm off the heavy Cursor lane for now.

## Decision

1. MAI-34 owns `ExplicitConfirmationOecDispatchBundleV1` on
   `CanonicalAIRequestV1` after DETERMINISTIC_PREVIEW_EDIT_LOOP.
2. Slice 1: when preview is COMPLETE + POLICY_DECLARED with a module, declare
   `confirm_readiness=POLICY_DECLARED`,
   `confirm_policy=EXPLICIT_UI_CONFIRM_REQUIRED`,
   `nl_assent_posts=false`,
   `stale_preview_on_confirm=REJECT`,
   `oec_dispatch_readiness=POLICY_DECLARED` with
   `action_to_oec_status=NOT_PRODUCT_PATH`,
   `product_mutation_path=DEXIE_EXECUTE_ORBIX_CONFIRM`,
   `gap_p0_001_status=OPEN`.
3. Slice 1 never mints confirm tokens, never Action/OEC dispatches, never
   Dexie/khata/Node posts: all execute/mutate flags false / zero;
   `is_execution_authority=false`.
4. Preview BLOCKED → confirm/OEC BLOCKED; missing/incomplete preview → SKIP.
   Do not invent confirm/OEC success.
5. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| NL yes as confirm | Assent must not post |
| Mint tokens in annotation | Side effects / wrong slice |
| Call Action→OEC as product path | Not product path; GAP-P0-001 |
| Close GAP-P0-001 in slice 1 | Needs convergence + review |
| Live Dexie/khata/Node post | Authority violation |

## Related

- `docs/mokxya-ai/MAI_34_EXPLICIT_CONFIRMATION_AND_OEC_DISPATCH.md`
- `docs/mokxya-ai/baselines/MAI_34_SLICE1_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/explicit_confirmation_oec_dispatch_service.py`
