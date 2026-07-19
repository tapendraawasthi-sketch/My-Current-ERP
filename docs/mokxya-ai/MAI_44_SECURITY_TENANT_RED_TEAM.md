# MAI-44 — Security and Tenant Red Team

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING`  
**Authority:** [ADR_0061](decisions/ADR_0061_SECURITY_TENANT_RED_TEAM_AUTHORITY.md)  
**Runtime:** `mai-44.0.2-slice2` (engineering; not production-approved)

## Objective

Declare a candidate policy for security/tenant red-team topics (isolation,
authorization, confirmation attacks, prompt/tool injection, document safety,
secret leakage) without claiming pen-test pass, zero critical findings, or
production security approval.

## Slice 1

1. Ingress `SECURITY_TENANT_RED_TEAM_*` after CONTINUOUS_CHANGE_INTELLIGENCE
2. Semantic input: cue detection (not MAI-36 research gate)
3. Scope: `SECURITY_TENANT_RED_TEAM_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `isolation_proven=false`; `zero_critical_findings_claimed=false`;
   `pen_review_passed=false`; `production_security_approved=false`
7. GAP-P0-001 OPEN; GAP-P2-008 OPEN

## Slice 2

1. `resolve_security_red_team_consume_mode` / `build_security_red_team_candidate`
2. Default `CANDIDATE_ONLY` — threat model / suite / finding / remediation / pen package null
3. Fake pen-pass claim → `BLOCKED`; non-pilot → `SKIP`
4. Live path forces `allow_pen_review=false` / `allow_zero_critical_claim=false`
5. Metadata: `security_red_team_consume_ready` + `security_red_team_candidate`

## Gates

| Case | Expect |
|------|--------|
| Tenant / authz / confirm / injection / doc / secret cues | COMPLETE → `CANDIDATE_ONLY` |
| Fake pen_review_passed claim | `BLOCKED` |
| Purchase / VAT / legal-only without security cues | SKIP |
| Any live path | never claim pen-test pass / zero critical; gaps OPEN |

## Non-goals

- Pen-test execution / pass claim
- Zero critical findings claim
- Closing GAP-P0-001 or GAP-P2-008
- Production security approval
