# Orbix Phase 4 — Local Connected Development

## Phase 4.2–4.8 — Authoritative purchase command (Model B)

### Prior Phase 4 code review

| Component | Decision |
|-----------|----------|
| `executeOrbixConfirm` | **Refactor** — inventory purchases route to `postPurchaseTransaction`; non-inventory khata keeps `confirmKhataViaProposal` |
| localStorage idempotency | **Deprecated** for purchases — replaced by Dexie `orbixPostingReceipts` |
| `/orbix/drafts` mark-posted | **Keep** — best-effort planning ack only |
| `confirmKhataEntry` | **Keep** for ledger-only khata; **not** for inventory purchases |
| `voucherSlice.addInvoice` | **Refactor** — audit + syncOutbox inside same Dexie txn |
| `_post_confirmed_voucher` | **Refactor** — no longer returns `posted: true` |

### Authoritative command

`src/domains/purchase/postPurchaseTransaction.ts` → `postPurchaseTransaction`

One Dexie transaction: invoices, vouchers, stockMovements, accounts, auditLogs, syncOutbox, orbixPostingReceipts, items, periodLocks.

Shared writers: `src/store/invoicePostingWriters.ts` (`postInvoiceJournal`, `postInvoiceStock`, `generateNextInvoiceNo`).

### Seed / reset

```ts
import { seedOrbixE2ECompany, resetOrbixE2ECompany } from "@/domains/purchase";
```

Company: Orbix E2E Test Company · Item: E2E Test Bike (pcs, inventory).



| Concern | Authority |
|---------|-----------|
| Vouchers, journals, ledgers, stock | **Dexie / IndexedDB** (`src/lib/db.ts`) |
| Purchase draft clarification / preview planning | **Python erp_bot** (`purchase_draft.py`) |
| Posting execution | **Frontend domain service** `executeOrbixConfirm` → `confirmKhataEntry` → `addVoucher` |
| Draft posted ack | Best-effort `POST /orbix/drafts/{id}/mark-posted` |

Do **not** treat Python `post_confirmed_voucher` or stub LLM text as ledger writes.

## Prerequisites

- Python 3.11+ (3.12 OK)
- Node 20+
- Windows: use PowerShell; bash scripts need WSL

## Backend setup

```powershell
cd erp_bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Ensure .env exists (copy from .env.example if needed — do not commit secrets)
```

Key `.env` values for deterministic local Orbix (no paid LLM required for purchase preprocess):

```
API_PORT=8765
OIP_ENABLED=true
OIP_PROVIDER_RUNTIME_ENABLED=true
OIP_ORCHESTRATOR_ENABLED=true
OIP_FORCE_STUB_PROVIDERS=true
```

Purchase clarification/preview uses the **ERP preprocess** path (`skip_llm=True`) and does not need a live LLM.

## Backend start (recommended local)

Prefer Render-style start to skip Ollama/chroma warmup:

```powershell
cd erp_bot
.\.venv\Scripts\Activate.ps1
python scripts\start_render.py
```

Alternative full start (may require Ollama for empty chroma ingest):

```powershell
python scripts\start.py
```

Port: **8765** (`API_PORT`, or `PORT` on Render).

## Health checks

```powershell
curl http://127.0.0.1:8765/health
curl http://127.0.0.1:8765/ready
curl http://127.0.0.1:8765/status
```

`/ready` reports `posting_authority: dexie_local_first`.

## Frontend

```powershell
cd ..
# optional:
# set VITE_ERP_BOT_URL=http://127.0.0.1:8765
npm run dev -- --host 127.0.0.1 --port 3000
```

Default bot URL resolves to `http://localhost:8765` via `src/lib/erpBotClient.ts`.

## Disposable test company

UI QA harness seeds company **Apex Trading** / Orbix E2E harness should use a clearly marked development company:

- Prefer existing `e2e/ui-qa` IndexedDB seed patterns
- Do not point connected tests at production companies

Reset: clear site IndexedDB for the origin, or re-run the UI QA harness bootstrap.

## Connected Playwright

```powershell
$env:ORBIX_E2E_CONNECTED="true"
$env:ERP_BOT_BACKEND_URL="http://127.0.0.1:8765"
$env:ORBIX_E2E_BASE_URL="http://127.0.0.1:3000"
# Prefer pointing Vite at the bot (or use /erp-bot proxy in vite.config)
$env:VITE_ERP_BOT_URL="http://127.0.0.1:8765"
$env:VITE_SELF_CONTAINED_AI="false"
npx playwright test e2e/orbix-connected.spec.ts
```

Harness: `/e2e/ui-qa.html` seeds **Orbix E2E Test Company** and exposes `window.__orbixE2E` Dexie helpers.

Without `ORBIX_E2E_CONNECTED=true`, connected tests skip.

## Deterministic provider

Local connected flows use erp_bot preprocess + `OIP_FORCE_STUB_PROVIDERS=true` (purchase draft path does not need a live LLM). `/ready` reports `force_stub_providers` and `posting_authority: dexie_local_first`. No separate silent production test provider.

## Contract fixtures (no live bot)

```powershell
npm run test:orbix-contract
```

## Typed confirmation

UI Confirm → `executeOrbixConfirm` with:

- `draft_id`, `preview_hash`, `idempotency_key`
- mode + role checks
- Dexie atomic voucher write
- local idempotency store (`orbix-posting-idempotency-v1`)
- optional draft mark-posted on erp_bot

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port in use | Change `API_PORT` or stop other process on 8765 |
| Chroma ingest hang | Use `start_render.py` |
| Stub chat replies for general Q&A | Expected with `OIP_FORCE_STUB_PROVIDERS=true`; purchase preprocess still works |
| Frontend offline card | Check `VITE_ERP_BOT_URL` and `/health` |
