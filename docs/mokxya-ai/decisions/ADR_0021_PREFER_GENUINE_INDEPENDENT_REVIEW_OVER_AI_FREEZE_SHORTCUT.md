# ADR_0021 — Prefer genuine independent review over AI-accepted freeze shortcut

- **Status:** Accepted (2026-07-18)
- **Phase:** MAI-07R3O
- **Deciders:** Product owner direction (“do as per your best intelligence… best possible software”) interpreted by engineering governance

## Context

Product accepted AI-assisted Round A drafts and asked to move ahead. Quarantined
`*__AI_ASSISTED_DRAFT.xlsx` files had been placed in the official
`round_a_inbox`. ADR_0011 already forbids treating that evidence as independent
Round A / freeze gold.

Two options were available:

1. Keep ADR_0011 — engineering acceptance only; R3O waits for real reviewers.
2. Amend governance so user-accepted AI closes GAP-P1-016 / R3O freeze.

## Decision

Choose **option 1**. Best long-term software quality requires honest language-gold
authority:

1. Product human acceptance of AI drafts is valid for
   `AI_ASSISTED_HUMAN_VERIFIED` **engineering** evidence only (ADR_0011).
2. Official `round_a_inbox` must remain free of AI-assisted drafts.
3. Do **not** set `ROUND_A_LOCKED`, `ROUND_B_READY`, `LINGUIST_APPROVED`,
   `QUALITY_GATES_PASSED`, or `PRODUCTION_APPROVED` from this evidence.
4. Do **not** close GAP-P1-016 or GAP-P1-012 via AI acceptance.
5. Review-ops must fail closed if `AI_ASSISTED` / `__AI_ASSISTED_DRAFT` artifacts
   reappear in the official inbox.
6. Ship practical production hardening in parallel (e.g. Render
   `OIP_AUTH_REQUIRED` / JWT secret) without claiming MAI-07 freeze.

## Consequences

- R3O remains `BLOCKED_PENDING_INDEPENDENT_HUMAN_REVIEW`.
- Existing segregated AI-assisted imports stay useful for diagnostics.
- Freeze and professional-linguist approval wait for genuine human Round A/B/
  adjudication into the official inbox.
- MAI-08 remains `NOT_STARTED` until MAI-07 closes under true authority.

## Related

- ADR_0010, ADR_0011, ADR_0020
- `docs/mokxya-ai/MAI_07_R3O_INDEPENDENT_V3_REVIEW_RESOLUTION_READINESS_REPORT.md`
- `docs/mokxya-ai/reviews/mai07_v3_ai_assisted/quarantined_from_official_inbox_2026-07-18/`
