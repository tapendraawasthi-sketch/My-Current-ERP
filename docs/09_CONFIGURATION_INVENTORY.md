# 09 — Configuration Inventory

**Project:** Sutra ERP  
**Generated:** 2026-07-10

---

## Configuration Architecture

| Source | Scope | Precedence |
|--------|-------|------------|
| `.env` / `.env.local` | Root SPA (Vite) | Build-time (`import.meta.env`) |
| `erp_bot/.env` | Python AI backend | Runtime `os.environ` |
| `packages/backend/.env` | Express API | Runtime `process.env` |
| `khata-app/.env` | Mobile Khata | Build-time |
| `render.yaml` | Render deploy | Platform env |
| `docker-compose.yml` | Local infra | Container env |
| `vite.config.ts` | Build | Hardcoded + env |
| `erp_bot/src/config.py` | erp_bot defaults | Env with fallbacks |
| `backend/config/` | R2 storage | Env singleton |
| `src/styles.css` | Design tokens | CSS variables |
| `playwright.config.ts` | E2E | Test env overrides |

---

## CFG-01: Root Frontend (Vite)

**Files:** `.env.example`, `.env`, `.env.local`  
**Loaded by:** Vite at build/dev time via `import.meta.env`

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `VITE_ERP_BOT_URL` | Direct erp_bot URL (bypass proxy) | empty (use `/erp-bot`) | No |
| `VITE_NIOS_PLATFORM_V3` | Enable NIOS v3; hide legacy AI UIs | `true` in example | No |
| `VITE_SELF_CONTAINED_AI` | Force offline template brain only | unset | No |
| `VITE_API_URL` | packages/backend base URL | unset | For sync |
| `VITE_PUBLIC_API_URL` | Public API URL (sync, messaging) | unset | For sync |
| `VITE_BRAVE_SEARCH_KEY` | Brave web search for Falcon | unset | No |
| `VITE_APP_VERSION` | App version display | from build | No |
| `VITE_APP_NAME` | App name | Sutra ERP | No |

### Feature Flag Behavior

| Flag | When true | Effect |
|------|-----------|--------|
| `VITE_NIOS_PLATFORM_V3` | NIOS mode | NiosProvider active; SUTRA/Falcon/e-Khata panels hidden; erpBotClient routes to `/nios/v1` |
| `VITE_SELF_CONTAINED_AI` | Emergency offline | e-Khata uses template brain only; no erp_bot calls |

---

## CFG-02: serve.mjs (Production Edge)

**Loaded by:** `process.env` at runtime

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | HTTP listen port | `3000` (Render: `10000`) |
| `ERP_BOT_BACKEND_URL` | erp_bot proxy target | empty (proxy disabled) |
| `NODE_ENV` | Environment | `production` on Render |
| `NODE_OPTIONS` | Node heap | `--max-old-space-size=6144` |
| `RENDER_GIT_COMMIT` | Build commit in status | `unknown` |
| `GITHUB_SHA` | Alt commit source | — |

---

## CFG-03: erp_bot (`erp_bot/.env.example`)

**Loaded by:** `erp_bot/src/config.py`, direct `os.environ`

### LLM Models

| Variable | Purpose | Default |
|----------|---------|---------|
| `OLLAMA_BASE_URL` | Ollama endpoint | `http://localhost:11434` |
| `CONVERSATIONAL_MODEL` | Primary chat model | `qwen3:32b` |
| `FAST_MODEL_NAME` | Router/classifier model | `qwen3:4b` |
| `EMBED_MODEL` | Embedding model | `nomic-embed-text` |
| `MODEL_NAME` | Legacy alias | `qwen3:32b` |
| `DEEP_MODEL_NAME` | Legacy alias | `qwen3:32b` |

### Generation Parameters

| Variable | Purpose | Default |
|----------|---------|---------|
| `CONTEXT_SIZE` | Token context window | `8192` |
| `TEMPERATURE` | Sampling temperature | `0.7` |
| `TOP_P` | Nucleus sampling | `0.9` |
| `REPEAT_PENALTY` | Repetition penalty | `1.1` |
| `MAX_CONVERSATION_TURNS` | Session memory depth | `10` |

### API & Paths

| Variable | Purpose | Default |
|----------|---------|---------|
| `API_PORT` | uvicorn port | `8765` |
| `ERP_PATH` | ERP source path for ingestion | empty |
| `CHROMA_PATH` | Chroma persist directory | `data/chroma_db` |

### Khata / NLU

| Variable | Purpose | Default |
|----------|---------|---------|
| `KHATA_USE_STRUCTURED_PARSE` | LLM JSON fallback | `true` |
| `KHATA_SYNTHESIZE_CONTEXT` | Context synthesis | `true` |
| `NLU_REGEX_THRESHOLD` | Regex confidence cutoff | `0.85` |

### Orbix v2

| Variable | Purpose | Default |
|----------|---------|---------|
| `ORBIX_AGENT_MODEL` | Planner model | `qwen3:32b` |
| `ORBIX_VERIFIER_MODEL` | Verifier model | `qwen3:32b` |
| `ORBIX_ROUTER_MODEL` | Router model | `qwen3:4b` |
| `ORBIX_EMBED_MODEL` | Embed model | `nomic-embed-text` |
| `ORBIX_MAX_TOOL_STEPS` | Max agent tool iterations | `8` |
| `ORBIX_MEMORY_DB` | SQLite memory path | `data/orbix_memory.sqlite3` |

### Performance

| Variable | Purpose | Default |
|----------|---------|---------|
| `OLLAMA_KEEP_ALIVE` | Model VRAM retention | `10m` |
| `OLLAMA_NUM_PARALLEL` | Concurrent Ollama requests | `2` |
| `CACHE_ENABLED` | Response cache | `true` |
| `CACHE_TTL_SECONDS` | Cache TTL | `3600` |
| `CACHE_MAX_SIZE` | Cache entries | `500` |
| `STREAMING_CHUNK_SIZE` | SSE chunk size | `10` |

### NIOS v3

| Variable | Purpose | Default |
|----------|---------|---------|
| `NIOS_PLATFORM_V3` | Enable NIOS kernel | `true` |
| `NIOS_MEMORY_BACKEND` | `sqlite` or `postgres` | `sqlite` |
| `NIOS_PG_URL` | PostgreSQL for memory bus | unset |
| `NIOS_DATA_DIR` | NIOS data directory | `data` |
| `NIOS_NEPSE_FEED_URL` | NEPSE feed source | unset |
| `NIOS_GOV_FEED_URL` | Government feed source | unset |

---

## CFG-04: packages/backend

**File:** `packages/backend/.env` (implicit)

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Express listen port | `3000` |
| `DATABASE_URL` | PostgreSQL connection | required |
| `REDIS_URL` | Redis connection | required |
| `JWT_SECRET` / `API_SECRET_KEY` | JWT signing | dev fallback (insecure) |
| `JWT_EXPIRY` | Access token TTL | `15m` |
| `REFRESH_TOKEN_EXPIRY` | Refresh token TTL | `7d` |
| `PYTHON_PATH` | Python for NLU subprocess | `python3` |
| `PAYMENT_WEBHOOK_SECRET` | Khata payment webhook | empty |

---

## CFG-05: backend/storage (R2)

**Module:** `backend/config/r2_config.py`

| Variable | Purpose |
|----------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account |
| `R2_ACCESS_KEY_ID` | S3 access key |
| `R2_SECRET_ACCESS_KEY` | S3 secret |
| `R2_BUCKET_NAME` | Bucket name |
| `R2_PUBLIC_URL` | CDN/public URL prefix |
| `DATABASE_URL` | Shared PG for knowledge metadata |

---

## CFG-06: khata-app

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE` | packages/backend URL |
| `VITE_KHATA_TENANT_ID` | Tenant UUID |
| `VITE_KHATA_COMPANY_ID` | Company UUID |
| `VITE_KHATA_USER_ID` | User UUID |
| `VITE_ESEWA_MERCHANT_ID` | eSewa payment |
| `VITE_KHALTI_PUBLIC_KEY` | Khalti payment |

---

## CFG-07: Docker Compose

| Service | Env |
|---------|-----|
| postgres | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| redis | default |
| backend | `DATABASE_URL`, `REDIS_URL`, `PORT` |

---

## CFG-08: CI / Test Overrides

| Context | Variables |
|---------|-----------|
| Playwright | `VITE_SELF_CONTAINED_AI=true`, `VITE_ERP_BOT_URL=""`, `E2E_PORT`, `E2E_HOST` |
| Eval scripts | `ERP_BOT_BACKEND_URL=http://127.0.0.1:8765` |
| GitHub Actions | `CI=true` |

---

## CFG-09: Design System (`src/styles.css`)

CSS custom properties (not env vars):

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#1557b0` | Buttons, focus rings |
| `--primary-hover` | `#0f4a96` | Button hover |
| `--success` | `#059669` | Success states |
| `--warning` | `#d97706` | Warning states |
| `--danger` | `#dc2626` | Error/danger |
| `--info` | `#0284c7` | Info states |
| `--sidebar-bg` | `#1e2433` | Sidebar background |
| `--page-bg` | `#f5f6fa` | Page background |

**Governed by:** `AGENTS.md` design system rules.

---

## CFG-10: Application Constants (Code)

| Location | Constants |
|----------|-----------|
| `erp_bot/src/config.py` | Central Python config dataclass |
| `src/store/store.types.ts` | Default seeds, crypto params |
| `src/lib/db.ts` | Dexie version `22`, table schemas |
| `src/nios/session.ts` | localStorage keys for NIOS IDs |
| `khata-app/src/types.ts` | Tenant/company/user from env |

---

## Configuration Dependency Matrix

| Consumer | Requires Config From |
|----------|-------------------|
| SPA AI chat | VITE_NIOS_PLATFORM_V3, ERP_BOT_BACKEND_URL (via proxy) |
| syncEngine | VITE_API_URL, JWT from auth |
| erp_bot startup | OLLAMA_BASE_URL, model names, CHROMA_PATH |
| NIOS gateway | NIOS_*, Ollama models |
| Knowledge pipeline | DATABASE_URL, R2_*, Ollama EMBED_MODEL |
| packages/backend | DATABASE_URL, REDIS_URL, JWT_SECRET |
| Render deploy | PORT, NODE_OPTIONS, ERP_BOT_BACKEND_URL |
| khata-app | VITE_API_BASE, VITE_KHATA_* |

---

## Secrets Classification

| Secret | Location | Exposure Risk |
|--------|----------|---------------|
| `JWT_SECRET` | packages/backend env | Server only |
| `R2_SECRET_ACCESS_KEY` | backend env | Server only |
| `PAYMENT_WEBHOOK_SECRET` | packages/backend env | Server only |
| `VITE_BRAVE_SEARCH_KEY` | Vite build | Client bundle |
| `VITE_KHALTI_PUBLIC_KEY` | khata-app build | Client bundle (public key) |
| Ollama | No API key | Local network |

---

## Configuration Files Index

| File | Package |
|------|---------|
| `.env.example` | Root |
| `erp_bot/.env.example` | erp_bot |
| `vite.config.ts` | Root build |
| `render.yaml` | Deploy |
| `vercel.json` | Deploy |
| `docker-compose.yml` | Local infra |
| `playwright.config.ts` | E2E |
| `eslint.config.js` | Lint |
| `capacitor.config.ts` | khata-app |
| `erp_bot/requirements.txt` | Python deps |
| `package.json` | Root npm |
| `packages/backend/package.json` | Backend npm |
| `khata-app/package.json` | Mobile npm |
| `AGENTS.md` | UI conventions |
| `DEPLOYMENT.md` | erp_bot deploy |
| `LAUNCH_CHECKLIST.md` | Khata launch |
