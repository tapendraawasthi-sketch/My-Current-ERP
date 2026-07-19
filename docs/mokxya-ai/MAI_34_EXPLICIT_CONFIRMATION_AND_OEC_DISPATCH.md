# MAI-34 — Explicit Confirmation and OEC Dispatch

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0051](decisions/ADR_0051_EXPLICIT_CONFIRMATION_OEC_DISPATCH_AUTHORITY.md)  
**Runtime:** `mai-34.0.1-slice1` (engineering; not production-approved)

## Objective

Annotate explicit-UI-confirm policy, stale-preview reject, and OEC readiness
without minting tokens, dispatching Action/OEC, or posting ERP commands.

## Slice 1

1. Ingress `EXPLICIT_CONFIRMATION_OEC_DISPATCH_*` after DETERMINISTIC_PREVIEW_EDIT_LOOP
2. `ExplicitConfirmationOecDispatchBundleV1` from MAI-33 preview state
3. `confirm_readiness=POLICY_DECLARED` when preview module ready
4. `confirm_policy=EXPLICIT_UI_CONFIRM_REQUIRED`; `nl_assent_posts=false`
5. Stale preview on confirm → `REJECT`; preview hash + draft version bound
6. OEC readiness POLICY_DECLARED but `ACTION_TO_OEC_NOT_PRODUCT_PATH`
7. Product path `DEXIE_EXECUTE_ORBIX_CONFIRM`; GAP-P0-001 remains OPEN
8. Never token mint / Action / OEC / Dexie / khata / Node post

## Slice 2 (later)

Confirm/OEC candidates under allow flags — still no live post.

## Gates

| Case | Expect |
|------|--------|
| purchase preview ready | COMPLETE → POLICY_DECLARED confirm/OEC |
| Preview BLOCKED | CONFIRM/OEC BLOCKED |
| report / OOD / no PEL | SKIP |
| Any path | nl_assent_posts=false; gap_p0_001=OPEN; no post |

## Non-goals

- Live confirm tokens / Action→OEC / Dexie posts
- Closing GAP-P0-001
- Offline/sync/conflict UX (MAI-35)
- Production approval
