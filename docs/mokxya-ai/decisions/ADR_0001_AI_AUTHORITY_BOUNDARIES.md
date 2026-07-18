# ADR-0001 — AI Authority Boundaries

Status: Accepted as **TARGET** with documented **CURRENT DEVIATIONS**  
Date: 2026-07-14  
Phase: MAI-00  

## Context

MokXya must separate probabilistic language interpretation from deterministic
accounting mutation and evidence-backed company/knowledge claims. The master
roadmap defines an ideal Action Runtime → ERPCommandPort → OEC → Connector → ERP
mutation chain. This ADR records what the repository actually enforces today
versus that target.

## Decision Summary

| Authority | TARGET DECISION | CURRENT STATE |
|-----------|-----------------|---------------|
| Language model | Interpretation only; never ledger/tax/legal authority | Generally held for Orbix chat drafting; model skipped often via deterministic preprocess (`skip_llm`) |
| Deterministic accounting | Domain engines own calculations and journals | **ACTIVE** in browser Dexie domain engines + Node Postgres khata confirm |
| Company-data | Authenticated tenant/company context owns facts | **PARTIAL** — request-body / default tenant identities still present |
| Knowledge | Reviewed sources with citations/effective dating | **PARTIAL** — NP language KB indexes active; legal temporal authority incomplete |
| Action Runtime | Sole proposal/dispatch gateway for mutations | **PARTIAL / RARELY ON PRODUCT PATH** |
| OEC | Sole mutation authority for ERP writes | **NOT TRUE for primary Sutra/Orbix ledger path** |
| Frontend | Presentation + explicit confirm; no authority invent | **PARTIAL** — frontend calculates totals; posts via Dexie |
| Audit/sync | Immutable audit + honest sync state | **PARTIAL** — dual sync systems; sync UX maturity varies |

---

## 1. Model interpretation authority

### TARGET DECISION

The model may classify, propose drafts, and explain. It must not invent parties,
amounts, citations, or claim mutation success without a connector receipt.

### CURRENT DEVIATION

- Production chat ingress prefers OIP Orchestrator with deterministic ERP
  preprocess that often sets `skip_llm=True`
  (`erp_bot/src/oip/integration/khata_preprocess.py`,
  `mode_aware_erp.py`, `nepali_shop_nlu.py`).
- Drafts are built in Python khata draft modules; UI confirmation posts
  locally without OEC receipts for the ledger write.

### MIGRATION REQUIRED

Retain deterministic preprocess; ensure every material LLM claim is verified;
never treat model prose as posting authority (already mostly true for Orbix
confirm button path).

---

## 2. Deterministic accounting authority

### TARGET DECISION

Journal construction, VAT/TDS, inventory valuation, period locks, and voucher
sequencing live in domain services — not prompts.

### CURRENT STATE (evidence-aligned)

- **Authoritative (Sutra Orbix Model B):**
  `src/lib/ekhata/orbixPostingService.ts` →
  `postPurchaseTransaction` / `postSalesTransaction` /
  settlement/treasury engines under `src/domains/*`.
- **Also authoritative (manual UI):** `voucherSlice.addVoucher` and invoice
  forms computing totals before Dexie write.
- **Parallel authority (mobile/API):**
  `packages/backend/src/routes/khata.ts` `executeKhataConfirm`.

### MIGRATION REQUIRED

Unify write authorities toward one audited mutation gateway without changing
calculation semantics mid-flight.

---

## 3. Company-data authority

### TARGET DECISION

Tenant/company/user/fiscal context comes from authenticated server context,
never trusted client body alone in production.

### CURRENT DEVIATION

- `oip_chat_ingress.build_intelligence_request` accepts
  `context.tenant_id` / `company_id` / `user_id` and defaults
  `company-a` / settings `tenant-a` / `orbix-user`
  (`erp_bot/src/api/oip_chat_ingress.py`).
- `OIP_AUTH_REQUIRED` defaults false; Render blueprint sets
  `OIP_AUTH_REQUIRED=false` (`render.yaml`).
- `POST /api/khata/confirm` takes `tenant_id`/`company_id` from body with
  **no `authMiddleware`** (`packages/backend/src/routes/khata.ts`).

### MIGRATION REQUIRED

Bind identity from JWT/session; deny default service tenants in production;
authenticate khata confirm.

---

## 4. Knowledge authority

### TARGET DECISION

External claims require jurisdiction, version, effective date, review status,
and citations. Language knowledge is not legal/accounting authority.

### CURRENT STATE

- Nepali language package: offline pipeline from `Knowledge source/*.zip` into
  `knowledgebase/indexes/*`; runtime via `nlu/np_kb_adapter.py` and
  `ORBIX_NP_KB_*` env (`knowledgebase/config.json`).
- Hybrid RAG / Chroma / BM25 exist under `erp_bot/src/knowledge` and
  `vectorstore` — often local/Ollama-dependent; Render skips Ollama ingest.
- Legal effective-date separation for Nepal law is not proven as a first-class
  production authority in the Orbix product path.

### MIGRATION REQUIRED

Govern sources; keep language KB out of accounting rate authorities; implement
temporal/legal phases (MAI-24+) separately from language grounding.

---

## 5. Action Runtime authority

### TARGET DECISION

All mutations flow through Action Runtime after quality gate and confirmation.

### CURRENT DEVIATION

Action Runtime modules exist
(`erp_bot/src/oip/modules/action_runtime/`, `ERPCommandPort`,
`ErpCommandAdapter`) and are orchestrator stages for mutating
`execution_intent`. Primary Orbix UI mutations use Dexie posting and
`/orbix/drafts/{id}/mark-posted` ack (`orbix_drafts.py` Model B comment).

### MIGRATION REQUIRED

Either (a) officially adopt Model B Dexie as AUTHORIZED_DOMAIN_LOCAL with
stronger gates, or (b) migrate confirm → Action Runtime → OEC while preserving
offline-first semantics (MAI-34+).

---

## 6. OEC mutation authority

### TARGET DECISION

`Action Runtime → ERPCommandPort → OEC → Connector → ERP` is the sole mutation
route.

### CURRENT DEVIATION — **material**

Primary ledger writes:

1. Browser Dexie via `executeOrbixConfirm` / `addVoucher` / domain engines.
2. Node Postgres via `/api/khata/confirm` and sync upserts.
3. OEC exists as Python connector runtime with default `tenant-a` request
   params (`oec_runtime/api/router.py`) and is **not** the day-to-day Orbix
   voucher writer.

### MIGRATION REQUIRED

Document dual authorities as intentional short-term architecture **or**
converge; eliminate unauthenticated bypasses; stop calling OEC “sole”
authority until proven.

---

## 7. Frontend authority

### TARGET DECISION

Frontend renders typed envelopes, never invents posting success, never treats
NL “yes” as confirm token.

### CURRENT STATE

- Orbix confirm is explicit UI (`confirmPending` → `executeOrbixConfirm`).
- Discourse “yes” re-presents entry card; does not auto-post (evidence in
  e-Khata process/discourse paths and UI6 presentation tests).
- Frontend **does** compute invoice/voucher totals and is the Dexie write host.

### MIGRATION REQUIRED

Keep explicit confirmation; reduce duplicate calculation paths over time;
ensure sync state never equates queued to synced.

---

## 8. Audit / sync authority

### TARGET DECISION

Immutable audit + outbox + honest sync/conflict presentation.

### CURRENT STATE

- Domain posts enqueue `eventSyncQueue`; legacy `syncOutbox` still present;
  Node `/api/sync/push` and `/api/sync/events/*` coexist.
- Draft mark-posted is ack-only, not ledger audit of the voucher itself.

### MIGRATION REQUIRED

Single sync authority narrative (MAI-35); reconcile dual queues.

---

## Consequences

1. MAI-00 must not claim OEC-only mutation as a present fact.
2. Next implementation work must prioritize executable Ask/Accountant and
   tenant policy (MAI-01) before expanding language/RAG surface.
3. Any phase that assumes Action→OEC as live product path must first reconcile
   Model B Dexie posting.
