# 08 — Build & Deployment

**Project:** Sutra ERP  
**Generated:** 2026-07-10

---

## Build & Deploy Overview

| Artifact | Build Command | Deploy Target | Runtime |
|----------|---------------|---------------|---------|
| SPA (`dist/`) | `npm run build` | Render (primary), Vercel (secondary) | serve.mjs |
| erp_bot | Manual / separate VM | Co-located or remote AI server | uvicorn :8765 |
| packages/backend | `npm run build` (tsc) | Docker / Render (optional) | node :3000 |
| khata-app | `npm run build` in khata-app | Capacitor Android / PWA | Static + API |
| Chroma indexes | Python ingest scripts | Local disk on erp_bot host | Embedded |
| Nepal AI runtime maps | `nepal-ai:export` | Baked into SPA build | Static TS |

---

## BUILD-01: Root Frontend Build

| Field | Value |
|-------|-------|
| **Purpose** | Produce production SPA bundle |
| **Responsibilities** | Pre-build scripts; Vite bundle; chunk splitting |
| **Dependencies** | Node 20+, Python 3 (runtime maps), `vite.config.ts` |
| **Dependents** | serve.mjs, Render deploy |
| **Public API** | `npm run build` |
| **Internal API** | Vite plugins, manual chunks |
| **Entry Points** | `package.json` scripts |
| **Technology** | Vite 6, React 19, Tailwind 4 |
| **Complexity** | Medium |

### Build Pipeline

```
npm run build
  1. python3 erp_bot/scripts/export_nepal_ai_runtime_maps.py
     → src/lib/nepal-ai/generated/runtimeMaps.ts
  2. node scripts/build-falcon-page-index.mjs
     → src/lib/falcon/generatedPageIndex.ts
  3. NODE_OPTIONS=--max-old-space-size=6144 vite build
     → dist/
```

### Vite Configuration (`vite.config.ts`)

| Setting | Value |
|---------|-------|
| Output | `dist/` |
| Manual chunks | vendor-react, vendor-ui, vendor-query, ai, ekhata, falcon, nios |
| Build ID | `RENDER_GIT_COMMIT` or `GITHUB_SHA` |
| Dev server | Port 3000, strictPort |

### Pre-Build Scripts

| Script | Output |
|--------|--------|
| `export_nepal_ai_runtime_maps.py` | Nepal AI runtime maps TS |
| `build-falcon-page-index.mjs` | Falcon ERP page index |
| `build-conceptual-framework-knowledge.mjs` | CA knowledge JSON (optional) |

---

## BUILD-02: Development Workflow

| Field | Value |
|-------|-------|
| **Purpose** | Local development with HMR |
| **Responsibilities** | Fast iteration on SPA |
| **Dependencies** | Vite dev server |
| **Dependents** | Developers, Playwright |
| **Public API** | `npm run dev` |
| **Internal API** | Vite HMR |
| **Entry Points** | `vite dev` on :3000 |
| **Technology** | Vite 6 |
| **Complexity** | Low |

### Typical Local Stack

| Terminal | Command | Port |
|----------|---------|------|
| 1 | `npm run dev` | 3000 (Vite) |
| 2 | `erp_bot/scripts/start.py` | 8765 (erp_bot) |
| 3 | `ollama serve` | 11434 (Ollama) |
| 4 (optional) | `packages/backend npm run dev` | 3000 (conflicts — use different PORT) |
| 5 (optional) | `docker-compose up` | 5432 PG, 6379 Redis |

### Local Production Preview

```
npm run ui:render   # build + serve.mjs
npm run preview     # vite preview only
```

---

## BUILD-03: erp_bot Build & Start

| Field | Value |
|-------|-------|
| **Purpose** | AI backend runtime |
| **Responsibilities** | Install Python deps; start uvicorn; init Chroma/KB |
| **Dependencies** | Python 3.10+, `requirements.txt`, Ollama, GPU optional |
| **Dependents** | SPA proxy, khata-app NLU subprocess |
| **Public API** | `erp_bot/scripts/start.py` |
| **Internal API** | `config.py`, bootstrap hooks |
| **Entry Points** | `start.py`, `start_nios_api.sh`, `setup_local.sh` |
| **Technology** | FastAPI, uvicorn |
| **Complexity** | High |

### Setup Scripts

| Script | Purpose |
|--------|---------|
| `setup_local.sh` | Pull Ollama models, create venv |
| `start.py` | uvicorn with lifespan (knowledge worker) |
| `start_nios_api.sh` | NIOS-focused startup |
| `health_check.py` | Post-deploy verification |
| `rebuild_index.py` | Chroma codebase reindex |

### Python Dependencies (`erp_bot/requirements.txt`)

Key packages: fastapi, uvicorn, langchain, chromadb, httpx, aiosqlite, psycopg2-binary, rank-bm25, pydantic

---

## BUILD-04: packages/backend Build

| Field | Value |
|-------|-------|
| **Purpose** | Cloud sync/auth API |
| **Responsibilities** | TypeScript compile; PG migrate |
| **Dependencies** | Node 20+, PostgreSQL, Redis |
| **Dependents** | syncEngine, khata-app |
| **Public API** | `npm run dev`, `npm start` |
| **Internal API** | `db/migrate.js` |
| **Entry Points** | `src/server.ts` |
| **Technology** | Express 5, tsx/tsc |
| **Complexity** | Medium |

### Docker Compose (`docker-compose.yml`)

| Service | Image | Port |
|---------|-------|------|
| postgres | postgres:15 | 5432 |
| redis | redis:7-alpine | 6379 |
| backend | build packages/backend | 3000 |

---

## BUILD-05: khata-app Build

| Field | Value |
|-------|-------|
| **Purpose** | Mobile Khata PWA + Capacitor Android |
| **Responsibilities** | Vite build; Capacitor sync |
| **Dependencies** | packages/backend API |
| **Dependents** | Mobile users |
| **Public API** | `npm run build` in khata-app |
| **Internal API** | `capacitor.config.ts`, `public/sw.js` |
| **Entry Points** | `khata-app/src/main.tsx` |
| **Technology** | Vite, Capacitor, React |
| **Complexity** | Medium |

---

## DEPLOY-01: Render (Primary Production)

| Field | Value |
|-------|-------|
| **Purpose** | Host production SPA + edge proxy |
| **Responsibilities** | Build SPA; serve static; proxy erp_bot |
| **Dependencies** | `render.yaml`, `scripts/render-build.sh` |
| **Dependents** | End users |
| **Public API** | Web service on Render |
| **Internal API** | Render env vars |
| **Entry Points** | Git push to `main` → auto deploy |
| **Technology** | Render Node runtime |
| **Complexity** | Medium |

### render.yaml

```yaml
services:
  - type: web
    name: sutra-erp
    runtime: node
    branch: main
    buildCommand: bash scripts/render-build.sh
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      NODE_ENV: production
      NODE_OPTIONS: --max-old-space-size=6144
      PORT: 10000
      NODE_VERSION: "20"
```

### render-build.sh

1. `npm ci` or `npm install`
2. `npm run build` (includes Nepal AI export + Falcon index + Vite)
3. Output: `dist/` ready for serve.mjs

### Production Runtime (serve.mjs)

| Env Var | Purpose |
|---------|---------|
| `PORT` | Listen port (10000 on Render) |
| `ERP_BOT_BACKEND_URL` | Remote erp_bot base URL for `/erp-bot` proxy |
| `RENDER_GIT_COMMIT` | Build metadata in `/api/status` |
| `NODE_ENV` | production |

**Architecture:** SPA and erp_bot are typically **separate services** on Render; serve.mjs proxies AI calls to `ERP_BOT_BACKEND_URL`.

---

## DEPLOY-02: Vercel (Secondary)

| Field | Value |
|-------|-------|
| **Purpose** | Alternative SPA hosting |
| **Responsibilities** | Static deploy with SPA rewrites |
| **Dependencies** | `vercel.json` |
| **Dependents** | Optional frontend deploy |
| **Public API** | Vercel project |
| **Internal API** | `.github/workflows/frontend-deploy.yml` |
| **Entry Points** | GitHub Action or Vercel CLI |
| **Technology** | Vercel static |
| **Complexity** | Low |

### vercel.json

SPA rewrites to `index.html`; no erp_bot proxy (requires `VITE_ERP_BOT_URL` or external CORS).

---

## DEPLOY-03: erp_bot Deployment

| Field | Value |
|-------|-------|
| **Purpose** | Host AI backend with Ollama + Chroma |
| **Responsibilities** | GPU inference; persistent vector DB; knowledge worker |
| **Dependencies** | GPU VM, Ollama models, disk for Chroma/SQLite |
| **Dependents** | Production SPA via proxy |
| **Public API** | `:8765` HTTP |
| **Internal API** | `DEPLOYMENT.md` guide |
| **Entry Points** | `start.py`, systemd, Docker (manual) |
| **Technology** | Python, Ollama, Chroma |
| **Complexity** | High (ops) |

### erp_bot Deploy Considerations

| Resource | Requirement |
|----------|-------------|
| GPU | L4 24GB recommended for qwen3:32b Q4 |
| Disk | Chroma + SQLite + session files |
| Models | `qwen3:32b`, `qwen3:4b`, `nomic-embed-text` |
| Network | Exposed to Render via `ERP_BOT_BACKEND_URL` |
| CORS | `allow_origins=["*"]` on FastAPI |

---

## DEPLOY-04: CI/CD Pipelines

### `.github/workflows/test.yml`

| Step | Command |
|------|---------|
| Lint | `npm run lint` |
| Typecheck | `tsc --noEmit` |

### `.github/workflows/ekhata-ci.yml`

| Step | Scope |
|------|-------|
| Python tests | erp_bot pytest subset |
| TS tests | e-Khata test scripts |
| Playwright | `e2e/ekhata-panel.spec.ts` |

### `.github/workflows/render-deploy.yml`

Render deploy hook on push to main.

### `.github/workflows/frontend-deploy.yml`

Optional Vercel deploy.

---

## DEPLOY-05: Data & Index Deployment

| Asset | Build/Deploy | Location |
|-------|--------------|----------|
| Chroma erp_codebase | `ingestion/embedder` | `erp_bot/data/chroma_db` |
| Chroma nepal_knowledge | `ingest_nepal_*` scripts | same |
| Chroma nlu_knowledge | `ingest_nlu_knowledge_embeddings.py` | same |
| BM25 index | hybrid_rag build | `erp_bot/data/bm25_index.pkl` |
| Nepal AI runtime maps | export script | baked in SPA |
| Falcon page index | build script | baked in SPA |
| Tenant documents | runtime upload | R2 + Chroma tenant_documents |

---

## Deployment Topology

```
                    ┌─────────────────────┐
                    │   Render Web (SPA)   │
                    │   serve.mjs :10000   │
                    │   dist/ static       │
                    └──────────┬──────────┘
                               │ /erp-bot/*
                               ▼
                    ┌─────────────────────┐
                    │  erp_bot VM/GPU      │
                    │  uvicorn :8765       │
                    │  Ollama :11434       │
                    │  Chroma + SQLite     │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │ PostgreSQL   │  │ Cloudflare  │  │ packages/   │
     │ (knowledge,  │  │ R2          │  │ backend     │
     │  NIOS PG)    │  │ (documents) │  │ (optional)  │
     └─────────────┘  └─────────────┘  └─────────────┘
```

---

## Environment-Specific Behavior

| Environment | SPA API | AI Backend | Cloud Sync |
|-------------|---------|------------|------------|
| Local dev | Vite :3000 | localhost:8765 direct or /erp-bot | Optional localhost:3000 |
| Render prod | Same-origin /erp-bot | ERP_BOT_BACKEND_URL | VITE_API_URL if configured |
| Playwright CI | VITE_SELF_CONTAINED_AI=true | No erp_bot required | Disabled |
| khata-app | VITE_API_BASE | Subprocess NLU or remote | packages/backend |

---

## Build Artifacts

| Path | Produced By | Deployed |
|------|-------------|----------|
| `dist/` | Vite build | Render serve.mjs |
| `dist/assets/*.js` | Code splitting | CDN via Render |
| `src/lib/nepal-ai/generated/runtimeMaps.ts` | Python export | Compiled into dist |
| `src/lib/falcon/generatedPageIndex.ts` | Node script | Compiled into dist |
| `erp_bot/data/chroma_db/` | Ingest scripts | Copied to AI server |
| `packages/backend/dist/` | tsc (if used) | Node runtime |

---

## Operational Scripts

| Script | Purpose |
|--------|---------|
| `scripts/render-build.sh` | Render CI build |
| `erp_bot/scripts/nios_nightly.sh` | NIOS benchmark nightly |
| `erp_bot/scripts/nios_verify_prod.py` | Production smoke test |
| `erp_bot/scripts/health_check.py` | Health verification |
| `LAUNCH_CHECKLIST.md` | Mobile Khata launch steps |
| `DEPLOYMENT.md` | erp_bot deploy guide |
