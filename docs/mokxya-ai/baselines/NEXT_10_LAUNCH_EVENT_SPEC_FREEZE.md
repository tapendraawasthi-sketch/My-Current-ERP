# NEXT-10 — Narrow Launch Event Spec Freeze

**Date:** 2026-07-19  
**Step:** NEXT-10  
**ADR:** ADR_0077  

## Frozen launch-supported set

| Event id | Mode | Authority owner | MAI-18 spec |
|----------|------|-----------------|-------------|
| `sales_invoice_draft` | accountant | ACCOUNTANT_SALES_DRAFT | `sales_v1` |
| `purchase_invoice_draft` | accountant | ACCOUNTANT_PURCHASE_DRAFT | `purchase_v1` |
| `ask_company_report` | ask | ASK_COMPANY_REPORT_ENGINE | `report_v1` ∩ BS/P&L/TB/ledger |

## Explicitly unsupported (safe message)

Receipt/payment, returns, bank recon drafts, journal/contra, master data create/modify,
transaction modify/reverse.

## Gate

`handle_mode_aware_erp` → `evaluate_launch_event_freeze` →
`LAUNCH_EVENT_UNSUPPORTED` safe message; `draft_mutations=0`.

Pending clarification merges remain allowed.

## Evidence

- `docs/mokxya-ai/decisions/ADR_0077_LAUNCH_EVENT_SPEC_FREEZE.md`
- `docs/mokxya-ai/MAI_LAUNCH_EVENT_SPEC_REGISTRY.json`
- `erp_bot/.../launch_event_spec_policy.py`
- `erp_bot/tests/oip/language_runtime/test_mai_next10_launch_event_freeze.py`

## Explicit non-claims

- Not production_approved (NEXT-20).
- Not execution authority / sole NLU / sole OEC.
- Receipt/payment not in freeze.
