# MAI-52 — CA-Firm Engagement And Workpaper Workspace

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING` (not production-approved)  
**Authority:** [ADR_0069](decisions/ADR_0069_CA_FIRM_ENGAGEMENT_WORKPAPER_AUTHORITY.md)  
**Runtime:** `mai-52.0.2-slice2` (engineering; not production-approved)

## Objective

Declare a candidate policy for CA-firm engagement and workpaper topics
(CA-firm engagement, engagement letter, workpaper workspace/review,
client binder, staff assignment, review notes) and consume those into
`CANDIDATE_ONLY` engagement candidates without opening engagements,
creating/posting workpapers, or releasing client binders.

## Slice 1

1. Ingress `CA_FIRM_ENGAGEMENT_WORKPAPER_*` after
   PRIVATE_USER_DOCUMENT_INTELLIGENCE
2. Semantic input: cue detection (not MAI-51 document ingest)
3. Scope: `CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `ca_firm_workspace_enabled=false`; `engagement_opened=false`;
   `engagement_signed=false`; `workpaper_created=false`;
   `workpaper_posted=false`; `client_binder_released=false`;
   `staff_assignment_applied=false`; `review_notes_finalized=false`
7. GAP-P2-008 OPEN (and other open gaps remain open)

## Slice 2

1. Consume service builds `ca_firm_engagement_workpaper_candidate`
2. Default mode `CANDIDATE_ONLY` (plans null; never applied)
3. Live ingress forces `allow_open_engagement=false`,
   `allow_post_workpaper=false`
4. Label-only invoke modes (`INVOKE_OPEN_ENGAGEMENT`,
   `INVOKE_POST_WORKPAPER`) for unit tests only — never on live path
5. Fake authority claim → `BLOCKED`; non-pilot → `SKIP`

## Gates

| Case | Expect |
|------|--------|
| CA engagement / letter / workpaper / binder / staff / review-notes cues | COMPLETE → `POLICY_DECLARED` → consume `CANDIDATE_ONLY` |
| Purchase / VAT / private-document-only without CA cues | SKIP |
| Fake engagement-open / workpaper-post claim | BLOCKED |
| Any live path | never open engagement / never post workpaper; gaps OPEN |

## Non-goals

- Opening or signing engagements
- Creating or posting workpapers
- Closing GAP-P2-008 or GAP-P0-001
- Releasing client binders
