# Deployment Guide — Sutra ERP on Railway

Primary production host: **Railway** (frontend `sutra-erp` + Python bot `sutra-erp-bot`).

## Architecture

```
Browser → sutra-erp (Node / serve.mjs) → /erp-bot proxy
       → sutra-erp-bot (Python erp_bot) → OIP Kernel → Groq API
```

No Google Cloud GPU, Ollama, or qwen3 in production chat.

## Services

| Service | Root Directory | Runtime | Purpose |
|---------|----------------|---------|---------|
| **sutra-erp** | repo root (`.` / blank) | Node | SPA + `/erp-bot/*` reverse proxy |
| **sutra-erp-bot** | `erp_bot` | Python | FastAPI + OIP Provider Runtime (Groq) |

Config files: `railway.toml` (frontend), `erp_bot/railway.toml` (bot), `nixpacks.toml` (npm + python3).

## One-time Railway setup

### 1) Frontend — `sutra-erp`

1. New service from this GitHub repo.
2. **Root Directory:** blank / `.`
3. Uses `railway.toml` (Nixpacks + `scripts/render-build.sh` + `npm start`).
4. Variables:

| Variable | Value |
|----------|-------|
| `ERP_BOT_BACKEND_URL` | `https://${{sutra-erp-bot.RAILWAY_PUBLIC_DOMAIN}}` |
| `NODE_ENV` | `production` |
| `NODE_OPTIONS` | `--max-old-space-size=6144` |

`PORT` is injected by Railway — do not hardcode.

### 2) Bot — `sutra-erp-bot`

1. Second service from the **same** repo / project.
2. **Root Directory:** `erp_bot` (required).
3. Uses `erp_bot/railway.toml`.
4. Generate a public domain (Settings → Networking) so the frontend reference resolves.
5. Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `OIP_ENABLED` | `true` | |
| `OIP_FORCE_STUB_PROVIDERS` | `false` | Real Groq |
| `OIP_PROVIDER` | `groq` | |
| `OIP_GROQ_API_KEY` | *(secret)* | Never commit |
| `OIP_DEFAULT_MODEL` | `llama-3.3-70b-versatile` | |
| `OIP_AUTH_REQUIRED` | `true` | |
| `OIP_JWT_SECRET` | *(secret ≥16 chars)* | Or `API_SECRET_KEY` |
| `OIP_PROVIDER_RUNTIME_ENABLED` | `true` | |
| `OIP_ORCHESTRATOR_ENABLED` | `true` | |
| `OIP_DATABASE_URL` | `sqlite+aiosqlite:///./data/oip/oip.db` | Ephemeral disk OK |
| `ORBIX_NP_KB_ENABLED` | `true` | |
| `ORBIX_NP_KB_ROOT` | `knowledgebase` | Bundled under `erp_bot` |

`start_render.py` sets lean-boot mode (skips Ollama/Chroma ingest) and binds `::` on Railway for private networking compatibility.

### 3) Wire Orbix (critical)

Without `ERP_BOT_BACKEND_URL` on **sutra-erp**, `/erp-bot/status` returns `"mode":"builtin"` and the UI shows **Orbix unavailable**.

Use the Railway reference variable (service name must match):

```text
ERP_BOT_BACKEND_URL=https://${{sutra-erp-bot.RAILWAY_PUBLIC_DOMAIN}}
```

Private-network alternative (same project; set `PORT=8080` manually on the bot first):

```text
ERP_BOT_BACKEND_URL=http://${{sutra-erp-bot.RAILWAY_PRIVATE_DOMAIN}}:${{sutra-erp-bot.PORT}}
```

Redeploy **sutra-erp** after setting the variable.

## Verify

```bash
BASE=https://<sutra-erp>.up.railway.app
BOT=https://<sutra-erp-bot>.up.railway.app

curl -sf "$BASE/health" | jq .
# expect: "erp_bot_proxy":"configured"

curl -sf "$BASE/erp-bot/status" | jq .
# expect: "mode":"oip" (not "builtin")

curl -sf "$BOT/livez" | jq .
curl -sf "$BOT/status" | jq .
```

Hard-refresh the browser after a good `/erp-bot/status`.

## How deploys work

1. Push to **`main`** on GitHub.
2. Railway auto-deploys connected services.
3. Frontend build: `scripts/render-build.sh` (LF / POSIX `sh` — required by Railway’s chmod wrapper).

## Orbix chat path

```
Browser → serve.mjs (/erp-bot) → erp_bot /orbix/chat/stream
  → oip_chat_ingress → IntelligenceKernelFacade → Orchestrator
  → Provider Runtime → GroqProviderAdapter → api.groq.com
```

| Proxied path | Purpose |
|--------------|---------|
| `GET /erp-bot/status` | Provider Runtime readiness |
| `GET /erp-bot/livez` | Lightweight live probe |
| `POST /erp-bot/orbix/chat/stream` | Orbix chat (SSE) |

## Render (legacy / optional)

`render.yaml` remains for a secondary Render stack. Prefer Railway. If you still use Render, wire `ERP_BOT_BACKEND_URL` via `fromService` as before.
