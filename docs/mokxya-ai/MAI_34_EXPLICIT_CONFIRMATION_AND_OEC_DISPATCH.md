# MAI-34 — Explicit Confirmation and OEC Dispatch

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0051](decisions/ADR_0051_EXPLICIT_CONFIRMATION_OEC_DISPATCH_AUTHORITY.md)  
**Runtime:** `mai-34.0.2-slice2` (engineering; not production-approved)

## Objective

Annotate explicit-UI-confirm policy, stale-preview reject, and OEC readiness —
then consume into confirm/OEC candidates — without minting tokens, dispatching
Action/OEC, or posting ERP commands.

## Slice 1

1. Ingress `EXPLICIT_CONFIRMATION_OEC_DISPATCH_*` after DETERMINISTIC_PREVIEW_EDIT_LOOP
2. `ExplicitConfirmationOecDispatchBundleV1` from MAI-33 preview state
3. `confirm_readiness=POLICY_DECLARED` when preview module ready
4. `confirm_policy=EXPLICIT_UI_CONFIRM_REQUIRED`; `nl_assent_posts=false`
5. Stale preview on confirm → `REJECT`; preview hash + draft version bound
6. OEC readiness POLICY_DECLARED but `ACTION_TO_OEC_NOT_PRODUCT_PATH`
7. Product path `DEXIE_EXECUTE_ORBIX_CONFIRM`; GAP-P0-001 remains OPEN
8. Never token mint / Action / OEC / Dexie / khata / Node post

## Slice 2

1. `resolve_confirm_oec_consume_mode` / `build_confirm_oec_candidate`
2. Default `CANDIDATE_ONLY` — merges MAI-31 `field_overrides`; `confirm_token=null`
3. Blocked readiness / fake mint/post → `BLOCKED`; read-only → `SKIP`
4. Live path forces `allow_confirm_dispatch=false` / `allow_oec_dispatch=false`
5. Metadata: `confirm_oec_consume_ready` + `confirm_oec_candidate`

## Gates

| Case | Expect |
|------|--------|
| purchase preview ready | COMPLETE → `CANDIDATE_ONLY` confirm/OEC candidate |
| Blocked readiness / fake mint | `BLOCKED` |
| report / OOD / no PEL | SKIP |
| Any live path | never token/post; GAP-P0-001 OPEN |

## Non-goals

- Live confirm tokens / Action→OEC / Dexie posts
- Closing GAP-P0-001
- Offline/sync/conflict UX (MAI-35)
- Production approval
