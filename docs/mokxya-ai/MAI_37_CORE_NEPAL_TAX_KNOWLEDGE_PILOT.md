# MAI-37 — Core Nepal Tax Knowledge Pilot

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING` (not production-approved)  
**Authority:** [ADR_0054](decisions/ADR_0054_CORE_NEPAL_TAX_KNOWLEDGE_PILOT_AUTHORITY.md)  
**Runtime:** `mai-37.0.2-slice2` (engineering; not production-approved)  
**Closure:** [MAI_37_ENGINEERING_CLOSURE.md](baselines/MAI_37_ENGINEERING_CLOSURE.md)

## Objective

Declare a narrow Income Tax / VAT / TDS knowledge pilot scope — then consume
into tax-pilot candidates — without calculating tax, proving current law, or
releasing gold questions.

## Slice 1

1. Ingress `CORE_NEPAL_TAX_KNOWLEDGE_PILOT_*` after LEGAL_QUESTION_RESEARCH
2. Semantic input: MAI-36 research mode COMPLETE + active
3. Scope: `INCOME_TAX_VAT_TDS_ONLY`
4. Rate tables = `CANDIDATE_REFS_ONLY`; gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `tax_calculator_invoked=false`; dates unproven; GAP-P2-008 OPEN
7. Never KB authority / rate lookup execute / all-law expansion

## Slice 2

1. `resolve_tax_pilot_consume_mode` / `build_tax_pilot_candidate`
2. Default `CANDIDATE_ONLY` — rate refs / computed amount / definitive null
3. Fake calculator / sign-off → `BLOCKED`; non-pilot → `SKIP`
4. Live path forces `allow_rate_lookup=false` / `allow_tax_calculator=false`
5. Metadata: `tax_pilot_consume_ready` + `tax_pilot_candidate`

## Gates

| Case | Expect |
|------|--------|
| VAT / TDS research | COMPLETE → `CANDIDATE_ONLY` |
| Fake calculator claim | `BLOCKED` |
| purchase / report / OOD | SKIP |
| Any live path | never calculate; GAP-P2-008 OPEN |

## Non-goals

- Tax calculator (MAI-38)
- Closing GAP-P2-008
- Specialist production release
- Production approval
