# MAI-42 — Judicial/Decision Intelligence

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0059](decisions/ADR_0059_JUDICIAL_DECISION_INTELLIGENCE_AUTHORITY.md)  
**Runtime:** `mai-42.0.2-slice2` (engineering; not production-approved)

## Objective

Declare a candidate policy for judicial/decision intelligence (court decisions,
holdings, issues, case status, citator-like subsequent treatment) without
retrieving cases, treating headnotes as binding rules, or proving current law.

## Slice 1

1. Ingress `JUDICIAL_DECISION_INTELLIGENCE_*` after BROADER_NEPAL_BUSINESS_LAW_DOMAIN_RELEASE
2. Semantic input: MAI-36 research mode COMPLETE + active (not MAI-41 domain release)
3. Scope: `JUDICIAL_DECISION_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `judicial_authority_claimed=false`; `headnote_as_binding_rule=false`;
   `subsequent_treatment_definitive=false`; `case_retrieved=false`
7. Dates unproven; GAP-P2-008 OPEN

## Slice 2

1. `resolve_judicial_decision_consume_mode` / `build_judicial_decision_candidate`
2. Default `CANDIDATE_ONLY` — case refs / holdings / citator / anchors / definitive null
3. Fake retrieve claim → `BLOCKED`; non-pilot → `SKIP`
4. Live path forces `allow_case_retrieve=false` / `allow_judicial_authority=false`
5. Metadata: `judicial_decision_consume_ready` + `judicial_decision_candidate`

## Gates

| Case | Expect |
|------|--------|
| Court / holding / issue / citator / case-status cues | COMPLETE → `CANDIDATE_ONLY` |
| Fake case-retrieved claim | `BLOCKED` |
| VAT-only / purchase / company-law without judicial cues | SKIP |
| Any live path | never retrieve/claim judicial authority; GAP-P2-008 OPEN |

## Non-goals

- Case corpus retrieval
- Headnote as full binding rule
- Definitive subsequent treatment
- Closing GAP-P2-008
- Production approval
