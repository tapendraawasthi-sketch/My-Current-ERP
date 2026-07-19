# ADR_0068 — Private User-Document Intelligence Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-51-PRIVATE-USER-DOCUMENT-INTELLIGENCE (slice 2)
- **Extends:** ADR_0001, ADR_0003

## Context

MAI-36–50 cover legal research through speech-channel candidates.
Private user-document intelligence needs an explicit candidate policy
before any document ingest, index, QA live path, or retention apply.

## Decision

1. MAI-51 owns `PrivateUserDocumentIntelligenceBundleV1` on
   `CanonicalAIRequestV1` after NEPALI_ENGLISH_SPEECH_CHANNEL.
2. Semantic gate: cue detection only (private document, user upload,
   document Q&A / summary / extraction, retention, access control) —
   **not** MAI-50 speech enablement.
3. Slice 1: declare
   `pilot_scope=PRIVATE_USER_DOCUMENT_INTELLIGENCE_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `private_document_intelligence_enabled=false`,
   `document_ingested=false`,
   `document_indexed=false`,
   `document_qa_live=false`,
   `retention_policy_applied=false`,
   `access_control_enforced=false`,
   `cross_tenant_isolation_proven=false`,
   `user_document_released=false`,
   `production_approved=false`,
   `documents_retrieved=0`,
   `gap_p2_008_status=OPEN`.
4. Slice 2: consume into `CANDIDATE_ONLY`
   `private_user_document_intelligence_candidate` with null plans; live
   ingress forces `allow_ingest=false` and `allow_qa=false`. Label-only
   `INVOKE_INGEST` / `INVOKE_QA` modes exist for unit tests only.
5. Never invent document ingest, index, QA live, or isolation proof from
   cue detection alone.
6. Engineering-gated: ledger `production_approved=false` remains false.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-50 speech_channel_enabled | Speech remains disabled |
| Ingest / index documents from cues | Consent + retention + isolation required |
| Claim cross-tenant isolation proven | Security review still required |
| Close GAP-P2-008 / GAP-P0-001 | Honesty + security review still required |
| Silent document retrieval | Fail-closed; documents_retrieved must stay 0 |
| Live allow_ingest / allow_qa | Would invent document authority |

## Related

- `docs/mokxya-ai/MAI_51_PRIVATE_USER_DOCUMENT_INTELLIGENCE.md`
- `docs/mokxya-ai/baselines/MAI_51_SLICE1_BASELINE_SUMMARY.md`
- `docs/mokxya-ai/baselines/MAI_51_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/private_user_document_intelligence_service.py`
- `erp_bot/src/oip/modules/conversation/application/private_user_document_intelligence_consume_service.py`
