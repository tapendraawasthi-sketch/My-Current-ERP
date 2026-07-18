# ADR_0024 — Runtime cutover of qualified R3N6 path to active default

- **Status:** Accepted (2026-07-18)
- **Phase:** MAI-07R3S-RUNTIME-CUTOVER-R3N6-TO-ACTIVE
- **Deciders:** Product owner (“go”) after ADR_0023 production approval
- **Extends:** ADR_0015, ADR_0023

## Context

ADR_0023 set `PRODUCTION_APPROVED=true` and `CUTOVER_AUTHORIZED=true` without
switching the live path. Qualified evidence is pack
`mai-07.1.11-r3n6-chaincomplete` (hash `8b57db0f…`) under R3Q evaluation
identity, with R3N4 identity-anchor finalization behavior.

## Decision

1. Set active defaults:
   - `RUNTIME_VERSION` = `mai-07.1.13-r3s-active`
   - `RESOURCE_PACK_VERSION` / `ACTIVE_PACK_VERSION` =
     `mai-07.1.11-r3n6-chaincomplete`
2. Graduate default `attach_transliteration_to_frame` to the R3N4 refine +
   finalize pipeline (same behavior as the V3-qualified candidate path).
3. Keep `ENABLE_PROMOTION_OVERLAY=false` (R2 overlay stays disabled).
4. Set `candidate_promoted=true`.
5. Preserve previous active `mai-07.1.3-r3f-sealnew` under
   `sealed_packs/` for lineage only.
6. Do **not** start MAI-08 in R3S.

## Consequences

- Default API ranking may prefer identity-first where R3N6/R3N4 finalize does
  (e.g. `mero`); Devanagari targets remain in the candidate list.
- Historical candidate factories remain non-default modules but may run under
  the shared active-default guard.
- Historical phase tests that assumed active=`r3f` require updates.

## Related

- `docs/mokxya-ai/MAI_07_R3S_RUNTIME_CUTOVER_REPORT.md`
- `erp_bot/.../application/mai07_r3s_active_runtime.py`
- `erp_bot/.../application/mai07_active_default_guard.py`
