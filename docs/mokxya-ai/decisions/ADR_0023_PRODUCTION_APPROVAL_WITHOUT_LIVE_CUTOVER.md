# ADR_0023 — Production-approve V3 quality; authorize R3N6 cutover later; do not switch active runtime now

- **Status:** Accepted (2026-07-18)
- **Phase:** MAI-07R3R-PRODUCTION-APPROVAL-OR-RUNTIME-PROMOTION
- **Deciders:** Product owner (“go”) after R3Q `PASSED_QUALITY` on frozen V3 FE
- **Extends:** ADR_0015, ADR_0020, ADR_0022

## Context

`MAI_07R3Q_FROZEN_V3_ATTEMPT_001` passed all locked V3 quality gates
(`protected_mutations` 0/155). Candidate identity under test was
`mai-07.1.12-r3q-protspan`, which **reuses R3N6 pack bytes** and corrects
**evaluation highlight-range alignment**, not production resource content.

Live default remains `mai-07.1.3-r3f-sealnew`. R3N4→R3N6 corrective behavior
still lives behind explicit candidate factories (`assert_active_default_immutable`).
Switching only version constants would **not** graduate that behavior into the
default `transliteration_service` path.

ADR_0022 kept `PRODUCTION_APPROVED=false` and forbade promoting R3N6 during R3O.
That freeze/review gate is now satisfied by R3Q quality evidence plus prior
linguist approval.

## Decision

1. Set **`PRODUCTION_APPROVED=true`** for MAI-07 Romanized transliteration
   **V3 quality evidence** under Option A gold + R3Q scoring alignment.
2. Treat qualified pack evidence as **`mai-07.1.11-r3n6-chaincomplete`**
   (content hash `8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106`),
   evaluated under R3Q identity `mai-07.1.12-r3q-protspan`.
3. Authorize **future runtime cutover** to the R3N6 candidate path
   (`CUTOVER_AUTHORIZED=true`). Do **not** perform live cutover in R3R.
4. Keep **`candidate_promoted=false`** and active defaults unchanged:
   - `RUNTIME_VERSION` / `RESOURCE_PACK_VERSION` /
     `ACTIVE_PACK_VERSION` = `mai-07.1.3-r3f-sealnew`
   - `ENABLE_PROMOTION_OVERLAY=false`
5. Do **not** invent a sealed pack directory named
   `mai-07.1.12-r3q-protspan` (R3Q is not a resource pack).
6. Do **not** start MAI-08 in R3R.
7. Next governed phase:
   `MAI-07R3S-RUNTIME-CUTOVER-R3N6-TO-ACTIVE` (explicit engineering cutover).

## Non-claims

- Does not claim the active production path already executes R3N6 finalization.
- Does not rewrite consumed R3P-2 / R3Q attempt artifacts.
- Does not set `candidate_promoted=true`.
- Does not authorize MAI-08.

## Consequences

- Product may treat V3 FE quality as production-approved evidence.
- Operators must still load the R3N6/R3Q candidate path explicitly until R3S
  cutover lands.
- Rebuilds of the V3 dataset must preserve `PRODUCTION_APPROVED` when the
  dataset hash is unchanged.

## Related

- `docs/mokxya-ai/MAI_07_R3Q_FROZEN_V3_ONE_SHOT_REPORT.md`
- `docs/mokxya-ai/MAI_07_R3R_PRODUCTION_APPROVAL_REPORT.md`
- `evals/mai07/r3q_frozen_v3/MAI_07R3Q_FROZEN_V3_ATTEMPT_001.CLOSEOUT.json`
