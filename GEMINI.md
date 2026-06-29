# BUSY ERP - Architectural Context

## Core Types

- Tenant, Company, FiscalYear (multi-tenant isolation)
- Ledger, VoucherLine, BillReference (double-entry accounting)
- Item, MaterialCentre, InventoryPosting (inventory tracking)

## Database Immutability

- ledger_postings, inventory_postings: event-sourced (INSERT only, never UPDATE/DELETE)
- All corrections via reversal entries
- audit_log: append-only immutable log

## API Contract

- Response envelope: {success, data, error?, timestamp}
- Pagination: ?limit=20&offset=0
- Auth: JWT in Authorization header
- Rate limit: 100 req/min per user

## Deployment

- Backend: Render (Node.js + PostgreSQL + Redis)
- Frontend: Vercel (Next.js)
- Files: AWS S3
- Email: SendGrid
- Jobs: Bull queue on Render (GST API calls, backups)

## Keyboard Shortcuts (F2=Save, F4=Narration, F6=Type, F9=DeleteRow, Ctrl+?)

## Default Paths

- API base: https://busy-api.onrender.com (Render)
- Web base: https://busy.vercel.app (Vercel)
- Health check: GET /api/health (returns {status: 'ok'})
- Database: Render PostgreSQL, auto-backups daily
