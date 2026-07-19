# ADR_0070 — Compliance Obligation And Calendar Automation Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-53-COMPLIANCE-OBLIGATION-CALENDAR (slice 2)
- **Extends:** ADR_0001, ADR_0003

## Context

MAI-36–52 cover legal research through CA-firm engagement candidates.
Compliance obligation and calendar automation need an explicit candidate
policy before any obligation create, reminder send, automation arm, or
filing submit.

## Decision

1. MAI-53 owns `ComplianceObligationCalendarBundleV1` on
   `CanonicalAIRequestV1` after CA_FIRM_ENGAGEMENT_WORKPAPER.
2. Semantic gate: cue detection only (compliance obligation, filing
   deadline, compliance/regulatory calendar, reminder automation,
   obligation tracking, due-date alert) — **not** MAI-52 engagement open.
3. Slice 1: declare
   `pilot_scope=COMPLIANCE_OBLIGATION_CALENDAR_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `compliance_calendar_enabled=false`,
   `obligation_created=false`,
   `deadline_scheduled=false`,
   `reminder_sent=false`,
   `automation_armed=false`,
   `calendar_synced=false`,
   `filing_submitted=false`,
   `obligation_closed=false`,
   `production_approved=false`,
   `gap_p2_008_status=OPEN`.
4. Slice 2: consume into `CANDIDATE_ONLY`
   `compliance_obligation_calendar_candidate` with null plans; live ingress
   forces `allow_arm_automation=false` and `allow_submit_filing=false`.
   Label-only `INVOKE_ARM_AUTOMATION` / `INVOKE_SUBMIT_FILING` modes
   exist for unit tests only.
5. Never invent calendar enable, reminder send, automation arm, or filing
   submit from cue detection alone.
6. Engineering-gated: ledger `production_approved=false` remains false.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-52 engagement_opened | Engagement remains unopened |
| Create / schedule obligations from cues | Owner acceptance required |
| Arm reminder automation from cues | Explicit opt-in + delivery policy required |
| Submit filings from cues | Legal filing authority required |
| Close GAP-P2-008 / GAP-P0-001 | Honesty + security review still required |
| Live allow_arm_automation / allow_submit_filing | Would invent calendar authority |

## Related

- `docs/mokxya-ai/MAI_53_COMPLIANCE_OBLIGATION_CALENDAR.md`
- `docs/mokxya-ai/baselines/MAI_53_SLICE1_BASELINE_SUMMARY.md`
- `docs/mokxya-ai/baselines/MAI_53_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/compliance_obligation_calendar_service.py`
- `erp_bot/src/oip/modules/conversation/application/compliance_obligation_calendar_consume_service.py`
