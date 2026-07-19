# MAI-39 — NFRS/NAS Policy, Mapping, and Disclosure Pilot

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0056](decisions/ADR_0056_NFRS_NAS_POLICY_DISCLOSURE_PILOT_AUTHORITY.md)  
**Runtime:** `mai-39.0.1-slice1` (engineering; not production-approved)

## Objective

Declare a narrow NFRS/NAS policy, mapping, and disclosure pilot scope without
executing authoritative mappings, filing disclosures, or proving current law.

## Slice 1

1. Ingress `NFRS_NAS_POLICY_DISCLOSURE_PILOT_*` after TAX_CALCULATOR_RULE_INTEGRATION
2. Semantic input: MAI-36 research mode COMPLETE + active (not MAI-37 tax pilot)
3. Scope: `NFRS_NAS_DISCLOSURE_ONLY`
4. Mapping = `CANDIDATE_MAPPINGS_ONLY`; disclosure = `NOT_FILED`
5. Specialist sign-off = `NOT_SIGNED`
6. `standards_authority_claimed=false`; dates unproven; GAP-P2-008 OPEN
7. Never KB authority / mapping execute / disclosure file / filing-ready

## Gates

| Case | Expect |
|------|--------|
| NFRS/NAS mapping+disclosure research | COMPLETE → `POLICY_DECLARED` |
| VAT-only / purchase | SKIP |
| Any live path | never map/file; GAP-P2-008 OPEN |

## Non-goals

- Authoritative chart-of-accounts mapping
- Filing disclosures
- Closing GAP-P2-008
- Production approval
