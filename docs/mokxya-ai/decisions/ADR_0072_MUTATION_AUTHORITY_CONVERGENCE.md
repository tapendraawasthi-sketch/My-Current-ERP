# ADR_0072 — Mutation Authority Convergence (GAP-P0-001)

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-02 (`MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt`)
- **Extends:** ADR_0001 (documents current deviations); MAI-34 confirm/OEC policy
- **Gap:** GAP-P0-001

## Context

The master architecture targets Action Runtime → ERPCommandPort → OEC as the
sole ERP mutation chain. The live Sutra/Orbix product path is **Model B**:
browser Dexie domain engines via `executeOrbixConfirm`. Parallel writers still
exist (Node `executeKhataConfirm`, partial OEC/Action Runtime). Claiming
“OEC-only” today is false and dangerous.

## Decision

**Option A — Honest Model B product authority (accepted now).**

1. **Product mutation authority (UI Orbix confirm):**  
   `DEXIE_EXECUTE_ORBIX_CONFIRM`  
   (`src/lib/ekhata/orbixPostingService.ts` → domain `post*Transaction`).
2. **OEC / Action Runtime:** TARGET / aspirational — **not** the product path.
   Classified as `NOT_PRODUCT_PATH` / `PARTIAL_RUNTIME_EXISTS`. AI and docs must
   not claim sole-OEC until a future strangler actually lands.
3. **Alternate writers — classified (not denied at OS level in this step):**
   - `NODE_KHATA_CONFIRM` — parallel Postgres path (`packages/backend` khata)
   - `VOUCHER_SLICE_UI` — manual UI voucher adds (presentation/engine mix)
   - `OEC_ACTION_RUNTIME` — non-product / partial
4. **AI path gates (enforced in code):**
   - `nl_assent_posts=false`
   - live `allow_confirm_dispatch=false`, `allow_oec_dispatch=false`
   - `product_mutation_path` must be `DEXIE_EXECUTE_ORBIX_CONFIRM` when confirm
     policy is declared
   - `oec_is_sole_mutation_authority` must remain `false`
   - `gap_p0_001_status` remains `OPEN` in runtime bundles while dual writers
     exist (gap register may be REDUCED for honesty/classification progress)
5. **Future Option B (strangler to sole-OEC)** is deferred; requires explicit
   later ADR + reconciliation tests. Not claimed by this decision.

## Rejected

| Alternative | Why |
|-------------|-----|
| Claim sole-OEC now | False; dual writers active |
| Delete Dexie / Node writers in this step | Unsafe mid-flight; conflict with CR posting paths |
| Close GAP-P0-001 | Dual writers remain; residual P0 risk |

## Gate evidence

- Registry: `docs/mokxya-ai/MAI_MUTATION_AUTHORITY_REGISTRY.json`
- Policy module: `mutation_authority_policy.py`
- Tests: `test_mai_next02_mutation_authority.py`

## Related

- ADR_0001 §2–§ Action/OEC deviations
- MAI-34 `ExplicitConfirmationOecDispatchBundleV1`
- `MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt` NEXT-02 / NEXT-05
