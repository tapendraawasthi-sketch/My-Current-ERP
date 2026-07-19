# MAI-40 — Financial Close and Adjustment Assistance

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0057](decisions/ADR_0057_FINANCIAL_CLOSE_ADJUSTMENT_ASSISTANCE_AUTHORITY.md)  
**Runtime:** `mai-40.0.2-slice2` (engineering; not production-approved)

## Objective

Declare financial-close / adjustment-assistance policy bound to the MAI-39
NFRS/NAS pilot — without posting close, posting adjustments, locking books,
or claiming period-closed authority.

## Slice 1

1. Ingress `FINANCIAL_CLOSE_ADJUSTMENT_ASSISTANCE_*` after NFRS_NAS_POLICY_DISCLOSURE_PILOT
2. Semantic input: MAI-39 pilot COMPLETE + readiness ∈ `{POLICY_DECLARED, SCOPE_PARTIAL}`
3. Scope: `FINANCIAL_CLOSE_ADJUSTMENT_ONLY`
4. Adjustment = `CANDIDATE_ASSISTANCE_ONLY`
5. Specialist sign-off = `NOT_SIGNED`
6. `close_posted=false`; `adjustments_posted=false`; `books_locked=false`; `period_closed=false`
7. Dates unproven; GAP-P2-008 OPEN

## Slice 2

1. `resolve_close_assist_consume_mode` / `build_close_assist_candidate`
2. Default `CANDIDATE_ONLY` — checklist refs / adjustment drafts / definitive null
3. Fake post/lock claim → `BLOCKED`; non-pilot → `SKIP`
4. Live path forces `allow_close_post=false` / `allow_adjustment_post=false`
5. Metadata: `close_assist_consume_ready` + `close_assist_candidate`

## Gates

| Case | Expect |
|------|--------|
| Close/adjustment + NFRS/NAS | COMPLETE → `CANDIDATE_ONLY` |
| Fake post/lock claim | `BLOCKED` |
| NFRS-only without close cues / purchase | SKIP |
| Any live path | never post/lock; GAP-P2-008 OPEN |

## Non-goals

- Posting close or adjustments
- Locking books / closing period
- Closing GAP-P2-008
- Production approval
