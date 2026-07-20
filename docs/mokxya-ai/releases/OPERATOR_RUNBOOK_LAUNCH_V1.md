# Operator runbook — MokXya AI launch rows V1

**Date:** 2026-07-20  
**Step:** PR-D4 / ADR_0096  
**Pack status:** **READY**  
**Post-launch stable:** **false** (await arm + 14-day window)

## 0. Scope

Applies when either launch flag may be armed:

- `LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED`
- `LAUNCH_ASK_COMPANY_REPORTS_PRODUCTION_APPROVED`

Primary product entry: `/orbix/chat/stream`.  
ERP screens remain available if AI flags are flipped OFF.

## 1. Confirm token denials (Accountant Mode)

**Symptoms:** User cannot confirm; toast/token missing / stale preview / denied.

**Check:**

1. Preview still open and matches draft (Model B short-lived token).
2. Mode is Accountant + `allowsConfirm`.
3. NL “yes” alone must **not** post — require explicit confirm control.
4. Trace: confirm denial rate / `confirm_token` errors in Orbix/OIP logs.

**Mitigate:** Ask user to refresh preview → confirm again. If rate spikes,
flip sales/purchase flag OFF (see §6).

## 2. Posting failed

**Symptoms:** Confirm accepted but no receipt / `posting_failed`.

**Check:**

1. Dexie domain engine error in client logs.
2. Node/OEC launch writers are hard-denied (ADR_0085) — product path is Dexie.
3. Day Book / Sales / Purchase registers for partial writes.

**Mitigate:** Do not retry blindly from NL. Capture receipt/error id; hotfix
with tests if P0. Consider flag OFF if widespread.

## 3. Sync stuck (queued ≠ synced)

**Symptoms:** Badge stays “Waiting to sync”; pending age grows.

**Check:**

1. `eventSyncQueue` ages (ADR_0074 / ADR_0086 honesty).
2. Do **not** label queued as Synced.
3. Conflict → require reconfirm (TICKET-PR-B3-001 staging exercise).

**Mitigate:** Inspect sync worker / network; leave badge honest. Flag OFF
only if posts succeed locally but sync floods incidents.

## 4. Ask abstain spikes

**Symptoms:** Sudden rise in refuse / citation force-abstain.

**Check:**

1. Retrieval still LEXICAL_ONLY in prod (ADR_0081).
2. Ungrounded tax/law must abstain (ADR_0080 / ADR_0088).
3. Ask Mode zero mutation — no drafts/posts from Ask.

**Mitigate:** Prefer over-refuse to inventing law. If product-help wrongly
abstains, file language defect (PR-D2) — do not weaken citation honesty.

## 5. Mode / launch-event restrictions

**Symptoms:** `mode_restriction` / `LAUNCH_EVENT_UNSUPPORTED` counts up.

**Check:** Settlement/returns/bank recon are out of AI launch set until PR-E.

**Mitigate:** Point users to ERP screens; do not widen freeze without ADR.

## 6. Rollback (both rows)

### Sales / purchase

1. Env: `LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED=false`
2. Registry: `flag_armed=false`, row `production_approved=false`
3. Effect: AI drafts disabled; billing/purchase ERP screens remain

### Ask company reports

1. Env: `LAUNCH_ASK_COMPANY_REPORTS_PRODUCTION_APPROVED=false`
2. Registry: `flag_armed=false`, row `production_approved=false`
3. Effect: Ask report answers for that row disabled; ERP reports remain

Never force-push / rewrite Lovable history as rollback.

## 7. Day-0 / monitoring pointers

| Artifact | Path |
|----------|------|
| Day-0 checklist | `artifacts/prod-ready-pr-c3/SMOKE_CHECKLIST.md` |
| Sales/purchase dossier | `docs/mokxya-ai/releases/LAUNCH_ACCOUNTANT_SALES_PURCHASE_V1.md` |
| Ask reports dossier | `docs/mokxya-ai/releases/LAUNCH_ASK_COMPANY_REPORTS_V1.md` |
| Hygiene CI | `npm run test:prod-ready-hygiene` / `.github/workflows/prod-ready-hygiene.yml` |

## 8. On-call

| Role | Owner |
|------|-------|
| Product owner | PENDING (`OWNER_SIGNOFF.md` per row) |
| Engineering | Repository maintainer |

## Explicit non-claims

- Not production_approved  
- Not 14-day stable  
- Not Day-0 smoke PASS  
- Not NEXT-20 DONE  
