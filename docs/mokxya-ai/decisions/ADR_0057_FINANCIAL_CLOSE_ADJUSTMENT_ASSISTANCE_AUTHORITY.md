# ADR_0057 — Financial Close and Adjustment Assistance Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-40-FINANCIAL-CLOSE-ADJUSTMENT-ASSISTANCE (PASSED_ENGINEERING; not production-approved)
- **Extends:** ADR_0001, ADR_0056, ADR_0047

## Context

MAI-39 declares NFRS/NAS policy/mapping/disclosure candidates without filing.
MAI-40 must declare financial-close / adjustment assistance policy before any
posting or period lock. GAP-P2-008 and unproven effective dates remain open.

## Decision

1. MAI-40 owns `FinancialCloseAdjustmentAssistanceBundleV1` on
   `CanonicalAIRequestV1` after NFRS_NAS_POLICY_DISCLOSURE_PILOT.
2. Semantic gate: MAI-39 pilot COMPLETE + readiness in
   `{POLICY_DECLARED, SCOPE_PARTIAL}`; upstream BLOCKED → close-assist BLOCKED.
3. Slice 1: declare `pilot_scope=FINANCIAL_CLOSE_ADJUSTMENT_ONLY`,
   `adjustment_status=CANDIDATE_ASSISTANCE_ONLY`,
   `specialist_signoff_status=NOT_SIGNED`,
   `close_posted=false`,
   `adjustments_posted=false`,
   `books_locked=false`,
   `period_closed=false`,
   `legal_effective_dates_proven=false`,
   `gap_p2_008_status=OPEN`.
4. Never invent close authority or auto-post adjustments.
5. Slice 2: consume builds `close_assist_candidate` /
   `close_assist_consume_mode` (`CANDIDATE_ONLY` default for
   POLICY_DECLARED / SCOPE_PARTIAL; `BLOCKED` for fake authority;
   `SKIP` for non-pilot). Live path forces `allow_close_post=false`
   and `allow_adjustment_post=false` — does **not** post close,
   post adjustments, or lock books. GAP-P2-008 stays OPEN.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Post close/adjustments in slice 1–2 | Authority / honesty risk |
| Live post in slice 2 | Not an execution authority |
| Lock books / close period | Not an execution authority |
| Gate only on tax pilot | Wrong domain; NFRS/NAS is upstream |
| Close GAP-P2-008 | Honesty review still required |
| Prove effective dates | Must stay false |

## Related

- `docs/mokxya-ai/MAI_40_FINANCIAL_CLOSE_ADJUSTMENT_ASSISTANCE.md`
- `docs/mokxya-ai/baselines/MAI_40_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/financial_close_adjustment_assistance_service.py`
- `erp_bot/src/oip/modules/conversation/application/financial_close_adjustment_assistance_consume_service.py`
