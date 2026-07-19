# NEXT-13 — Knowledge Citation Honesty (GAP-P2-008 REDUCED)

**Date:** 2026-07-19  
**Step:** NEXT-13  
**ADR:** ADR_0080  

## Behaviors proven (launch Ask path)

| Scenario | Gate outcome |
|----------|--------------|
| Fake / invented cite | `ABSTAIN_UNGROUNDED` + safe no-answer (even with KB candidates) |
| Missing evidence on claim-like Ask | `ABSTAIN_UNGROUNDED` / INSUFFICIENT |
| Tax-current without knowledge release | `ABSTAIN_UNGROUNDED` |
| Unsupported legal conclusion w/o source | `ABSTAIN_UNGROUNDED` |
| `ALLOW_WITH_CANDIDATES` | Never means `claims_verified` |

## Suite

`knowledge_no_answer_v1` critical cases mapped to gate:
`fake_cite_04`, `tax_current_02`, `no_kb_05`, `lang_as_law_07`,
`unsupp_legal_09`, `stale_08`.

## Professional honesty review note

Engineering gate is green for the force-abstain behaviors above.
Suite rows remain `PROFESSIONAL_REVIEW_REQUIRED` for naturalness / product
wording. **GAP-P2-008 is REDUCED, not CLOSED** until reviewer sign-off.

## Residuals

- Full LLM pipeline answer quality still soft-scored in harness
- Prod retrieval without Ollama = NEXT-14 (GAP-P2-001)
- `legal_effective_dates_proven=false`; tax pilot `NOT_RELEASED`

## Evidence

- `docs/mokxya-ai/decisions/ADR_0080_KNOWLEDGE_CITATION_HONESTY.md`
- `docs/mokxya-ai/MAI_KNOWLEDGE_CITATION_HONESTY_REGISTRY.json`
- `erp_bot/.../knowledge_citation_honesty_policy.py`
- `erp_bot/.../claim_citation_service.py`
- `erp_bot/tests/oip/language_runtime/test_mai_next13_knowledge_citation.py`
- `src/__tests__/orbix/maiNext13KnowledgeCitation.test.ts`

## Explicit non-claims

- Not production_approved
- Not legal_effective_dates_proven
- Not GAP-P2-008 CLOSED
- Not claims/citations verified
