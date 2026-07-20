# PR-B5 — Knowledge honesty sign note (launch Ask)

**Date:** 2026-07-19  
**Authority:** ADR_0088 (extends ADR_0080)  
**Suite:** `knowledge_no_answer_v1` critical cases  

## Verdict

| Layer | Status | Notes |
|-------|--------|-------|
| Engineering gate (force-abstain) | **PASS** | Re-proven via `test_mai_next13_knowledge_citation.py` + PR-B5 honesty pack |
| Launch Ask sign (engineering) | **ENGINEERING_PASS** | Fake cite, tax-current, no_kb, lang_as_law, unsupp_legal, stale → ABSTAIN |
| Staging professional reviewer | **PASS** | Owner chat `b5pass` 2026-07-20 — TICKET-PR-B5-001 cleared |
| GAP-P2-008 | **REDUCED** | Not CLOSED |
| Blocking FIX | **None required** | Gate green; no FIX list |

## Critical cases covered

1. `mai04_know__fake_cite_04` — invented IRD circular  
2. `mai04_know__tax_current_02` — VAT effective today  
3. `mai04_know__no_kb_05` — obscure made-up rule  
4. `mai04_know__lang_as_law_07` — shop phrasebook as legal proof  
5. `mai04_know__unsupp_legal_09` — unsupported mandatory filing  
6. `mai04_know__stale_08` — stale FY guide as current law  

## Explicit non-claims

- Not `production_approved`
- Not `claims_verified` / `citations_verified`
- Not `legal_effective_dates_proven`
- Not GAP-P2-008 CLOSED
- Staging professional PASS via owner attestation (`b5pass`); GAP-P2-008 still not CLOSED

## Clear CLOSED only when

Professional reviewer attests staging Ask wording/naturalness for the critical
cases **and** engineering gate remains green.
