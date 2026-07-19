# MAI-36 — Legal Question Framer and Research Mode

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING`  
**Authority:** [ADR_0053](decisions/ADR_0053_LEGAL_QUESTION_FRAMER_RESEARCH_AUTHORITY.md)  
**Runtime:** `mai-36.0.2-slice2` (engineering; not production-approved)

## Objective

Frame legal/tax questions into research mode (jurisdiction / time / risk) — then
consume into research-frame candidates — without mutating accounting, verifying
current law, or closing citation-honesty gaps.

## Slice 1

1. Ingress `LEGAL_QUESTION_RESEARCH_*` after OFFLINE_SYNC_CONFLICT_REVERSAL
2. Semantic input: MAI-30 `claim_citation_bundle` LEGAL_TAX cues
3. Research mode active when LEGAL_TAX present
4. Missing jurisdiction or as-of → `CLARIFY_REQUIRED`
5. Both slot candidates present → `POLICY_DECLARED` (still unproven)
6. `mutation_tools_allowed=false`; `current_law_definitive=false`
7. `legal_effective_dates_proven=false`; GAP-P2-008 remains OPEN
8. Never research planner execute / KB authority / legal proof

## Slice 2

1. `resolve_legal_research_consume_mode` / `build_legal_research_candidate`
2. Default `CANDIDATE_ONLY` — `research_plan` / `evidence_pack` / definitive null
3. Fake definitive / mutation authority → `BLOCKED`; non-legal → `SKIP`
4. Live path forces `allow_research_planner=false` / `allow_kb_retrieval=false`
5. Metadata: `legal_research_consume_ready` + `legal_research_candidate`

## Gates

| Case | Expect |
|------|--------|
| VAT Act + as-of | COMPLETE → `CANDIDATE_ONLY` (clarify or declared) |
| Fake definitive claim | `BLOCKED` |
| purchase / report / OOD | SKIP |
| Any live path | never prove law; GAP-P2-008 OPEN |

## Non-goals

- Definitive current-law answers
- Closing GAP-P2-008
- Tax calculator pilot (MAI-37+)
- Production approval
