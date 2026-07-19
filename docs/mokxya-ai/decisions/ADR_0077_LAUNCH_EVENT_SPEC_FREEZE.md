# ADR_0077 — Narrow Launch Event Spec Freeze (NEXT-10)

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-10 (`MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt`)
- **Extends:** MAI-18 Event Spec Registry (annotation); does not grant execution authority
- **Depends on:** NEXT-02 (Model B), NEXT-06 (language suites)

## Context

MAI-18 seeds many event specs as annotation-only. First public AI assistance
must freeze a **tiny** supported set; everything else must clarify/escalate with
a safe message—not silently draft.

## Decision

1. **Launch-supported events** (registry rows with authority owners):
   - `sales_invoice_draft` (Accountant) — MAI-18 `sales_v1`
   - `purchase_invoice_draft` (Accountant) — MAI-18 `purchase_v1`
   - `ask_company_report` (Ask) — MAI-18 `report_v1` ∩ Dexie `SUPPORTED_REPORTS`
2. **Receipt/payment omitted** from freeze: draft path exists but is not a
   launch capability matrix row; treat as `UNSUPPORTED` until a later wave.
3. **Primary path gate** in `handle_mode_aware_erp`: unsupported mutating
   families (settlement, returns, bank recon drafts, journal, master,
   modify/reverse) → safe message; never silent draft.
4. **Passthrough preserved:** greetings, confirm/cancel, pending clarification,
   accounting explanations, ERP shop party queries, Ask-mode mutation deny.
5. Freeze is an **overlay** on MAI-18; `is_execution_authority` remains false;
   Model B confirm tokens (ADR_0075) still required to post.

## Rejected

| Alternative | Why |
|-------------|-----|
| Include all MAI-18 specs | Violates “tiny” launch set |
| Include receipt/payment now | Not a launch capability row; E2E/sync honesty incomplete |
| Claim production_approved | NEXT-20 owns first production release |

## Related

- `docs/mokxya-ai/MAI_LAUNCH_EVENT_SPEC_REGISTRY.json`
- `erp_bot/.../launch_event_spec_policy.py`
- `docs/mokxya-ai/baselines/NEXT_10_LAUNCH_EVENT_SPEC_FREEZE.md`
