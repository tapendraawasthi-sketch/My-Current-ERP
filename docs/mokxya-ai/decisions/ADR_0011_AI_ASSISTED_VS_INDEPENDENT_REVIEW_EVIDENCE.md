# ADR_0011 — AI-assisted user-accepted evidence vs independent human review

- **Status:** Accepted (2026-07-17)
- **Phase:** MAI-07R3J-AI-ASSISTED-ACCOUNTING-IMPORT
- **Deciders:** Product engineering governance

## Context

ACCOUNTING_DOMAIN Round A workbooks were completed via AI autofill and explicitly accepted by the user without edits (`USER_ACCEPTED_AI_SUGGESTIONS_WITHOUT_CHANGES`). The repository already has an official independent V3 review packet and review-operations inbox under `docs/mokxya-ai/reviews/mai07_v3/`. Mixing AI-assisted acceptances into that inbox would falsely satisfy independent-review and Round A lock gates.

## Decision

1. Treat AI-assisted, user-accepted Round A labels as **engineering diagnostic evidence only**.
2. Store them under a **separate governed path**:  
   `docs/mokxya-ai/reviews/mai07_v3_ai_assisted/accounting_domain/`.
3. Record fixed provenance:
   - `review_method=AI_ASSISTED_HUMAN_VERIFIED`
   - `independent_human_review=false`
   - `ai_autofill_used=true`
   - `professional_linguist_adjudication=false`
   - `eligible_for_frozen_quality_gold=false`
   - `prohibited_for_training=true`
4. **Do not** place these workbooks in official `round_a_inbox`.
5. **Do not** set `ROUND_A_LOCKED`, `ROUND_B_READY`, `LINGUIST_APPROVED`, `PRODUCTION_APPROVED`, or `QUALITY_GATES_PASSED` from this evidence.
6. **Do not** use these labels as independent frozen V3 gold, runtime ranking inputs, training data, or production promotion authority.
7. Extend the existing R3J-A import/validation authority with a dedicated fail-closed importer; do not create a competing review subsystem.

### Draft tier (weaker than verified)

`AI_ASSISTED_DRAFT_FOR_HUMAN_REVIEW` (remaining-role drafts) is a **pre-acceptance** engineering aid only (`user_accepted=false`). It must not be treated as `AI_ASSISTED_HUMAN_VERIFIED` until an explicit user-acceptance + verified import phase records that upgrade.

## Consequences

- Engineering may use the canonical JSONL for diagnostics, disagreement analysis, and importer/tooling tests.
- Independent V3 freeze and professional-linguist approval remain blocked on genuine human Round A/B/adjudication (GAP-P1-016 / GAP-P1-012).
- MAI-07 remains `NEEDS_CORRECTIVE_WORK`; MAI-08 remains `NOT_STARTED`.
- A later phase may compare AI-assisted labels to independent human labels once the latter exist — without retroactively upgrading provenance.

## Related

- ADR_0010 (V2 retirement / V3 independent review)
- `docs/mokxya-ai/MAI_07_R3J_AI_ASSISTED_ACCOUNTING_IMPORT_REPORT.md`
- `docs/mokxya-ai/reviews/mai07_v3_ai_assisted/accounting_domain/`
