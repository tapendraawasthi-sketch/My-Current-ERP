# Deployment Guide — Sutra ERP on Render

Production URL: **https://my-current-erp.onrender.com**

## Architecture (production)

```
Browser → sutra-erp (Node) → sutra-erp-bot (Python erp_bot) → OIP Kernel → Groq API
```

There is **no** dependency on Google Cloud GPU, Ollama, or qwen3 in production chat.

## Services (render.yaml)

| Service | Runtime | Purpose |
|---------|---------|---------|
| **sutra-erp** | Node | SPA + `/erp-bot/*` reverse proxy |
| **sutra-erp-bot** | Python | FastAPI erp_bot + OIP Provider Runtime (Groq) |

## How deploys work

1. Push to **`main`** on GitHub.
2. **Render** rebuilds both services if connected with **Auto-Deploy** enabled.
3. GitHub Actions workflow **`Render Deploy`** also builds and can trigger a **Deploy Hook** (recommended).

## One-time Render setup

### Option A — Blueprint (recommended)

1. Render Dashboard → **Blueprints** → **New Blueprint Instance**.
2. Connect this repo; Render reads `render.yaml` and creates **sutra-erp-bot** + updates **sutra-erp**.
3. On **sutra-erp-bot**, set secret **`OIP_GROQ_API_KEY`** (Dashboard → Environment).
4. On **sutra-erp**, **remove** any manual `ERP_BOT_BACKEND_URL=http://35.202.84.218:8765` — the blueprint wires it via `fromService`.

### Option B — Manual second service

If **sutra-erp** already exists:

1. Create **Web Service** → name `sutra-erp-bot`, runtime **Python 3**, root directory **`erp_bot`**.
2. **Build command:** `bash scripts/render-build.sh`
3. **Start command:** `python scripts/start_render.py`
4. **Health check path:** `/health`
5. Set env vars (see table below).
6. On **sutra-erp**, set `ERP_BOT_BACKEND_URL` to the **sutra-erp-bot** `https://….onrender.com` URL (no trailing slash).

### Deploy hook (optional)

1. **sutra-erp** → Settings → Deploy Hook → copy URL.
2. GitHub → Settings → Secrets → `RENDER_DEPLOY_HOOK`.

## Environment variables

### sutra-erp-bot (Python)

| Variable | Value | Notes |
|----------|-------|-------|
| `OIP_ENABLED` | `true` | OIP kernel on |
| `OIP_FORCE_STUB_PROVIDERS` | `false` | Real Groq calls |
| `OIP_PROVIDER` | `groq` | Provider Runtime selection |
| `OIP_GROQ_API_KEY` | *(secret)* | Groq API key — **never commit** |
| `OIP_DEFAULT_MODEL` | `llama-3.3-70b-versatile` | Default chat model |
| `OIP_AUTH_REQUIRED` | `false` | No JWT for Orbix proxy |
| `OIP_PROVIDER_RUNTIME_ENABLED` | `true` | Provider Runtime on |
| `OIP_ORCHESTRATOR_ENABLED` | `true` | Orchestrator on |
| `OIP_DATABASE_URL` | `sqlite+aiosqlite:///./data/oip/oip.db` | OIP state (ephemeral disk) |
| `PYTHON_VERSION` | `3.11.11` | Set in render.yaml |
| `PORT` | *(auto)* | Render injects; do not hardcode |

Render also sets `RENDER=true` — erp_bot skips Ollama/Chroma ingest and file watcher on startup.

### sutra-erp (Node)

| Variable | Value | Notes |
|----------|-------|-------|
| `ERP_BOT_BACKEND_URL` | `https://sutra-erp-bot.onrender.com` | Auto via `fromService` in render.yaml |
| `NODE_ENV` | `production` | |
| `PORT` | `10000` | Render default |
| `NODE_OPTIONS` | `--max-old-space-size=6144` | Build memory |

**Remove** legacy `ERP_BOT_BACKEND_URL=http://35.202.84.218:8765` from the dashboard.

## Verify a deploy landed

```bash
# Frontend commit SHA
curl -s https://my-current-erp.onrender.com/health | jq .

# erp_bot OIP status (via proxy)
curl -s https://my-current-erp.onrender.com/erp-bot/status | jq .

# Direct erp_bot (replace with your sutra-erp-bot URL)
curl -s https://sutra-erp-bot.onrender.com/status | jq .
```

Expected `/status` (OIP mode):

```json
{
  "mode": "oip",
  "provider_runtime_ready": true,
  "configured_provider": "groq"
}
```

After deploy, hard-refresh: **Ctrl+Shift+R** / **Cmd+Shift+R**.

## e-Khata / Orbix AI (OIP + Groq)

### Local development

```bash
# Terminal 1 — erp_bot API (port 8765)
cd erp_bot
pip install -r requirements.txt
cp .env.example .env
# Set OIP_FORCE_STUB_PROVIDERS=false, OIP_PROVIDER=groq, OIP_GROQ_API_KEY=...
python scripts/start.py

# Terminal 2 — Sutra ERP
npm run dev
```

### Production chat path

```
Browser → serve.mjs (/erp-bot) → erp_bot /orbix/chat/stream
  → oip_chat_ingress → IntelligenceKernelFacade → Orchestrator
  → Provider Runtime → GroqProviderAdapter → api.groq.com
```

### API endpoints (proxied as `/erp-bot/...`)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Render health check |
| `GET /status` | Provider Runtime readiness |
| `POST /orbix/chat/stream` | Orbix chat via OIP kernel (SSE) |
| `POST /chat` | Non-streaming chat via OIP kernel |

Without `ERP_BOT_BACKEND_URL`, e-Khata uses the **built-in Nepali brain** (offline fallback).

### Legacy Ollama (local dev / tests only)

Set `OIP_ENABLED=false` and run `ollama serve` with qwen models. Not used in production.

## Smoke tests

```bash
BASE=https://my-current-erp.onrender.com
BOT=https://sutra-erp-bot.onrender.com  # adjust to your URL

# 1. Frontend health
curl -sf "$BASE/health" | jq -e '.commit'

# 2. Proxied OIP status
curl -sf "$BASE/erp-bot/status" | jq -e '.mode == "oip" and .provider_runtime_ready == true'

# 3. Direct erp_bot status
curl -sf "$BOT/status" | jq -e '.configured_provider == "groq"'

# 4. Streaming chat (first SSE event)
curl -sf -N -X POST "$BASE/erp-bot/orbix/chat/stream" \
  -H 'Content-Type: application/json' \
  -d '{"message":"namaste","session_id":"smoke-1"}' | head -5
```

## Manual deploy

Render Dashboard → service → **Manual Deploy** → **Deploy latest commit**.

Or: GitHub → Actions → **Render Deploy** → Run workflow.
