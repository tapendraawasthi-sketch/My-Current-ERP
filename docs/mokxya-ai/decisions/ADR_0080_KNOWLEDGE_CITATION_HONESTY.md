# ADR_0080 — Knowledge Citation Honesty for Launch Ask (NEXT-13)

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-13 (`MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt`)
- **Extends:** ADR_0047 / MAI-30 claim-citation consume
- **Gap:** GAP-P2-008 → **REDUCED** (not CLOSED)

## Context

MAI-30 annotated `ABSTAIN_WHEN_UNGROUNDED` but honesty holes remained:
fake-cite phrasing could miss LEGAL_TAX cues; tax-current questions could
proceed when unrelated KB candidates existed; GAP-P2-008 stayed OPEN.

## Decision

1. **Fake cite / invented source** → force `ABSTAIN_UNGROUNDED` (even with
   candidate hits); `fake_citation_allowed=false` always.
2. **Missing evidence** on claim-like Ask → safe no-answer.
3. **Tax-current without knowledge release** (`effective today` / `current law`)
   → abstain; knowledge release remains `NOT_RELEASED`.
4. **Unsupported legal conclusions without source** → abstain.
5. **GAP-P2-008 = REDUCED** with automated gate tests + honesty review note.
   CLOSED only with professional reviewer sign-off (still required).

## Rejected

| Alternative | Why |
|-------------|-----|
| Claim gap CLOSED | Suite still PROFESSIONAL_REVIEW_REQUIRED |
| Rewrite retrieval / Ollama | NEXT-14 (GAP-P2-001) |
| Mark claims_verified=true | Violates MAI-30 fail-closed |

## Related

- `docs/mokxya-ai/MAI_KNOWLEDGE_CITATION_HONESTY_REGISTRY.json`
- `erp_bot/.../knowledge_citation_honesty_policy.py`
- `erp_bot/.../claim_citation_service.py` (gate tighten)
- `src/platform/knowledge/knowledgeCitationHonestyPolicy.ts`
