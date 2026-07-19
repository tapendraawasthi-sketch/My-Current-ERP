# ADR_0069 — CA-Firm Engagement And Workpaper Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-52-CA-FIRM-ENGAGEMENT-WORKPAPER (slice 2)
- **Extends:** ADR_0001, ADR_0003

## Context

MAI-36–51 cover legal research through private-document candidates.
CA-firm engagement and workpaper workspace need an explicit candidate
policy before any engagement open/sign, workpaper create/post, or binder
release.

## Decision

1. MAI-52 owns `CaFirmEngagementWorkpaperBundleV1` on
   `CanonicalAIRequestV1` after PRIVATE_USER_DOCUMENT_INTELLIGENCE.
2. Semantic gate: cue detection only (CA-firm engagement, engagement
   letter, workpaper workspace/review, client binder, staff assignment,
   review notes) — **not** MAI-51 document ingest.
3. Slice 1: declare
   `pilot_scope=CA_FIRM_ENGAGEMENT_WORKPAPER_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `ca_firm_workspace_enabled=false`,
   `engagement_opened=false`,
   `engagement_signed=false`,
   `workpaper_created=false`,
   `workpaper_posted=false`,
   `client_binder_released=false`,
   `staff_assignment_applied=false`,
   `review_notes_finalized=false`,
   `production_approved=false`,
   `gap_p2_008_status=OPEN`.
4. Slice 2: consume into `CANDIDATE_ONLY`
   `ca_firm_engagement_workpaper_candidate` with null plans; live ingress
   forces `allow_open_engagement=false` and `allow_post_workpaper=false`.
   Label-only `INVOKE_OPEN_ENGAGEMENT` / `INVOKE_POST_WORKPAPER` modes
   exist for unit tests only.
5. Never invent engagement open/sign or workpaper post from cue detection
   alone.
6. Engineering-gated: ledger `production_approved=false` remains false.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-51 document_ingested | Documents remain uningested |
| Open / sign engagement from cues | Partner acceptance required |
| Post workpapers from cues | Review workflow required |
| Close GAP-P2-008 / GAP-P0-001 | Honesty + security review still required |
| Live allow_open_engagement / allow_post_workpaper | Would invent engagement authority |

## Related

- `docs/mokxya-ai/MAI_52_CA_FIRM_ENGAGEMENT_WORKPAPER.md`
- `docs/mokxya-ai/baselines/MAI_52_SLICE1_BASELINE_SUMMARY.md`
- `docs/mokxya-ai/baselines/MAI_52_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/ca_firm_engagement_workpaper_service.py`
- `erp_bot/src/oip/modules/conversation/application/ca_firm_engagement_workpaper_consume_service.py`
