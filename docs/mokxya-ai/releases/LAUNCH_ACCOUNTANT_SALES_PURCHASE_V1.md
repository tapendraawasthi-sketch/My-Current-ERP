# Release dossier — LAUNCH-ACCOUNTANT-SALES-PURCHASE V1

**Date:** 2026-07-20  
**Step:** PR-C1 / ADR_0090 + PR-C1-ARM / ADR_0100  
**Capability row:** `LAUNCH-ACCOUNTANT-SALES-PURCHASE`  
**Flag status:** **ARMED** (registry); set Render env `LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED=true`  
**Depth:** PRODUCTION (this row only; Ask row still off)

## 1. Scope

Accountant Mode narrow launch:

- Sales invoice draft → preview → edit → confirm → Dexie domain post
- Purchase invoice draft → preview → edit → confirm → Dexie domain post
- Languages: English, Nepali Devanagari, Romanized Nepali, light code-mix
- Events: `sales_invoice_draft`, `purchase_invoice_draft` (ADR_0077 freeze)

Out of AI launch set (ERP screens may still exist):

- Settlement / receipts / payments as AI drafts
- Sales/purchase returns as AI drafts
- Bank reconciliation via AI
- Autonomous post / NL “yes” post
- Track I (speech / OCR / CA / calendar)

## 2. Supported utterance families (minimum)

| Family | Examples |
|--------|----------|
| Sales | sold / becheko / बिक्री … party, qty, rate/amount, cash/credit |
| Purchase | bought / kineko / किनें … same slots |
| Clarify | incomplete sale/purchase → ask missing slot → merge |
| Confirm | explicit confirm control (not NL assent) |

## 3. Limitations (disclosed)

1. Settlement / returns / bank recon are **not** in the AI launch set.
2. Natural-language “yes” / assent **does not post** (`nl_assent_posts=false`).
3. After post, sync may show **Waiting to sync** until ack (queued ≠ synced).
4. Legal / tax-current Ask answers may **abstain** (GAP-P2-008 REDUCED).
5. Invoice form totals are **display estimates**; ledger uses Dexie domain engine.
6. Node/OEC launch-marked writers are **hard-denied** (ADR_0085); product path is Dexie Model B.

## 4. Residual gaps (not CLOSED)

| Gap | Status | Relevance |
|-----|--------|-----------|
| GAP-P0-001 | REDUCED | Mutation residual; launch hard-deny |
| GAP-P1-002 | REDUCED | Sync honesty; dual badge residual |
| GAP-P2-002 | REDUCED | UI display estimates |
| GAP-P2-008 | REDUCED | Knowledge honesty; staging review PENDING |
| GAP-P2-001 | REDUCED | Prod LEXICAL_ONLY |

## 5. Blocking tickets before flag arm

| Ticket | Blocks |
|--------|--------|
| TICKET-PR-B1-001 | Staging operator attestation |
| TICKET-PR-B1-002 | Connected E2E green on staging |
| TICKET-PR-B3-001 | Staging conflict reconfirm exercise |
| TICKET-PR-B5-001 | Staging professional knowledge review |

## 6. Monitoring (after arm)

| Signal | Intent |
|--------|--------|
| Confirm token denial rate | Detect broken confirm path |
| `posting_failed` rate | Detect domain post failures |
| Sync pending age | Detect stuck EVENT_SYNC_QUEUE |
| `mode_restriction` / `LAUNCH_EVENT_UNSUPPORTED` counts | Detect out-of-freeze traffic |

Implementation note: query sources = Orbix/OIP traces + posting receipts + `eventSyncQueue` ages (operator dashboard or log queries). Exact SQL/Grafana IDs are environment-specific; record under `artifacts/prod-ready-pr-c1/manual/` when armed.

## 7. Rollback

1. Set `LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED=false` (env) **and**
   registry `flag_armed=false` / row `production_approved=false`.
2. Effect: AI drafts for this capability row disabled; ERP billing/purchase screens remain.
3. Do **not** force-push or rewrite Lovable history as rollback.

## 8. On-call owner

| Role | Owner | Contact |
|------|-------|---------|
| Product owner (sign-off) | **PENDING** | — |
| Engineering on-call | Repository maintainer | GitHub `tapendraawasthi-sketch/My-Current-ERP` |

Owner name + date required in `artifacts/prod-ready-pr-c1/OWNER_SIGNOFF.md` before flag arm.

## 9. Arm checklist (PR-C1-ARM)

- [x] TICKET-PR-B1-001 PASS  
- [x] TICKET-PR-B1-002 PASS (owner residual — next12 staging; browser/sync gaps accepted)  
- [x] TICKET-PR-B3-001 PASS (owner residual — approved b3 2026-07-20)  
- [x] TICKET-PR-B5-001 PASS (owner `b5pass` 2026-07-20)  
- [x] Owner sign-off filed (`sign OWNER` 2026-07-20)  
- [x] Staging golden path green within 48h of flip (owner residual accepted)  
- [x] Matrix row → `depth=PRODUCTION`, `production_approved=true` **for this row only**  
- [x] Registry flag armed (ADR_0100); set Render env `LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED=true`  
- [x] NEXT-20 marked DONE for this row  

**Depth:** PRODUCTION (armed 2026-07-20)

## Explicit non-claims

- Not Ask-reports row PRODUCTION (needs PR-C2-ARM)
- Not global all-rows production_approved
- Not 14-day stability proven
- Runtime live gate still needs Render env flag set
