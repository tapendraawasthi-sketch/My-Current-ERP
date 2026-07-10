# 01 — Repository Map

**Project:** Sutra ERP (BUSY ERP monorepo)  
**Root:** `/home/tapendraawasthi/My-Current-ERP`  
**Generated:** 2026-07-10  
**Role:** Principal Architect repository intelligence — structural map only.

---

## 1. Executive Map

| Package | Files (approx) | Runtime role |
|---------|----------------|--------------|
| `src/` | 801 | Primary ERP SPA (React 19, Vite, Dexie) |
| `erp_bot/` | 334 | AI backend (FastAPI, Ollama, Chroma, NIOS) |
| `backend/` | 68 | Tenant knowledge + R2 object storage (Python) |
| `packages/backend/` | 16 | Cloud sync + auth + mobile Khata API (Express) |
| `khata-app/` | 31+ | Mobile Khata PWA (Capacitor) |
| `scripts/` | 31 | Build, test, corpus, eval |
| `e2e/` | 2 | Playwright E2E |
| `nios/` | 3 | NIOS JSON schemas + docs (no runtime) |

**Total reachable source:** ~1,437 files (excluding `node_modules`, `dist`, `venv`, large generated `data/`).

---

## 2. Complete Directory Tree

```
My-Current-ERP/
├── AGENTS.md                         # Design system + scope rules
├── DEPLOYMENT.md                     # Render + GPU erp_bot deploy
├── GEMINI.md                         # Legacy BUSY docs
├── LAUNCH_CHECKLIST.md               # Mobile Khata launch
├── README.md
├── package.json                      # Root npm monorepo scripts
├── serve.mjs                         # Production static + /erp-bot proxy
├── vite.config.ts                    # Vite build + chunk split
├── render.yaml                       # Render.com service
├── vercel.json                       # Secondary SPA hosting
├── docker-compose.yml                # Local PG + Redis + Express
├── playwright.config.ts
├── eslint.config.js
├── tsconfig.json
├── index.html
│
├── .github/workflows/
│   ├── test.yml
│   ├── ekhata-ci.yml
│   ├── render-deploy.yml
│   └── frontend-deploy.yml
│
├── docs/                             # Architecture + product docs
├── public/                           # Static assets, uploads/logos
│
├── scripts/                          # Root build/test/eval scripts
├── e2e/                              # Playwright specs + helpers
│
├── src/                              # ★ PRIMARY ERP FRONTEND
│   ├── main.tsx, App.tsx, server.js, styles.css
│   ├── ai/                           # SUTRA AI (134 files)
│   ├── components/                   # UI shell + domain (175)
│   ├── pages/                        # ERP screens (214)
│   ├── lib/                          # Business engines (204)
│   ├── store/                        # Zustand (17)
│   ├── nios/                         # NIOS client stubs (18)
│   ├── context/, hooks/, data/
│   ├── db/, routes/, controllers/, middleware/
│   ├── e2e/                          # In-app test harness
│   └── styles/
│
├── erp_bot/                          # ★ AI BACKEND
│   ├── requirements.txt, .env.example
│   ├── scripts/                      # 66 ops scripts
│   ├── knowledge/nepal/              # 14 markdown RAG sources
│   ├── training/qlora/               # LoRA training pipeline
│   ├── tests/                        # pytest
│   └── src/
│       ├── config.py
│       ├── api/                        # FastAPI :8765
│       ├── agent/                      # Legacy Orbix/Falcon
│       ├── orbix/                      # Orbix v2
│       ├── nios/                       # NIOS v3 (112 files)
│       ├── khata/, nlu/, falcon_trader/
│       ├── knowledge/, vectorstore/, ingestion/
│       ├── conversation/, bridges/, reasoning/
│       ├── intelligence/, memory/, education/
│       ├── eval/, personality/, reports/, watcher/, ui/
│
├── backend/                          # ★ R2 + TENANT KNOWLEDGE
│   ├── api/, config/, knowledge/, storage/, tests/
│
├── packages/backend/                 # ★ EXPRESS CLOUD API
│   └── src/ (server, routes, lib, middleware, db/)
│
├── khata-app/                        # ★ MOBILE KHATA
│   ├── src/, android/, public/
│
└── nios/                             # Contracts + canonical docs
    ├── contracts/
    └── docs/
```

---

## 3. Subsystem Discovery

### 3.1 Client Subsystems

| ID | Subsystem | Location | Consumers |
|----|-----------|----------|-----------|
| C1 | ERP SPA Shell | `src/App.tsx`, `Layout.tsx`, `Sidebar.tsx`, `BusyMenuBar.tsx` | All authenticated users |
| C2 | ERP Pages | `src/pages/` (214) | Routed via `currentPage` switch |
| C3 | ERP Components | `src/components/` (175) | Pages, Layout |
| C4 | Mobile Khata | `khata-app/` | Mobile/PWA users |
| C5 | E2E Harness | `e2e/`, `src/e2e/` | CI, Playwright |

### 3.2 State & Persistence Subsystems

| ID | Subsystem | Location | Storage |
|----|-----------|----------|---------|
| S1 | Application Store | `src/store/` | Zustand + Dexie |
| S2 | Dexie ERP DB | `src/lib/db.ts` | IndexedDB `SutraERPDatabase` |
| S3 | SUTRA AI Learning DB | `src/ai/learning/SutraAiDexie.ts` | IndexedDB `SutraAiLearning` |
| S4 | Session/Draft Storage | sessionStorage, localStorage | Browser |
| S5 | Cloud PostgreSQL | `packages/backend`, `backend/knowledge` | PostgreSQL |
| S6 | Cloud Redis | `packages/backend` | Redis |
| S7 | Vector Store | `erp_bot/vectorstore`, `backend/knowledge` | ChromaDB |
| S8 | Object Storage | `backend/storage` | Cloudflare R2 |
| S9 | NIOS/Orbix SQLite | `erp_bot/src/nios`, `erp_bot/src/orbix` | SQLite files |

### 3.3 Domain Subsystems (ERP)

| ID | Subsystem | Key modules |
|----|-----------|-------------|
| D1 | Accounting Engine | `src/lib/accounting.ts`, `store/slices/voucherSlice.ts` |
| D2 | Masters | Parties, Items, COA, Warehouses pages + store slices |
| D3 | Billing/Invoicing | `BillingInvoice.tsx`, `SalesInvoiceForm.tsx` |
| D4 | Finance Vouchers | Journal, Payment, Receipt, Contra, CN/DN pages |
| D5 | Inventory | Stock transfer, journal, production pages |
| D6 | Reports | Balance Sheet, P&L, TB, Day Book, VAT, aging |
| D7 | Payroll/TDS | Payroll pages, `nepalPayrollEngine.ts`, `tdsNepal.ts` |
| D8 | Banking | Bank reconciliation, cheque register |
| D9 | Compliance | CBMS (`cbmsService.ts`), Nepal tax |
| D10 | Sync | `syncEngine.ts` ↔ `packages/backend` |

### 3.4 AI Subsystems

| ID | Subsystem | Client | Server |
|----|-----------|--------|--------|
| A1 | SUTRA AI | `src/ai/` | Optional Ollama via erp_bot |
| A2 | Falcon | `src/lib/falcon/`, `falconStore` | erp_bot agent / offline KB |
| A3 | e-Khata / Orbix | `src/lib/ekhata/`, `eKhataStore` | erp_bot khata + Qwen stream |
| A4 | NIOS v3 | `src/nios/` | `erp_bot/src/nios/` |
| A5 | Orbix v2 Agent | `lib/orbix/` (alt) | `erp_bot/src/orbix/` |
| A6 | RAG / Knowledge | `lib/nepal-ai/`, static JSON | `erp_bot/knowledge`, `vectorstore` |
| A7 | NLU Pipeline | `lib/ekhata/parseKhata.ts` | `erp_bot/nlu`, `falcon_trader`, `khata` |

### 3.5 Infrastructure Subsystems

| ID | Subsystem | Location |
|----|-----------|----------|
| I1 | Production Edge | `serve.mjs` |
| I2 | Build Pipeline | `vite.config.ts`, `scripts/render-build.sh` |
| I3 | CI/CD | `.github/workflows/` |
| I4 | Local Dev Stack | `docker-compose.yml`, `erp_bot/scripts/start.py` |
| I5 | Legacy Node ERP API | `src/server.js` (:3001) |

---

## 4. Navigation & Routing Map

**No React Router.** Navigation = `useStore().currentPage` string rendered in `App.tsx` switch.

| Source | Mechanism |
|--------|-----------|
| `Sidebar.tsx` | Mobile drawer (~50 links) |
| `BusyMenuBar.tsx` | Desktop Tally-style menus |
| `TopMenuBar` / `GoToPanel` | Alt+G command palette |
| `GlobalSearch` | Ctrl+K |
| Keyboard shortcuts | Ctrl+B/T/L/G/U, F12 |
| `window` event | `CustomEvent("navigate")` |
| Hub pages | `VoucherEntryHub`, `MasterControlCentre`, `ConfigurationHub` |

**~100 routes** wired in `App.tsx`; **~107 page files** unwired (fallback to `FinancialDashboard`).

---

## 5. Auth Flow Map

```
initializeApp() → authStage:
  checking → no-company (SignUpWizard)
           → gateway (GatewayScreen)
           → company-login (CompanyLoginScreen)
           → authenticated (Layout + pages)

Password: PBKDF2 (HTTPS) / SHA256 fallback in store.types.ts
Session: sessionStorage sutra_user_id, sutra_company_id
```

---

## 6. Data Flow Map (Primary Paths)

```
User action (page/form)
  → useStore mutation
  → Dexie write (lib/db.ts)
  → optional enqueueSyncRecord (syncEngine)
  → optional emitNiosEvent (invoice/voucher posted)

AI chat message
  → AI store (sutra/falcon/ekhata/nios)
  → erpBotClient / niosClient / local brain
  → serve.mjs /erp-bot proxy → erp_bot :8765
  → Ollama :11434 + Chroma RAG

Mobile Khata confirm
  → khataApi → packages/backend /api/khata/confirm
  → PostgreSQL vouchers + ledger_postings
```

---

## 7. Integration Points Map

| Integration | Direction | Protocol |
|-------------|-----------|----------|
| Ollama | erp_bot → localhost/GPU | HTTP :11434 |
| erp_bot | SPA → serve.mjs → GPU | HTTP/SSE :8765 |
| PostgreSQL | packages/backend, backend/knowledge | TCP :5432 |
| Redis | packages/backend | TCP :6379 |
| Cloudflare R2 | backend/storage | S3 API |
| ChromaDB | erp_bot, backend/knowledge | Local persistent |
| SendGrid | packages/backend messaging | SMTP/API |
| eSewa/Khalti | khata-app payment deep links | HTTPS |
| CBMS (Nepal e-invoice) | `cbmsService.ts` | External API |
| Playwright | CI e2e | Browser automation |

---

## 8. Message Queues & Async Workers

| Queue/Worker | Technology | Location | Purpose |
|--------------|------------|----------|---------|
| Sync outbox | Dexie `syncOutbox` table | `src/lib/db.ts` | Offline-first cloud sync |
| Khata offline queue | IndexedDB | `khata-app/lib/offlineQueue.ts` | Mobile confirm retry |
| Knowledge job queue | Redis or in-memory FIFO | `backend/knowledge/jobs/queue.py` | Tenant doc ingestion |
| Knowledge worker | Daemon thread | `backend/knowledge/jobs/worker.py` | Background ingest |
| NIOS event bus | In-process + DOM events | `erp_bot/nios/kernel/event_bus.py`, `src/nios/events/` | voucher.posted workflows |
| Service worker sync | Background Sync API | `khata-app/public/sw.js` | PWA offline sync |
| File watcher | watchdog debounce | `erp_bot/watcher/watcher.py` | Incremental codebase reindex |

**Note:** Redis is listed in `erp_bot/requirements.txt` but not used in erp_bot Python code; Redis is used by `packages/backend`.

---

## 9. File Count by Top-Level Package

| Path | TS/TSX/PY/JS |
|------|--------------|
| `src/` | 799 |
| `erp_bot/` | 318 |
| `backend/` | 68 |
| `scripts/` | 31 |
| `khata-app/` | 29 |
| `packages/` | 16 |
| Root configs | 5 |

---

## 10. Related Documents

| Doc | Content |
|-----|---------|
| `02_DEPENDENCY_GRAPH.md` | Import and package dependencies |
| `03_MODULE_INVENTORY.md` | Per-module specifications |
| `04_SERVICE_INVENTORY.md` | Processes and services |
| `05_AI_SYSTEM_INVENTORY.md` | AI stacks detail |
| `06_DATABASE_INVENTORY.md` | All data stores |
| `07_API_INVENTORY.md` | HTTP endpoints |
| `08_BUILD_DEPLOYMENT.md` | Build and deploy paths |
| `09_CONFIGURATION_INVENTORY.md` | Env and config |
| `10_ARCHITECTURE_SUMMARY.md` | Consolidated view |
