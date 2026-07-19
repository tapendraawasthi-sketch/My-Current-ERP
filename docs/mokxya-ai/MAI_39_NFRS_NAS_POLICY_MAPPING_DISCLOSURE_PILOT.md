# MAI-39 — NFRS/NAS Policy, Mapping, and Disclosure Pilot

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0056](decisions/ADR_0056_NFRS_NAS_POLICY_DISCLOSURE_PILOT_AUTHORITY.md)  
**Runtime:** `mai-39.0.2-slice2` (engineering; not production-approved)

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

## Slice 2

1. `resolve_nfrs_nas_consume_mode` / `build_nfrs_nas_candidate`
2. Default `CANDIDATE_ONLY` — mapping refs / disclosure draft / definitive null
3. Fake map/file claim → `BLOCKED`; non-pilot → `SKIP`
4. Live path forces `allow_mapping_execute=false` / `allow_disclosure_file=false`
5. Metadata: `nfrs_nas_consume_ready` + `nfrs_nas_candidate`

## Gates

| Case | Expect |
|------|--------|
| NFRS/NAS mapping+disclosure research | COMPLETE → `CANDIDATE_ONLY` |
| Fake map/file claim | `BLOCKED` |
| VAT-only / purchase | SKIP |
| Any live path | never map/file; GAP-P2-008 OPEN |

## Non-goals

- Authoritative chart-of-accounts mapping
- Filing disclosures
- Closing GAP-P2-008
- Production approval
