# Operator actions required — Complete AI Production plan

**As of:** 2026-07-20  
**Honesty sync:** DONE (dossier §9 + BLOCKING_TICKETS + registry aligned; flag OFF)

## 1) Railway Redeploy (required for Orbix)

Production still on commit `32712139` until you Redeploy.

### sutra-erp-bot
1. Deployments → **Redeploy** (latest `main`)
2. Root Directory: `erp_bot` (preferred)
3. Variables: `PORT=8080`, `OIP_JWT_SECRET` (≥16 chars), Groq/`OIP_*` as in DEPLOYMENT.md

### sutra-erp
1. Deployments → **Redeploy** (latest `main`)
2. Variable:  
   `ERP_BOT_BACKEND_URL=http://${{sutra-erp-bot.RAILWAY_PRIVATE_DOMAIN}}:${{sutra-erp-bot.PORT}}`

Reply in chat: **redeployed**

## 2) OWNER_SIGNOFF (required for PR-C1-ARM)

Edit [`OWNER_SIGNOFF.md`](./OWNER_SIGNOFF.md):

- Status: **SIGNED**
- Product owner name: *(your real name)*
- Date: *(today)*
- Staging golden path / residual acceptance: filled

Chat `go` / plan approval is **not** sign-off (ADR_0091).

Reply in chat: **signed** after the file is saved.
