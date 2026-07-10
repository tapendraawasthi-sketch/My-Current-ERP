# 07 — API Inventory

**Project:** Sutra ERP  
**Generated:** 2026-07-10

---

## API Architecture Overview

| Surface | Base URL | Protocol | Auth | Owner |
|---------|----------|----------|------|-------|
| Production SPA + proxy | `https://<render-host>/` | HTTP | None | serve.mjs |
| erp_bot (proxied) | `/erp-bot/*` → `:8765` | HTTP/SSE | Session/tenant IDs | erp_bot |
| erp_bot (direct dev) | `http://localhost:8765` | HTTP/SSE | Session/tenant IDs | erp_bot |
| packages/backend | `http://localhost:3000/api` | HTTP REST | JWT (protected routes) | packages/backend |
| backend/knowledge | `/knowledge/v1/*` (mounted on erp_bot) | HTTP REST | Tenant UUID in params | backend |
| backend/storage | `/storage/health` (mounted on erp_bot) | HTTP | None | backend |
| Legacy Node ERP | `http://localhost:3001/api` | HTTP REST | None | src/server.js |
| Ollama | `http://localhost:11434` | HTTP | None | Ollama runtime |
| Cloudflare R2 | S3 API endpoint | HTTPS | Access keys | backend/storage |

---

## API-01: serve.mjs (Edge)

| Field | Value |
|-------|-------|
| **Purpose** | Production HTTP entry for SPA and erp_bot reverse proxy |
| **Responsibilities** | Static assets; SPA fallback; proxy AI backend; health endpoints |
| **Dependencies** | `dist/`, `ERP_BOT_BACKEND_URL` |
| **Dependents** | Browser clients in production |
| **Public API** | See route table below |
| **Internal API** | `handleErpBotRequest`, `readRequestBody`, MIME map |
| **Entry Points** | `npm start` |
| **Technology** | Node.js `http` |
| **Complexity** | Medium |

### Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health`, `/ping`, `/_health` | Liveness |
| GET | `/api/status` | Build commit, erp_bot reachability |
| GET | `/*` | Static `dist/` or SPA `index.html` |
| ALL | `/erp-bot/*` | Reverse proxy to `ERP_BOT_BACKEND_URL` |

---

## API-02: erp_bot Main Server (`erp_bot/src/api/server.py`)

| Field | Value |
|-------|-------|
| **Purpose** | Unified FastAPI application for all AI/intelligence endpoints |
| **Responsibilities** | Mount NIOS, Orbix, knowledge, storage routers; legacy chat/khata/v2 |
| **Dependencies** | Ollama, Chroma, SQLite, optional backend mount, optional PG |
| **Dependents** | SPA, khata-app (subprocess), eval scripts |
| **Public API** | Routes below + mounted sub-routers |
| **Internal API** | `get_kernel`, `get_gateway`, `get_engine`, cache, streaming |
| **Entry Points** | `erp_bot/scripts/start.py`, uvicorn |
| **Technology** | FastAPI, Python 3.10+ |
| **Complexity** | Very High |

### Core Routes (`/`)

| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| GET | `/health` | — | Health JSON | None |
| GET | `/status` | — | Model/status JSON | None |
| POST | `/chat` | `ChatRequest` | `ChatResponse` | session_id |
| POST | `/chat/stream` | `ChatRequest` | SSE stream | session_id |
| POST | `/orbix/chat/stream` | `ChatRequest` | SSE stream | session_id |
| DELETE | `/chat/session/{session_id}` | — | OK | session_id |
| GET | `/chat/session/{session_id}/history` | — | History | session_id |
| POST | `/classify` | text + context | Intent JSON | None |
| POST | `/khata/chat` | Khata message | `KhataChatResponse` | session_id |
| POST | `/khata/clear_session` | session_id | OK | session_id |
| POST | `/khata/parse` | text | Parsed entry | None |
| POST | `/khata/validate` | journal | Validation result | None |
| POST | `/khata/feedback` | feedback payload | OK | None |
| POST | `/khata/feedback/bulk` | array | OK | None |
| GET | `/khata/training/stats` | — | Stats | None |
| POST | `/v2/chat` | V2 request | `V2ChatResponse` | session_id |
| DELETE | `/v2/session/{session_id}` | — | OK | session_id |
| POST | `/clear_session` | session_id | OK | session_id |
| POST | `/reindex` | — | Reindex status | None |
| GET | `/knowledge/nepal/stats` | — | KB stats | None |
| POST | `/knowledge/nepal/reindex` | — | OK | None |
| POST | `/knowledge/nepal/search` | query | Results | None |
| GET | `/cache/stats` | — | Cache metrics | None |
| POST | `/cache/clear` | — | OK | None |
| GET | `/performance` | — | Perf metrics | None |

### Mounted Sub-Routers

| Prefix | Module | Description |
|--------|--------|-------------|
| `/nios/v1` | `nios/api.py` | NIOS platform (see API-03) |
| `/orbix/v2` | `orbix/api.py` | Orbix v2 agent (see API-04) |
| `/v2` (stream) | `api/streaming.py` | `POST /v2/chat/stream` SSE |
| `/knowledge/v1` | `backend/knowledge/api.py` | Tenant documents (see API-06) |
| `/storage` | `backend/api/health_routes.py` | Storage health (see API-07) |

---

## API-03: NIOS v1 (`/nios/v1` — `erp_bot/src/nios/api.py`)

| Field | Value |
|-------|-------|
| **Purpose** | Nepal Intelligence Operating System REST surface |
| **Responsibilities** | Chat, simulation, federation, governance, domain plugins |
| **Dependencies** | NiosKernel, NiosGateway, Ollama, Chroma, SQLite/PG |
| **Dependents** | `niosClient`, `erpBotClient` (when flag on) |
| **Public API** | 40+ endpoints below |
| **Internal API** | `get_gateway()`, `get_kernel()` |
| **Entry Points** | `POST /nios/v1/chat` |
| **Technology** | FastAPI router |
| **Complexity** | Very High |

### NIOS Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/status` | Platform status |
| GET | `/capabilities` | Capability catalog |
| POST | `/chat` | Primary chat (JSON) |
| POST | `/chat/stream` | Primary chat (SSE) |
| POST | `/simulate` | Financial simulation |
| POST | `/scenario` | Scenario analysis |
| GET | `/skills` | Skill registry |
| GET | `/world-state/domains` | World state domains |
| POST | `/world-state/query` | Query world state |
| POST | `/digital-twin` | Digital twin snapshot |
| POST | `/predict` | Predictive query |
| POST | `/ontology/query` | Ontology query |
| POST | `/federation/query` | Multi-source knowledge |
| GET | `/tasks` | Active tasks |
| POST | `/tasks/monitor` | Task monitoring |
| POST | `/events/invoice-created` | Invoice event ingest |
| POST | `/events/voucher-posted` | Voucher event ingest |
| GET | `/governance/status` | Governance state |
| GET | `/governance/audit` | Audit log |
| GET | `/governance/approvals` | Pending approvals |
| POST | `/governance/approvals/{id}/decide` | Approve/reject |
| GET | `/evolution/adapters` | Evolution adapters |
| POST | `/benchmarks/nightly/run` | Run benchmarks |
| GET | `/benchmarks/nightly/latest` | Latest benchmark |
| GET | `/quality-gates` | Quality gate status |
| GET | `/architecture/score` | Architecture score |
| POST | `/feeds/refresh` | Refresh external feeds |
| GET | `/feeds/export/nepse` | NEPSE feed export |
| GET | `/feeds/export/gov` | Government feed export |
| GET | `/telemetry/stats` | Telemetry |
| POST | `/compile/uil` | UIL compiler |
| POST | `/capabilities/{cap_id}/run` | Run capability |
| GET | `/memory/stats` | Memory bus stats |
| GET | `/plugins` | Plugin list |
| POST | `/optimize` | Optimization engine |
| GET | `/evidence/session/{session_id}` | Evidence bundle |
| POST | `/ocr/invoice` | Invoice OCR (text) |
| POST | `/ocr/invoice/image` | Invoice OCR (image) |
| GET | `/public/v1` | Public API manifest |
| POST | `/legal/search` | Legal domain search |
| POST | `/investment/dcf` | DCF calculator |
| GET | `/investment/nepse` | NEPSE data |
| POST | `/consultant/compose` | Consultant report |
| GET | `/simulation/domains` | Simulation domains |
| POST | `/simulation/universal` | Universal simulation |
| POST | `/learning/automate` | Learning automation |
| GET | `/marketplace/catalog` | Marketplace catalog |

---

## API-04: Orbix v2 (`/orbix/v2` — `erp_bot/src/orbix/api.py`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/status` | Engine status |
| POST | `/chat` | Agent chat (JSON) |
| POST | `/chat/stream` | Agent chat (SSE) |
| POST | `/reindex` | Reindex code tools |
| POST | `/memory/forget` | Clear session memory |

---

## API-05: packages/backend Express (`/api`)

| Field | Value |
|-------|-------|
| **Purpose** | Cloud auth, sync, messaging, mobile Khata REST |
| **Responsibilities** | JWT sessions; incremental sync; khata transaction lifecycle |
| **Dependencies** | PostgreSQL, Redis, optional Python NLU subprocess |
| **Dependents** | `syncEngine.ts`, khata-app |
| **Public API** | Routes below |
| **Internal API** | `syncHandlers`, `syncPull`, `falconNlu`, middleware |
| **Entry Points** | `packages/backend/src/server.ts` |
| **Technology** | Express 5, TypeScript |
| **Complexity** | High |

### Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Health check |
| POST | `/api/auth/login` | No | Email/password → JWT |
| POST | `/api/auth/refresh` | No | Refresh token rotation |
| POST | `/api/auth/logout` | JWT | Revoke session |
| GET | `/api/sync/pull` | JWT | Incremental pull since timestamp |
| POST | `/api/sync/push` | JWT | Batch upsert records |
| POST | `/api/messaging/email` | JWT | Send email |
| POST | `/api/messaging/sms` | JWT | Send SMS |
| POST | `/api/khata/transaction` | No* | Parse NLU → draft voucher |
| POST | `/api/khata/confirm` | No* | Confirm and post voucher |
| GET | `/api/khata/balance` | No* | Party balance |
| GET | `/api/khata/insights` | No* | Business insights |
| POST | `/api/khata/payment-webhook` | Webhook secret | Payment provider callback |

\* Tenant/user IDs in request body, not JWT.

---

## API-06: backend/knowledge (`/knowledge/v1`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/documents` | Upload document for ingestion |
| GET | `/documents/{document_id}` | Document status |
| GET | `/documents` | List documents (tenant filter) |
| POST | `/search` | Semantic search tenant docs |
| GET | `/health` | Pipeline health |

---

## API-07: backend/storage (`/storage`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | R2 connectivity check |

---

## API-08: Legacy Node ERP (`src/server.js` — `:3001`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health |
| Various | `/api/company/*` | Company CRUD |
| Various | `/api/fiscal-year/*` | Fiscal year management |
| Various | `/api/backup/*` | Backup/restore |
| Various | `/api/audit/*` | Audit log |

**Note:** Parallel to packages/backend; SPA auth is Dexie-primary; usage by SPA is limited.

---

## API-09: Frontend Client APIs (TypeScript modules)

These are not HTTP servers but programmatic APIs consumed across the SPA.

| Module | Key Functions | HTTP Target |
|--------|---------------|-------------|
| `lib/erpBotClient.ts` | `askErpBot`, `askErpBotStream`, `classifyIntent` | `/erp-bot` or `VITE_ERP_BOT_URL` |
| `nios/client/niosClient.ts` | `niosChat`, `niosSimulate`, `niosFederationQuery` | `/erp-bot/nios/v1` |
| `lib/syncEngine.ts` | `pullChanges`, `pushChanges`, `startSyncLoop` | `VITE_API_URL/api/sync` |
| `lib/messagingService.ts` | `sendEmail`, `sendSms` | `VITE_API_URL/api/messaging` |
| `lib/ekhata/orbixQwenClient.ts` | `streamOrbixQwen` | `/erp-bot/chat/stream` or v2 |
| `khata-app/api/khataApi.ts` | `postTransaction`, `confirmEntry` | `VITE_API_BASE/api/khata` |
| `ai/index.ts` | `IntelligenceCore`, RAG handlers | Local Dexie + optional Ollama |
| `lib/accounting.ts` | `validateDoubleEntry`, `computeTrialBalance` | Pure client |
| `lib/db.ts` | `openDB`, `getDB` | IndexedDB |

---

## API-10: Ollama REST (External)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/chat` | LLM chat completion |
| POST | `/api/generate` | Text generation |
| POST | `/api/embeddings` | Vector embeddings |
| GET | `/api/tags` | List models |

**Config:** `OLLAMA_BASE_URL` (default `http://localhost:11434`)

---

## API-11: Cloudflare R2 (S3-compatible)

| Operation | SDK Method | Purpose |
|-----------|------------|---------|
| PutObject | `upload_file` | Store original + extracted docs |
| GetObject | `download_bytes` | Retrieve for processing |
| DeleteObject | `delete_file` | Remove document |
| ListObjectsV2 | `list_objects` | Enumerate tenant prefix |
| HeadObject | `file_exists` | Existence check |

**Config:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

---

## API Request/Response Patterns

### Session Identification (erp_bot)

| Header/Field | Used By |
|--------------|---------|
| `session_id` in JSON body | `/chat`, `/khata/*`, `/v2/*` |
| `tenant_id`, `company_id` | NIOS, knowledge, federation |
| `erp_context` snapshot | Agent, conversation manager |

### Auth (packages/backend)

| Mechanism | Detail |
|-----------|--------|
| Access token | JWT in `Authorization: Bearer` |
| Refresh token | HTTP-only cookie or body |
| Session store | Redis `session:{userId}` |
| Rate limit | Redis `ratelimit:{userId\|ip}` — 100/min |

### Streaming (SSE)

| Endpoint | Event Format |
|----------|--------------|
| `/chat/stream` | `data: {chunk, done}` |
| `/nios/v1/chat/stream` | NIOS stream events |
| `/orbix/v2/chat/stream` | Tool step + answer chunks |
| `/v2/chat/stream` | Conversation manager SSE |

---

## API Dependency Graph

```
Browser
  ├─► serve.mjs (/health, static, /erp-bot/*)
  │     └─► erp_bot :8765
  │           ├─► Ollama :11434
  │           ├─► ChromaDB (local)
  │           ├─► SQLite (NIOS, Orbix)
  │           ├─► PostgreSQL (optional: NIOS memory, knowledge)
  │           └─► R2 (via backend.storage)
  │
  ├─► packages/backend :3000/api (sync, auth, khata)
  │     ├─► PostgreSQL
  │     ├─► Redis
  │     └─► Python subprocess (falconNlu)
  │
  └─► IndexedDB (Dexie) — no HTTP
```

---

## API Versioning

| API | Version Strategy |
|-----|------------------|
| NIOS | `/nios/v1` path prefix |
| Orbix | `/orbix/v2` path prefix |
| e-Khata conversation | `/v2/chat` (v2 of khata chat) |
| Knowledge | `/knowledge/v1` path prefix |
| packages/backend | Unversioned `/api` |
| Legacy chat | Unversioned `/chat` |
