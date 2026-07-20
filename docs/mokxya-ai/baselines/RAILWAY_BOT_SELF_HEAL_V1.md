# Railway bot self-heal (Orbix production path)

**Date:** 2026-07-20  
**Status:** SHIPPED (code) — await redeploy + probe PASS

## Problem

`/health/orbix` showed private `sutra-erp-bot:8080/livez` returning **SPA HTML**, not
`{"status":"ok"}`. The bot Railway service was running Node `serve.mjs` instead of
Python OIP (Root Directory / config pointed at the monorepo frontend).

## Fix (this ship)

1. Root `railway.toml` build/start → `scripts/railway-dispatch-*.sh`  
   Detects `RAILWAY_SERVICE_NAME=*bot*` (or `SUTRA_SERVICE_ROLE=bot`) and runs
   `erp_bot` Python build/start with `PORT=8080`.
2. `erp_bot/railway.toml` → cwd-tolerant `scripts/railway-cwd-*.sh`.
3. `erp_bot/nixpacks.toml` — force Python when Root Directory = `erp_bot`.
4. `serve.mjs` refuses to start when the Railway service name looks like the bot.
5. `DEPLOYMENT.md` — private DNS + JWT secret + `/health/orbix` verify steps.

## Operator verify after redeploy

```bash
BASE=https://<sutra-erp>.up.railway.app
curl -sf "$BASE/health/orbix" | jq .
# expect private probe looksLikeBot / JSON status ok (not SPA)

curl -sf "$BASE/erp-bot/status" | jq .
# expect "mode":"oip"
```

Dashboard still recommended:

- Bot Root Directory = `erp_bot` (preferred)
- Bot `PORT=8080`
- Bot `OIP_JWT_SECRET` (≥16) + Groq vars
- Frontend `ERP_BOT_BACKEND_URL=http://${{sutra-erp-bot.RAILWAY_PRIVATE_DOMAIN}}:${{sutra-erp-bot.PORT}}`

## Honesty

Does **not** flip `production_approved`, OWNER_SIGNOFF, or PR-C1-ARM.
