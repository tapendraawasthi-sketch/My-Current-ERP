# MAI-52 — CA-Firm Engagement And Workpaper Workspace

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0069](decisions/ADR_0069_CA_FIRM_ENGAGEMENT_WORKPAPER_AUTHORITY.md)  
**Runtime:** `mai-52.0.1-slice1` (engineering; not production-approved)

## Objective

Declare a candidate policy for CA-firm engagement and workpaper topics
(CA-firm engagement, engagement letter, workpaper workspace/review,
client binder, staff assignment, review notes) without opening
engagements, creating/posting workpapers, or releasing client binders.

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

## Gates

| Case | Expect |
|------|--------|
| CA engagement / letter / workpaper / binder / staff / review-notes cues | COMPLETE → `POLICY_DECLARED` |
| Purchase / VAT / private-document-only without CA cues | SKIP |
| Any live path | never open engagement / never post workpaper; gaps OPEN |

## Non-goals

- Opening or signing engagements
- Creating or posting workpapers
- Closing GAP-P2-008 or GAP-P0-001
- Releasing client binders
