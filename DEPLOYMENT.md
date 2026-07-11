# Deployment Guide — Sutra ERP on Render

Production URL: **https://my-current-erp.onrender.com**

## How deploys work

1. Push to **`main`** on GitHub.
2. **Render** rebuilds if the service is connected to this repo with **Auto-Deploy** enabled.
3. GitHub Actions workflow **`Render Deploy`** also builds and can trigger a **Deploy Hook** (recommended).

## One-time Render setup (required if auto-deploy is not working)

1. Open [Render Dashboard](https://dashboard.render.com) → service **sutra-erp**.
2. **Settings → Build & Deploy**
   - **Branch:** `main`
   - **Auto-Deploy:** Yes
   - **Build command:** `npm ci && npm run build`
   - **Start command:** `npm start`
3. **Settings → Deploy Hook** → copy the hook URL.
4. GitHub repo → **Settings → Secrets → Actions** → add:
   - Name: `RENDER_DEPLOY_HOOK`
   - Value: *(paste deploy hook URL)*

## Verify a deploy landed

```bash
curl https://my-current-erp.onrender.com/health
```

Response includes `"commit":"<git-sha>"` matching the latest `main` commit.

After deploy, hard-refresh the browser: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac) to bypass cached JS bundles.

## Manual deploy

Render Dashboard → **sutra-erp** → **Manual Deploy** → **Deploy latest commit**.

Or run the **Render Deploy** workflow manually: GitHub → Actions → Render Deploy → Run workflow.

---

## e-Khata / Orbix AI (OIP Provider Runtime — Groq production)

Production chat uses the **OIP kernel** (not local Ollama):

```
Browser → Render (serve.mjs) → erp_bot → IntelligenceKernelFacade → Orchestrator → Provider Runtime → Groq
```

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

Open e-Khata. Status should show **Provider Runtime ready** (not Ollama connected).

### API endpoints (proxied as `/erp-bot/...` in production)

| Endpoint | Purpose |
|----------|---------|
| `GET /status` | Provider Runtime readiness + configured provider |
| `POST /orbix/chat/stream` | Orbix chat via OIP kernel (JSON SSE) |
| `POST /chat` | Non-streaming chat via OIP kernel |

### Production on Render

1. Deploy `erp_bot` on a **second service** or VM (port **8765**). Ollama GPU is **not required** for chat.
2. Set on **erp_bot** host:
   - `OIP_FORCE_STUB_PROVIDERS=false`
   - `OIP_PROVIDER=groq`
   - `OIP_GROQ_API_KEY=<secret>`
   - `OIP_DEFAULT_MODEL=llama-3.3-70b-versatile`
3. Set on **sutra-erp** (Render Node):
   - `ERP_BOT_BACKEND_URL=https://your-erp-bot-host:8765`

Without `ERP_BOT_BACKEND_URL`, e-Khata uses the **built-in Nepali brain** (offline fallback).

### Legacy Ollama (offline/tests only)

For local tests with `OIP_ENABLED=false`, use `ollama serve` and legacy qwen models. This path is not used in production when OIP is enabled.

### Verify Provider Runtime from browser network

```bash
curl http://localhost:8765/status
curl -X POST http://localhost:8765/orbix/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"message":"namaste","session_id":"test-1"}'
```
