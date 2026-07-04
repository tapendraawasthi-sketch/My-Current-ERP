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

## e-Khata full LLM (Ollama — no API keys)

e-Khata uses **local Ollama** via `erp_bot` for ChatGPT-style Nepali conversation + khata entries.

### Local development (recommended)

```bash
# Terminal 1 — Ollama
ollama serve
ollama pull qwen2.5-coder:7b    # or llama3.2:3b for lighter Nepali chat
ollama pull nomic-embed-text    # for Falcon codebase index

# Terminal 2 — erp_bot API (port 8765)
cd erp_bot
pip install -r requirements.txt
cp .env.example .env
python scripts/start.py

# Terminal 3 — Sutra ERP
npm run dev
```

Open e-Khata (green book icon). Status should show **Ollama LLM connected**.

### API endpoints (proxied as `/erp-bot/...` in production)

| Endpoint | Purpose |
|----------|---------|
| `GET /status` | Ollama + `khata_llm: true` when ready |
| `POST /khata/chat` | Full Nepali chat + entry detection |
| `POST /khata/clear_session` | Reset conversation memory |

### Production on Render

The default `sutra-erp` Node service **does not** run Ollama. For full LLM on Render:

1. Deploy `erp_bot` on a **second service** (Docker/VM with Ollama installed) or run erp_bot on your own server.
2. Set on **sutra-erp** service:
   - `ERP_BOT_BACKEND_URL=https://your-erp-bot-host:8765`
3. Rebuild — Falcon and e-Khata use `/erp-bot` proxy in `serve.mjs`.

Without `ERP_BOT_BACKEND_URL`, e-Khata falls back to the **offline rule-based parser** (still records entries, limited chat).

### Verify Ollama from browser network

```bash
curl http://localhost:8765/status
curl -X POST http://localhost:8765/khata/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"namaste, kasto cha?","session_id":"test-1"}'
```
