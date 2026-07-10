# 04 — Service Inventory

**Project:** Sutra ERP  
**Generated:** 2026-07-10

---

## Service Catalog

Each service: **Purpose**, **Responsibilities**, **Dependencies**, **Dependents**, **Public API**, **Internal API**, **Entry Points**, **Technology**, **Complexity**.

---

## SVC-01: Vite Dev Server

| Field | Value |
|-------|-------|
| **Purpose** | Local frontend development with HMR |
| **Responsibilities** | Serve `index.html`, `e2e/ekhata.html`; proxy-free dev on port 3000 |
| **Dependencies** | Node 20+, `vite.config.ts`, `package.json` |
| **Dependents** | Developers, Playwright (dev mode) |
| **Public API** | HTTP `localhost:3000` |
| **Internal API** | Vite plugin pipeline (react, tailwind, tsconfig-paths) |
| **Entry Points** | `npm run dev` → `vite dev` |
| **Technology** | Vite 6, React 19 |
| **Complexity** | Low |

---

## SVC-02: serve.mjs (Production Edge)

| Field | Value |
|-------|-------|
| **Purpose** | Production HTTP server for SPA + erp_bot reverse proxy |
| **Responsibilities** | Static `dist/`; SPA fallback; `/erp-bot/*` proxy; health checks; offline builtin status |
| **Dependencies** | `dist/index.html`, `ERP_BOT_BACKEND_URL` env |
| **Dependents** | All production browser users |
| **Public API** | `GET /*`, `GET /health`, `/ping`, `/_health`, `/erp-bot/*` |
| **Internal API** | `handleErpBotRequest`, `readRequestBody` |
| **Entry Points** | `npm start` → `node serve.mjs`; Render `startCommand` |
| **Technology** | Node.js `http` module (no Express) |
| **Complexity** | Medium |

---

## SVC-03: erp_bot FastAPI (Primary AI Backend)

| Field | Value |
|-------|-------|
| **Purpose** | Unified AI/intelligence HTTP API for ERP assistant features |
| **Responsibilities** | Chat (legacy, v2, NIOS, Orbix); khata parse; RAG; classification; reindex; health |
| **Dependencies** | Ollama :11434, ChromaDB, SQLite, optional PostgreSQL, optional `backend/` mount |
| **Dependents** | SPA via `/erp-bot`, khata-app via subprocess NLU, NIOS federation |
| **Public API** | `/`, `/nios/v1/*`, `/orbix/v2/*`, `/khata/*`, `/v2/*`, `/health` |
| **Internal API** | `get_kernel`, `get_gateway`, `get_engine`, module singletons |
| **Entry Points** | `erp_bot/scripts/start.py`, `start_nios_api.sh`, `uvicorn` |
| **Technology** | FastAPI, Python 3.10+, LangChain, ChromaDB |
| **Complexity** | Very High |

---

## SVC-04: Ollama LLM Runtime

| Field | Value |
|-------|-------|
| **Purpose** | Local LLM inference and embeddings |
| **Responsibilities** | Serve `qwen3:32b`, `qwen3:4b`, `nomic-embed-text` models |
| **Dependencies** | GPU/CPU, model files, `OLLAMA_BASE_URL` |
| **Dependents** | erp_bot (all AI stacks) |
| **Public API** | HTTP `:11434` (Ollama REST) |
| **Internal API** | Model loading, keep-alive |
| **Entry Points** | `ollama serve`; `erp_bot/scripts/setup_local.sh` |
| **Technology** | Ollama |
| **Complexity** | Medium (ops) |

---

## SVC-05: packages/backend Express API

| Field | Value |
|-------|-------|
| **Purpose** | Cloud sync, auth, messaging, mobile Khata REST API |
| **Responsibilities** | JWT auth; sync pull/push; khata transaction/confirm; email/SMS |
| **Dependencies** | PostgreSQL, Redis, optional erp_bot subprocess for NLU |
| **Dependents** | `syncEngine.ts`, `khata-app`, future cloud features |
| **Public API** | `/api/health`, `/api/auth/*`, `/api/sync/*`, `/api/khata/*`, `/api/messaging/*` |
| **Internal API** | `syncHandlers`, `syncPull`, `falconNlu`, middleware stack |
| **Entry Points** | `npm run dev` / `npm start` in `packages/backend`; docker-compose |
| **Technology** | Express 5, TypeScript, pg, ioredis, bcrypt, JWT |
| **Complexity** | High |

---

## SVC-06: src/server.js (Legacy Node ERP API)

| Field | Value |
|-------|-------|
| **Purpose** | Parallel Express API for company/settings/backup (legacy) |
| **Responsibilities** | PG migrations; company CRUD; fiscal year; backup; audit routes |
| **Dependencies** | PostgreSQL (`src/db/pool.js`) |
| **Dependents** | Potentially unused by SPA auth (Dexie-primary) |
| **Public API** | `/health`, `/api/*` via routes/controllers |
| **Internal API** | `controllers/*`, `middleware/audit.js` |
| **Entry Points** | Manual start (not in root `npm start`) |
| **Technology** | Express, JavaScript |
| **Complexity** | Medium |

---

## SVC-07: backend/knowledge Worker

| Field | Value |
|-------|-------|
| **Purpose** | Background tenant document ingestion |
| **Responsibilities** | Dequeue jobs; extract PDF/DOCX/image; chunk; embed; index Chroma; audit log |
| **Dependencies** | PostgreSQL, R2, Chroma, Ollama embeddings, Redis (optional queue) |
| **Dependents** | NIOS `FilesFederationAdapter` |
| **Public API** | None (internal thread); triggered via POST `/knowledge/v1/documents` |
| **Internal API** | `KnowledgeContainer`, `orchestrator.process_job`, `worker` thread |
| **Entry Points** | `start_knowledge_worker()` in erp_bot server startup |
| **Technology** | Python threading, FastAPI mount |
| **Complexity** | High |

---

## SVC-08: backend/storage (R2 Service)

| Field | Value |
|-------|-------|
| **Purpose** | Cloudflare R2 object storage abstraction |
| **Responsibilities** | Upload, download, list, delete, CDN URLs, circuit breaker, retry |
| **Dependencies** | `R2_*` env vars, boto3 |
| **Dependents** | backend/knowledge pipeline, `/storage/health` |
| **Public API** | Python `backend.storage.*` functions; `GET /storage/health` |
| **Internal API** | `R2StorageService`, `StorageContainer`, internal protocols |
| **Entry Points** | Imported by knowledge adapters; health route |
| **Technology** | Python, boto3, Cloudflare R2 |
| **Complexity** | High |

---

## SVC-09: ERP SPA (Browser Application)

| Field | Value |
|-------|-------|
| **Purpose** | Full ERP accounting application in browser |
| **Responsibilities** | UI, state, offline persistence, AI panels, reports, invoicing |
| **Dependencies** | Dexie, Zustand, serve.mjs or Vite; optional erp_bot |
| **Dependents** | End users |
| **Public API** | Browser UI; no server API of its own |
| **Internal API** | `useStore`, `openDB`, AI stores, `erpBotClient` |
| **Entry Points** | `main.tsx` → `App.tsx` |
| **Technology** | React 19, TypeScript, Tailwind 4, Dexie 4 |
| **Complexity** | Very High |

---

## SVC-10: Mobile Khata App

| Field | Value |
|-------|-------|
| **Purpose** | Chat-first mobile ledger for Nepali small business |
| **Responsibilities** | NLU chat, confirm vouchers, offline queue, OCR, voice, payments |
| **Dependencies** | packages/backend Khata API, service worker |
| **Dependents** | Mobile users |
| **Public API** | PWA UI; calls `/api/khata/*` |
| **Internal API** | `offlineQueue`, `khataApi`, `insightEngine` |
| **Entry Points** | `khata-app/src/main.tsx` |
| **Technology** | React 19, Capacitor 6, Tesseract.js, Vite |
| **Complexity** | Medium-High |

---

## SVC-11: File Watcher (Codebase Reindex)

| Field | Value |
|-------|-------|
| **Purpose** | Incremental ERP codebase vector index on file change |
| **Responsibilities** | Debounce filesystem events; re-embed changed files |
| **Dependencies** | `ERP_PATH`, Chroma, ingestion/embedder |
| **Dependents** | Falcon code_qa, agent tools |
| **Public API** | None; started on erp_bot startup |
| **Internal API** | `watcher.start_watcher()` |
| **Entry Points** | `erp_bot/src/api/server.py` on_startup |
| **Technology** | Python watchdog |
| **Complexity** | Low-Medium |

---

## SVC-12: Sync Engine (Client)

| Field | Value |
|-------|-------|
| **Purpose** | Offline-first cloud sync for master data |
| **Responsibilities** | Enqueue mutations; batch push; pull incremental changes |
| **Dependencies** | Dexie `syncOutbox`, packages/backend `/api/sync` |
| **Dependents** | `store/index.ts` mutations, `Layout.tsx` startup |
| **Public API** | `enqueueSyncRecord`, `runSyncCycle`, `onSyncStatusChange` |
| **Internal API** | IndexedDB outbox reader |
| **Entry Points** | `startSyncLoop()` from Layout |
| **Technology** | TypeScript, fetch API |
| **Complexity** | Medium |

---

## SVC-13: CBMS Queue Worker

| Field | Value |
|-------|-------|
| **Purpose** | Nepal electronic invoice (CBMS) submission queue |
| **Responsibilities** | Process `cbmsQueue` Dexie table; submit to tax API |
| **Dependencies** | `cbmsApi.ts`, `cbmsService.ts`, company settings |
| **Dependents** | Invoice posting flow |
| **Public API** | Started from `initializeApp` |
| **Internal API** | Queue polling loop |
| **Entry Points** | `store/index.ts` initializeApp |
| **Technology** | TypeScript |
| **Complexity** | Medium |

---

## SVC-14: Auto Backup Scheduler

| Field | Value |
|-------|-------|
| **Purpose** | Scheduled local ERP data backup |
| **Responsibilities** | Trigger `backupService` on interval |
| **Dependencies** | Dexie export, `backupService.ts` |
| **Dependents** | Layout authenticated shell |
| **Public API** | `startAutoBackupScheduler()` |
| **Internal API** | Timer + export logic |
| **Entry Points** | Layout.tsx useEffect |
| **Technology** | TypeScript |
| **Complexity** | Low |

---

## Service Interaction Matrix

|  | SPA | serve.mjs | erp_bot | Ollama | Express BE | PostgreSQL | Redis | Chroma | R2 |
|--|:---:|:---------:|:-------:|:------:|:----------:|:----------:|:-----:|:------:|:--:|
| SPA | — | HTTP | HTTP/SSE | — | HTTP opt | — | — | — | — |
| serve.mjs | serves | — | proxy | — | — | — | — | — | — |
| erp_bot | — | — | — | HTTP | subprocess | SQL opt | — | local | via backend |
| Express BE | — | — | spawn | — | — | SQL | TCP | — | — |
| backend/knowledge | — | mount | mount | embed | — | SQL | opt | local | S3 |

---

## Port Map

| Port | Service | Environment |
|------|---------|-------------|
| 3000 | Vite dev OR packages/backend OR serve.mjs (dev) | Local |
| 3001 | src/server.js | Local legacy |
| 5432 | PostgreSQL | docker-compose / Render |
| 6379 | Redis | docker-compose / Render |
| 8765 | erp_bot FastAPI | Local / GPU VPS |
| 10000 | serve.mjs (Render default) | Production |
| 11434 | Ollama | Local / GPU VPS |
