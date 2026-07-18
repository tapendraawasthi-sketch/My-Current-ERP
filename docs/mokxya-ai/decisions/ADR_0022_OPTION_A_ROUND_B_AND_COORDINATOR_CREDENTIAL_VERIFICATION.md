# ADR_0022 — Authorize Option A Round B remap + coordinator credential verification for R3O review resolution

- **Status:** Accepted (2026-07-18)
- **Phase:** MAI-07R3O
- **Deciders:** Product owner (“everything is ok, go for next move”) after Round A lock + Option A Round B lock

## Context

ADR_0021 blocked closing R3O from quarantined AI-assisted Round A drafts.
Separately, product later:

1. Placed privacy-aliased **Real Human Filled** Round A packages into the
   official inbox and attested four different humans completed the four roles.
2. Authorized **Option A** mechanical enum remap of a Genspark Round-B-like
   workbook into official Round B packages (time constraint).
3. Confirmed credentials/review outcome as OK and directed the next move.

Round A and Round B are both locked (`ROUND_A_LOCKED=true`,
`ROUND_B_LOCKED=true`) with diagnostic agreement 1.0 and **0** Round B
disagreements. Adjudication packet status = `NO_DISAGREEMENTS`.

## Decision

1. Treat locked official Round A submissions as product-accepted independent
   human review evidence under privacy aliases (GAP-P1-016 path), with
   coordinator attestation that four distinct humans completed the roles.
2. Treat Option A remapped Round B as **product-authorized** Round B evidence
   for R3O review resolution (not ideal fresh independent refill; explicitly
   labeled `option_a_mechanical_remap=true`).
3. Accept coordinator statement “everything is ok” as manual credential
   verification for `PROFESSIONAL_LINGUIST_B` (GAP-P1-012 path), recorded in an
   attestation artifact that does **not** publish raw PII.
4. Allow `LINGUIST_APPROVED=true` for MAI-07R3O review-resolution scope only.
5. Keep `QUALITY_GATES_PASSED=false` until a governed frozen V3 evaluation
   passes (GAP-P1-011 unchanged).
6. Keep `PRODUCTION_APPROVED=false`. Do **not** promote
   `mai-07.1.11-r3n6-chaincomplete`. Do **not** start MAI-08.
7. Seal a V3 human-review freeze manifest over locked Round A/B artifacts.

## Non-claims

- Does not rewrite ADR_0021 for the earlier quarantined `__AI_ASSISTED_DRAFT`
  Round A inbox contamination path.
- Does not claim Option A remap equals a fresh multi-day independent Round B
  refill.
- Does not authorize runtime promotion or production cutover.

## Consequences

- MAI-07R3O may move from blocked → review-resolution complete / freeze sealed.
- GAP-P1-016 and GAP-P1-012 may close for R3O review evidence under this ADR.
- Parent MAI-07 remains non-production until quality/production gates pass.
- Next engineering focus: V3 freeze consumption / later governed eval — not MAI-08.

## Related

- ADR_0010, ADR_0011, ADR_0020, ADR_0021
- `docs/mokxya-ai/reviews/mai07_v3/MAI_07_V3_ROUND_A_LOCK_MANIFEST.json`
- `docs/mokxya-ai/reviews/mai07_v3/MAI_07_V3_ROUND_B_LOCK_MANIFEST.json`
- `docs/mokxya-ai/reviews/mai07_v3/review_operations/validation_reports/ROUND_B_OPTION_A_REMAP_REPORT.json`
