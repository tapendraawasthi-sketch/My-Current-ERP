# MAI-53 — Compliance Obligation And Calendar Automation

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 2)  
**Authority:** [ADR_0070](decisions/ADR_0070_COMPLIANCE_OBLIGATION_CALENDAR_AUTHORITY.md)  
**Runtime:** `mai-53.0.2-slice2` (engineering; not production-approved)

## Objective

Declare a candidate policy for compliance obligation and calendar topics
(compliance obligation, filing deadline, compliance/regulatory calendar,
reminder automation, obligation tracking, due-date alert) and consume those
into `CANDIDATE_ONLY` calendar candidates without creating obligations,
sending reminders, arming automation, or submitting filings.

## Slice 1

1. Ingress `COMPLIANCE_OBLIGATION_CALENDAR_*` after
   CA_FIRM_ENGAGEMENT_WORKPAPER
2. Semantic input: cue detection (not MAI-52 engagement open)
3. Scope: `COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `compliance_calendar_enabled=false`; `obligation_created=false`;
   `deadline_scheduled=false`; `reminder_sent=false`;
   `automation_armed=false`; `calendar_synced=false`;
   `filing_submitted=false`; `obligation_closed=false`
7. GAP-P2-008 OPEN (and other open gaps remain open)

## Slice 2

1. Consume service builds `compliance_obligation_calendar_candidate`
2. Default mode `CANDIDATE_ONLY` (plans null; never applied)
3. Live ingress forces `allow_arm_automation=false`,
   `allow_submit_filing=false`
4. Label-only invoke modes (`INVOKE_ARM_AUTOMATION`,
   `INVOKE_SUBMIT_FILING`) for unit tests only — never on live path
5. Fake authority claim → `BLOCKED`; non-pilot → `SKIP`

## Gates

| Case | Expect |
|------|--------|
| Compliance obligation / deadline / calendar / reminder / tracking / alert cues | COMPLETE → `POLICY_DECLARED` → consume `CANDIDATE_ONLY` |
| Purchase / VAT / CA-firm-only without compliance cues | SKIP |
| Fake automation-armed / filing-submitted claim | BLOCKED |
| Any live path | never arm automation / never submit filing; gaps OPEN |

## Non-goals

- Creating or closing obligations
- Sending reminders or arming automation
- Submitting filings
- Closing GAP-P2-008 or GAP-P0-001
