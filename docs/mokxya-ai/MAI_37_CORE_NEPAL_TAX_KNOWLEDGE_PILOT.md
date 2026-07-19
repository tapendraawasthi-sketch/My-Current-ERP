# MAI-37 — Core Nepal Tax Knowledge Pilot

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0054](decisions/ADR_0054_CORE_NEPAL_TAX_KNOWLEDGE_PILOT_AUTHORITY.md)  
**Runtime:** `mai-37.0.1-slice1` (engineering; not production-approved)

## Objective

Declare a narrow Income Tax / VAT / TDS knowledge pilot scope on top of MAI-36
research framing — without calculating tax, proving current law, or releasing
gold questions.

## Slice 1

1. Ingress `CORE_NEPAL_TAX_KNOWLEDGE_PILOT_*` after LEGAL_QUESTION_RESEARCH
2. Semantic input: MAI-36 research mode COMPLETE + active
3. Scope: `INCOME_TAX_VAT_TDS_ONLY`
4. Rate tables = `CANDIDATE_REFS_ONLY`; gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `tax_calculator_invoked=false`; dates unproven; GAP-P2-008 OPEN
7. Never KB authority / rate lookup execute / all-law expansion

## Slice 2 (later)

Tax-pilot candidates under allow flags — still no calculator / definitive law.

## Gates

| Case | Expect |
|------|--------|
| VAT / Income Tax research | COMPLETE → POLICY_DECLARED |
| purchase / report / OOD | SKIP |
| Any path | no calculator; GAP-P2-008 OPEN |

## Non-goals

- Tax calculator (MAI-38)
- Closing GAP-P2-008
- Specialist production release
- Production approval
