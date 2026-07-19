# MAI-41 — Broader Nepal Business-Law Domain Releases

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0058](decisions/ADR_0058_BROADER_NEPAL_BUSINESS_LAW_DOMAIN_RELEASE_AUTHORITY.md)  
**Runtime:** `mai-41.0.1-slice1` (engineering; not production-approved)

## Objective

Declare a candidate policy for broader Nepal business-law domain releases
(company / labor / contract / domain-release cues) without releasing domains,
claiming production eligibility, or proving current law.

## Slice 1

1. Ingress `BROADER_NEPAL_BUSINESS_LAW_DOMAIN_RELEASE_*` after FINANCIAL_CLOSE_ADJUSTMENT_ASSISTANCE
2. Semantic input: MAI-36 research mode COMPLETE + active (not MAI-40 close-assist)
3. Scope: `BROADER_NEPAL_BUSINESS_LAW_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `domain_authority_claimed=false`; `domain_released=false`; `production_domain_eligible=false`
7. Dates unproven; GAP-P2-008 OPEN

## Gates

| Case | Expect |
|------|--------|
| Company / labor / contract / domain-release cues | COMPLETE → `POLICY_DECLARED` |
| VAT-only / purchase / close-only without business-law | SKIP |
| Any live path | never release; GAP-P2-008 OPEN |

## Non-goals

- Production domain release
- Closing GAP-P2-008
- Specialist production sign-off
- Production approval
