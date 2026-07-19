# ADR_0053 — Legal Question Framer / Research Mode Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-36-LEGAL-QUESTION-FRAMER-AND-RESEARCH-MODE (slice 2)
- **Extends:** ADR_0001, ADR_0047, ADR_0052

## Context

MAI-30 annotates claim-citation / grounded-answer policy without verifying law.
MAI-35 closes Track F sequencing. Legal research must stay separated from
accounting action. GAP-P2-008 tracks citation honesty; Nepal-law effective
dates remain unproven. MAI-36 must frame legal questions (jurisdiction / time /
risk) before any research planner or definitive current-law answer.

## Decision

1. MAI-36 owns `LegalQuestionResearchBundleV1` on `CanonicalAIRequestV1` after
   OFFLINE_SYNC_CONFLICT_REVERSAL (pipeline slot); semantic input is MAI-30
   `claim_citation_bundle` (LEGAL_TAX cues), not offline sync readiness.
2. Slice 1: when claim-citation COMPLETE with LEGAL_TAX cues, declare research
   mode with jurisdiction/as-of slot status, clarify-missing policy,
   `mutation_tools_allowed=false`, `current_law_definitive=false`,
   `legal_effective_dates_proven=false`, `gap_p2_008_status=OPEN`.
3. Missing jurisdiction or as-of → `research_mode_readiness=CLARIFY_REQUIRED`.
   Both present as candidates → `POLICY_DECLARED` (still unproven / unverified).
4. Non-LEGAL_TAX / missing claim-citation → SKIP. Never invent law or mutate.
5. Slice 2: consume builds `legal_research_candidate` /
   `legal_research_consume_mode` (`CANDIDATE_ONLY` default for
   POLICY_DECLARED and CLARIFY_REQUIRED; `BLOCKED` for fake authority;
   `SKIP` for non-legal). Live path forces `allow_research_planner=false` and
   `allow_kb_retrieval=false` — does **not** execute planner, claim KB
   authority, or definitive current law. GAP-P2-008 stays OPEN.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate off MAI-35 sync COMPLETE | Legal/report paths often SKIP Track E |
| Definitive current-law in annotation | Needs approved evidence + review |
| Live planner / KB in slice 2 | Authority / honesty risk |
| Mutation tools in research mode | Roadmap separation from accounting |
| Close GAP-P2-008 in slice 1–2 | Professional honesty review still required |
| Mark dates proven | `legal_effective_dates_proven` must stay false |

## Related

- `docs/mokxya-ai/MAI_36_LEGAL_QUESTION_FRAMER_AND_RESEARCH_MODE.md`
- `docs/mokxya-ai/baselines/MAI_36_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/legal_question_research_service.py`
- `erp_bot/src/oip/modules/conversation/application/legal_question_research_consume_service.py`
