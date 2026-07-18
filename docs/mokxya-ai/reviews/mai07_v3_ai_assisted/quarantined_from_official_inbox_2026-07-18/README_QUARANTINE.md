# Quarantined from official Round A inbox (2026-07-18)

## Why

These workbooks were found under the **official** path:

`docs/mokxya-ai/reviews/mai07_v3/review_operations/round_a_inbox/`

Filenames and the companion report mark them as **`AI_ASSISTED_DRAFT_ONLY`**.

Per **ADR_0011**, AI-assisted drafts must **not** be placed in the official
`round_a_inbox`. Doing so would falsely satisfy independent Round A / R3O gates
and must not close **GAP-P1-016** or **GAP-P1-012**.

## Disposition

- Moved here for segregated engineering retention only.
- Official inbox restored empty (role folders recreated).
- Review workflow state remains `WAITING_FOR_ROUND_A_SUBMISSIONS`.
- `LINGUIST_APPROVED` / `QUALITY_GATES_PASSED` / `PRODUCTION_APPROVED` remain false.

## Allowed use

Engineering diagnostic / draft aid only. Not lock-eligible. Not freeze input.
Not independent human evidence.

## Resume R3O

Send the sealed Round A ZIPs to real human reviewers, then place **human**
completed batches (without `__AI_ASSISTED_DRAFT` provenance) into:

`docs/mokxya-ai/reviews/mai07_v3/review_operations/round_a_inbox/<ROLE>/`
