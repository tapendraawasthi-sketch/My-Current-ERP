# 10 — Architecture Summary

**Project:** Sutra ERP (BUSY ERP)  
**Generated:** 2026-07-10  
**Repository:** `/home/tapendraawasthi/My-Current-ERP`

---

## Executive Summary

Sutra ERP is an **offline-first Nepali accounting monorepo** combining a browser-based ERP (React/Vite + Dexie IndexedDB), a Python AI intelligence platform (erp_bot with Ollama + ChromaDB), a cloud sync API (Express + PostgreSQL + Redis), tenant document storage (Cloudflare R2), and a mobile Khata PWA (Capacitor). The system targets professional accounting workflows (Busy Cloud / Tally Cloud style) with deep Nepali language support and four generations of AI assistant stacks converging on **NIOS v3** as the canonical intelligence path when `VITE_NIOS_PLATFORM_V3=true`.

**Scale:** ~1,437 source files across 7 code packages.

---

## System Context

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         USERS & CLIENTS                                   │
│  Accountants (browser SPA) │ Shopkeepers (khata-app) │ Developers (E2E)   │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────────┐
│                    PRESENTATION & EDGE                                    │
│  src/ (React SPA) │ serve.mjs (Render) │ khata-app (Capacitor PWA)      │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ CLIENT STATE  │     │  AI BACKEND      │     │  CLOUD API       │
│ Zustand store │     │  erp_bot :8765   │     │  packages/backend│
│ Dexie IDB     │     │  Ollama + Chroma │     │  PG + Redis      │
└───────────────┘     └────────┬────────┘     └─────────────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              ┌─────────┐ ┌────────┐ ┌─────────┐
              │ SQLite  │ │   R2   │ │PostgreSQL│
              │ (NIOS)  │ │(docs)  │ │(cloud)   │
              └─────────┘ └────────┘ └─────────┘
```

---

## Architectural Layers

| Layer | Components | Technology |
|-------|------------|------------|
| **L0 Clients** | Browser SPA, khata-app, Playwright | React 19, Capacitor |
| **L1 Presentation** | 214 pages, 175 components, App.tsx router | Tailwind 4, Radix UI |
| **L2 Application State** | Zustand monolith + AI stores | Zustand 5 |
| **L3 Domain Logic** | accounting.ts, *Engine.ts, AI brains | TypeScript |
| **L4 Client Persistence** | Dexie v22 (70+ tables), SutraAiDexie | IndexedDB |
| **L5 Edge** | serve.mjs proxy, legacy src/server.js | Node.js |
| **L6 AI Services** | erp_bot FastAPI, Ollama, Chroma | Python, FastAPI |
| **L7 Cloud Services** | packages/backend, backend/knowledge | Express, PostgreSQL |
| **L8 Object Storage** | Cloudflare R2 | S3 API |

---

## Core Subsystems

| ID | Subsystem | Package | Role |
|----|-----------|---------|------|
| SS-01 | ERP Core | `src/store`, `src/lib/accounting.ts`, `src/pages` | Vouchers, invoices, masters, reports |
| SS-02 | Client DB | `src/lib/db.ts` | Offline-first IndexedDB |
| SS-03 | SUTRA AI | `src/ai/` | Rule+RAG+LLM ERP assistant |
| SS-04 | Falcon | `src/lib/falcon/`, `erp_bot/agent/` | ERP help & navigation |
| SS-05 | e-Khata/Orbix | `src/lib/ekhata/`, `erp_bot/khata/`, `nlu/` | Nepali accounting chat |
| SS-06 | NIOS v3 | `erp_bot/nios/`, `src/nios/` | Unified intelligence platform |
| SS-07 | Orbix v2 | `erp_bot/orbix/` | Plan→tool→verify agent |
| SS-08 | RAG/Knowledge | `erp_bot/knowledge/`, `backend/knowledge/` | Retrieval + tenant docs |
| SS-09 | Cloud Sync | `packages/backend/`, `src/lib/syncEngine.ts` | Dexie ↔ PostgreSQL |
| SS-10 | Mobile Khata | `khata-app/` | Chat-first ledger PWA |
| SS-11 | Production Edge | `serve.mjs` | Static + AI proxy |

---

## Data Flow Patterns

### Offline ERP Transaction

```
User → Page/Form → useStore → accounting.validateDoubleEntry → Dexie → optional syncOutbox → cloud push
```

### AI Chat (NIOS path)

```
User → NiosProvider → niosClient → /erp-bot/nios/v1/chat → NiosGateway → Ollama + RAG → SSE/JSON
```

### Mobile Khata Entry

```
User → ChatWindow → khataApi.transaction → packages/backend → falconNlu subprocess → PG voucher draft → confirm → post
```

### Tenant Document Ingestion

```
Upload → /knowledge/v1/documents → R2 store → worker thread → extract → chunk → embed → Chroma → PG metadata
```

---

## Technology Stack

| Tier | Technologies |
|------|-------------|
| Frontend | React 19, Vite 6, TypeScript 5, Tailwind 4, Radix UI, Zustand, Dexie 4, TanStack Query |
| AI Backend | Python 3.10+, FastAPI, LangChain, ChromaDB, httpx, aiosqlite |
| LLM | Ollama (qwen3:32b, qwen3:4b, nomic-embed-text) |
| Cloud API | Express 5, pg, ioredis, bcrypt, JWT |
| Databases | IndexedDB, PostgreSQL 15, Redis 7, SQLite 3, ChromaDB |
| Storage | Cloudflare R2 (S3-compatible) |
| Mobile | Capacitor, Service Worker |
| CI | GitHub Actions, Playwright, pytest |
| Deploy | Render (primary), Vercel (secondary), Docker Compose (local) |

---

## Integration Points

| Integration | Protocol | Direction |
|-------------|----------|-----------|
| SPA ↔ erp_bot | HTTP/SSE via `/erp-bot` proxy | Bidirectional |
| SPA ↔ packages/backend | REST + JWT | Bidirectional (sync) |
| erp_bot ↔ Ollama | HTTP REST | Request/response + stream |
| erp_bot ↔ Chroma | Embedded Python client | Read/write vectors |
| erp_bot ↔ backend | FastAPI mount (conditional) | Internal |
| backend ↔ R2 | S3 API (boto3) | Read/write objects |
| backend ↔ PostgreSQL | psycopg2 | Metadata CRUD |
| khata-app ↔ packages/backend | REST | Mobile → cloud |
| packages/backend ↔ erp_bot | Python subprocess (NLU) | Spawn per request |
| NIOS ↔ external feeds | HTTP (NEPSE, gov) | Pull |

---

## AI Stack Evolution

| Generation | Client | Server | Status |
|------------|--------|--------|--------|
| Gen 1 | SUTRA AI (`src/ai/`) | Ollama local | Active (hidden when NIOS on) |
| Gen 2 | Falcon (`src/lib/falcon/`) | agent_builder | Active (hidden when NIOS on) |
| Gen 3 | e-Khata (`src/lib/ekhata/`) | conversation manager | Active (hidden when NIOS on) |
| Gen 4 | NIOS (`src/nios/`) | NiosGateway | **Canonical** when flag on |
| Parallel | Orbix v2 UI | OrbixAgentEngine | Independent path |

**Gating:** `VITE_NIOS_PLATFORM_V3` controls client UI; `NIOS_PLATFORM_V3` controls server kernel.

---

## Deployment Model

| Component | Primary Host | Notes |
|-----------|-------------|-------|
| SPA | Render (serve.mjs) | Auto-deploy from `main` |
| erp_bot | Separate GPU VM | Proxied via `ERP_BOT_BACKEND_URL` |
| packages/backend | Docker / optional Render | Not in default `npm start` |
| Ollama | Co-located with erp_bot | Requires GPU for 32B model |
| PostgreSQL | Render / Docker | Cloud data + knowledge metadata |
| Redis | Render / Docker | Sessions + rate limit |
| R2 | Cloudflare | Tenant documents |

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| SPA auth | Dexie users table + local password hash |
| Cloud auth | JWT access + refresh tokens, Redis sessions |
| erp_bot | No JWT; session_id + tenant_id in body; CORS `*` |
| Khata API | Tenant UUID in body (no JWT on khata routes) |
| Payment webhook | `PAYMENT_WEBHOOK_SECRET` |
| R2 | Server-side credentials only |
| Immutable ledgers | PG triggers on `ledger_postings`, `inventory_postings`, `audit_logs` |

---

## Routing Model

**No React Router.** Navigation via Zustand `currentPage` string switch in `App.tsx` (~100 routes). Sidebar, BusyMenuBar, and TopMenuBar provide navigation chrome. ~107 page files exist but are unwired (fallback to FinancialDashboard).

---

## Key Entry Points

| Entry | Path | Role |
|-------|------|------|
| SPA bootstrap | `src/main.tsx` | React mount |
| App router | `src/App.tsx` | Auth gate + page switch |
| State hub | `src/store/index.ts` | Monolithic Zustand (~2300 lines) |
| Accounting | `src/lib/accounting.ts` | Double-entry validation |
| Persistence | `src/lib/db.ts` | Dexie schema v22 |
| AI backend | `erp_bot/src/api/server.py` | FastAPI app |
| NIOS gateway | `erp_bot/src/nios/gateway.py` | Intelligence pipeline |
| Production | `serve.mjs` | Edge server |
| Cloud API | `packages/backend/src/server.ts` | Express |

---

## Document Cross-Reference

| Document | Contents |
|----------|----------|
| [01_REPOSITORY_MAP.md](./01_REPOSITORY_MAP.md) | Directory tree, package roles |
| [02_DEPENDENCY_GRAPH.md](./02_DEPENDENCY_GRAPH.md) | Inter-package dependencies |
| [03_MODULE_INVENTORY.md](./03_MODULE_INVENTORY.md) | Per-module purpose, APIs, complexity |
| [04_SERVICE_INVENTORY.md](./04_SERVICE_INVENTORY.md) | Runtime services and ports |
| [05_AI_SYSTEM_INVENTORY.md](./05_AI_SYSTEM_INVENTORY.md) | AI stacks, models, RAG |
| [06_DATABASE_INVENTORY.md](./06_DATABASE_INVENTORY.md) | All storage layers |
| [07_API_INVENTORY.md](./07_API_INVENTORY.md) | HTTP endpoints |
| [08_BUILD_DEPLOYMENT.md](./08_BUILD_DEPLOYMENT.md) | Build pipeline, CI/CD |
| [09_CONFIGURATION_INVENTORY.md](./09_CONFIGURATION_INVENTORY.md) | Env vars, feature flags |
| [Repository_Intelligence.md](./Repository_Intelligence.md) | Extended analysis reference |

---

## Subsystem Complexity Summary

| Subsystem | Complexity | File Count |
|-----------|------------|------------|
| ERP UI (pages + components) | Very High | ~389 |
| Zustand store | Very High | 17 |
| SUTRA AI | Very High | 134 |
| e-Khata client | Very High | ~40 |
| NIOS platform | Very High | 112 (server) + 18 (client) |
| erp_bot conversation | Very High | 4 |
| Khata NLU | Very High | 11 + 11 |
| Dexie schema | Very High | 1 (70+ tables) |
| packages/backend | High | 16 |
| backend/knowledge | High | 22 |
| Falcon | High | ~30 client + 15 server |
| Orbix v2 | High | 21 |
| serve.mjs | Medium | 1 |
| khata-app | Medium | 31 |

---

## Architectural Characteristics

| Characteristic | Description |
|----------------|-------------|
| **Offline-first** | Dexie is primary write path; cloud sync is optional |
| **Monolithic client state** | Single Zustand store coordinates all ERP domains |
| **Multi-stack AI** | Four client AI UIs with feature-flag convergence |
| **Polyglot persistence** | IndexedDB + PG + SQLite + Chroma + R2 coexist |
| **Proxy-based AI** | Production uses same-origin `/erp-bot` proxy |
| **No shared DB client/server** | HTTP + session IDs bridge client and AI server |
| **Dense ERP surface** | 214 page files, ~100 wired routes |
| **Nepali language depth** | Static lexicons, runtime maps, bilingual NLU |

---

## Environment Dependencies

| Dependency | Required For |
|------------|-------------|
| Node 20+ | SPA build, serve.mjs, packages/backend |
| Python 3.10+ | erp_bot, backend, build scripts |
| Ollama + models | All server AI features |
| GPU (recommended) | qwen3:32b inference |
| PostgreSQL 15 | Cloud sync, knowledge metadata |
| Redis 7 | packages/backend sessions |
| Cloudflare R2 | Tenant document storage |
| Render account | Primary production deploy |

---

## Glossary

| Term | Meaning |
|------|---------|
| **SUTRA** | In-ERP AI assistant (rule + RAG + LLM) |
| **Falcon** | ERP help/navigation assistant |
| **e-Khata** | Nepali conversational accounting entry |
| **Orbix** | Brand used for e-Khata streaming + v2 agent |
| **NIOS** | Nepal Intelligence Operating System (v3 platform) |
| **Khata** | Informal ledger / udhaar bookkeeping |
| **Dexie** | IndexedDB wrapper for browser persistence |
| **Chroma** | Local vector database for RAG |
| **R2** | Cloudflare object storage |
