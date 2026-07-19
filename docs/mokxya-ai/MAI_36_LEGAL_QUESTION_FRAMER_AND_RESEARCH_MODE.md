# MAI-36 — Legal Question Framer and Research Mode

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0053](decisions/ADR_0053_LEGAL_QUESTION_FRAMER_RESEARCH_AUTHORITY.md)  
**Runtime:** `mai-36.0.1-slice1` (engineering; not production-approved)

## Objective

Frame legal/tax questions into research mode (jurisdiction / time / risk) without
mutating accounting, verifying current law, or closing citation-honesty gaps.

## Slice 1

1. Ingress `LEGAL_QUESTION_RESEARCH_*` after OFFLINE_SYNC_CONFLICT_REVERSAL
2. Semantic input: MAI-30 `claim_citation_bundle` LEGAL_TAX cues
3. Research mode active when LEGAL_TAX present
4. Missing jurisdiction or as-of → `CLARIFY_REQUIRED`
5. Both slot candidates present → `POLICY_DECLARED` (still unproven)
6. `mutation_tools_allowed=false`; `current_law_definitive=false`
7. `legal_effective_dates_proven=false`; GAP-P2-008 remains OPEN
8. Never research planner execute / KB authority / legal proof

## Slice 2 (later)

Research-frame candidates under allow flags — still no definitive law / mutate.

## Gates

| Case | Expect |
|------|--------|
| VAT Act + as-of, no Nepal | COMPLETE → CLARIFY_REQUIRED |
| VAT Act + Nepal + as-of | COMPLETE → POLICY_DECLARED |
| purchase / report / OOD | SKIP |
| Any path | no mutation; dates unproven; GAP-P2-008 OPEN |

## Non-goals

- Definitive current-law answers
- Closing GAP-P2-008
- Tax calculator pilot (MAI-37+)
- Production approval
