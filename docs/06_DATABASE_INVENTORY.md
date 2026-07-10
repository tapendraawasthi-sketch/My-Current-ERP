# 06 — Database Inventory

**Project:** Sutra ERP  
**Generated:** 2026-07-10

---

## Database Architecture Overview

| Store | Technology | Location | Primary Owner |
|-------|------------|----------|---------------|
| SutraERPDatabase | IndexedDB (Dexie) | Browser | `src/lib/db.ts` |
| SutraAiLearning | IndexedDB (Dexie) | Browser | `src/ai/learning/SutraAiDexie.ts` |
| mobile-khata-offline | IndexedDB | Browser (khata-app) | `khata-app/lib/offlineQueue.ts` |
| PostgreSQL (ERP cloud) | PostgreSQL 15 | Render / docker | `packages/backend` |
| PostgreSQL (knowledge) | PostgreSQL | Shared DATABASE_URL | `backend/knowledge` |
| Redis | Redis 7 | Render / docker | `packages/backend` |
| ChromaDB | Persistent local | `erp_bot/data/chroma_db` | erp_bot + backend |
| NIOS SQLite stores | SQLite 3 | `erp_bot/data/*.sqlite3` | erp_bot/nios |
| Orbix memory | SQLite (async) | `data/orbix_memory.sqlite3` | erp_bot/orbix |
| Cloudflare R2 | S3-compatible object | Cloud | `backend/storage` |
| Session files | JSON on disk | `erp_bot/data/sessions/` | conversation |
| BM25 cache | pickle | `erp_bot/data/bm25_index.pkl` | hybrid_rag |
| NIOS feeds | JSON | `erp_bot/data/nios_feeds.json` | nios/feeds |

---

## DB-01: Dexie `SutraERPDatabase` (`src/lib/db.ts`)

| Field | Value |
|-------|-------|
| **Purpose** | Primary offline-first ERP data store in browser |
| **Responsibilities** | All accounting masters, transactions, settings, sync outbox |
| **Dependencies** | Dexie 4, browser IndexedDB API |
| **Dependents** | `useStore`, all pages, accounting engine, AI RAG context |
| **Public API** | `openDB()`, `getDB()`, `DB*` TypeScript interfaces, `generateId()` |
| **Internal API** | Version migrations v18→v22, `safeTableGet`, `resetDB` |
| **Entry Points** | `initializeApp()` in store |
| **Technology** | Dexie 4, TypeScript |
| **Complexity** | Very High |

### Schema Versions

| Version | Addition |
|---------|----------|
| v18 | Core: accounts, parties, items, vouchers, invoices, stock, FY, users |
| v19 | `loginHistory` |
| v20 | ~40 extended tables: TDS, payroll runs, cheques, branches, cbmsQueue, etc. |
| v21 | Re-declare 9 tables missing from v20 (crash fix) |
| v22 | `syncOutbox` for cloud sync |

### Core Tables (typed)

`accounts`, `parties`, `items`, `vouchers`, `invoices`, `stockMovements`, `warehouses`, `stockTransfers`, `units`, `unitConversions`, `costCenters`, `fiscalYears`, `companySettings`, `users`, `notifications`, `shortcuts`, `posSessions`, `posHolds`, `priceLists`, `billSundries`, `standardNarrations`, `salesPersons`, `purchaseOrders`, `salesOrders`, `quotations`, `deliveryChallans`, `goodsReceiptNotes`, `physicalStocks`, `budgets`, `fixedAssets`, `depreciationLedger`, `bankReconciliations`, `employees`, `payrollEntries`, `auditLogs`, `batches`, `serialNumbers`, `pdcRegister`, `fxGainLossEntries`, `costCentres`, `costCentreAllocations`, `approvalPolicies`, `approvalRequests`, `approvalActions`, `recurringTemplates`, `recurringPostings`, `syncOutbox`

### Extended Tables (`Table<any>`)

`currencies`, `recurringVouchers`, `customFieldDefs`, `billSundryMasters`, `saleTypes`, `purchaseTypes`, `taxCategories`, `discountStructures`, `itemGroups`, `holidays`, `bankStatements`, `tdsEntries`, `tdsChallans`, `stockJournals`, `productions`, `unassembles`, `materialIssued`, `materialReceived`, `stockCategories`, `voucherTypeMasters`, `scenarios`, `voucherSeriesConfig`, `voucherAuditLogs`, `costCategories`, `costCentreClasses`, `reorderLevels`, `priceLevels`, `hsCodes`, `vatClassifications`, `tdsNatureOfPayment`, `employeeGroups`, `payHeads`, `salaryDetails`, `payrollUnits`, `attendanceTypes`, `ledgerExtensions`, `chequeBooks`, `cheques`, `depositSlips`, `pdCheques`, `ePaymentBatches`, `paymentAdvices`, `branches`, `exchangeRates`, `followUpNotes`, `jobWorkOrders`, `reportSchedules`, `priceFloorPolicies`, `chequeBounceLogs`, `cbmsQueue`, `salespersons`, `loginHistory`, `salaryStructures`, `payrollRuns`

---

## DB-02: Dexie `SutraAiLearning`

| Field | Value |
|-------|-------|
| **Purpose** | SUTRA AI learning, feedback, LLM cache, session history |
| **Responsibilities** | Persist thumbs up/down, phrase usage, offline LLM responses |
| **Dependencies** | Dexie, `ai/learning/*` modules |
| **Dependents** | `IntelligenceCore`, `LearningEngine`, `LlmResponseCache` |
| **Public API** | Tables: `feedback`, `llmCache`, `sessions`, `phraseUsage`, `profiles` |
| **Internal API** | Schema defined in `SutraAiDexie.ts` |
| **Entry Points** | AI chat interactions |
| **Technology** | Dexie 4 |
| **Complexity** | Medium |

---

## DB-03: PostgreSQL Cloud ERP (`packages/backend/src/db/schema.sql`)

| Field | Value |
|-------|-------|
| **Purpose** | Multi-tenant cloud ERP canonical schema |
| **Responsibilities** | Auth, sync, khata vouchers, full accounting schema |
| **Dependencies** | PostgreSQL 15, `DATABASE_URL` |
| **Dependents** | Express API, khata-app, sync engine |
| **Public API** | SQL schema; REST via `/api/*` |
| **Internal API** | `migrate.js`, `lib/db.ts` pool |
| **Entry Points** | `npm run migrate` in packages/backend |
| **Technology** | PostgreSQL, pg driver |
| **Complexity** | Very High |

### Table Domains (~42 tables + Khata extensions)

| Domain | Tables |
|--------|--------|
| Tenancy | `tenants`, `companies`, `fiscal_years` |
| Auth/RBAC | `users`, `roles`, `permissions` |
| Accounting | `chart_of_accounts`, `ledgers`, `vouchers`, `voucher_lines`, `ledger_postings` |
| Masters | `parties`, `items`, `item_groups`, `warehouses`, `batches` |
| Inventory | `inventory_postings` (append-only) |
| Invoicing | `invoices`, `invoice_lines`, `bill_references` |
| Cost/budget | `cost_centres`, `cost_categories`, `budgets` |
| Fixed assets | `fixed_assets`, `depreciation_schedules` |
| Payroll | `employees`, `salary_structures`, `pay_heads`, `attendance`, `payroll_runs`, `payroll_entries` |
| Banking | `bank_accounts`, `bank_reconciliations`, `cheque_register`, `pdc_register` |
| Tax/FX | `currencies`, `exchange_rates`, `fx_gain_loss_entries`, `tds_*`, `vat_classifications` |
| Workflow | `approval_policies`, `approval_requests`, `recurring_templates` |
| Audit | `audit_logs` (append-only) |
| Khata | `khata_transactions`, `khata_account_code_templates`; KH-* COA seed |

### Immutability Triggers

`ledger_postings`, `inventory_postings`, `audit_logs` — `prevent_mutation()` blocks UPDATE/DELETE.

### Khata Voucher Types

`khata_credit_sale`, `khata_cash_sale`, `khata_payment_in`, `khata_purchase`, `khata_payment_out`, `khata_expense`

---

## DB-04: PostgreSQL Knowledge Metadata (`backend/knowledge/schema.sql`)

| Field | Value |
|-------|-------|
| **Purpose** | Tenant document ingestion metadata and job tracking |
| **Responsibilities** | Document lifecycle, chunk refs, audit logs, job queue state |
| **Dependencies** | PostgreSQL, `DATABASE_URL` |
| **Dependents** | Knowledge orchestrator, NIOS federation |
| **Public API** | `/knowledge/v1/documents`, `/search` |
| **Internal API** | `KnowledgeRepository`, `sql_loader.py` |
| **Entry Points** | `repository.ensure_schema()` |
| **Technology** | PostgreSQL, psycopg2 |
| **Complexity** | Medium-High |

### Tables

| Table | Purpose |
|-------|---------|
| `knowledge_documents` | Upload metadata, R2 keys, processing stage |
| `knowledge_ingestion_jobs` | Queue state, retry, scheduling |
| `knowledge_chunks` | Chunk index, chroma_id, text_hash |
| `knowledge_audit_logs` | Append-only pipeline events |

**Vector data** in Chroma collection `tenant_documents` (default), not in PG.

---

## DB-05: Redis (`packages/backend`)

| Field | Value |
|-------|-------|
| **Purpose** | Session store, refresh token denylist, rate limiting |
| **Responsibilities** | JWT session validation; 100 req/min rate limit |
| **Dependencies** | `REDIS_URL`, ioredis |
| **Dependents** | auth middleware, rateLimit middleware |
| **Public API** | None (internal) |
| **Internal API** | `lib/redis.ts` singleton |
| **Entry Points** | Express middleware on each request |
| **Technology** | Redis 7, ioredis |
| **Complexity** | Low |

### Key Patterns

| Key | Purpose |
|-----|---------|
| `session:{userId}` | Hash of active session IDs |
| `denylist:refresh:{sessionId}` | Revoked refresh tokens |
| `ratelimit:{userId\|ip}` | Sliding window counter |

---

## DB-06: ChromaDB (`erp_bot/data/chroma_db`)

| Field | Value |
|-------|-------|
| **Purpose** | Local persistent vector database for all RAG |
| **Responsibilities** | Store embeddings for codebase, Nepal KB, NLU, CA, nav, tenant docs |
| **Dependencies** | chromadb, Ollama `nomic-embed-text`, disk path `CHROMA_PATH` |
| **Dependents** | All erp_bot RAG paths, backend knowledge search |
| **Public API** | Python vectorstore adapters |
| **Internal API** | Per-collection clients, embed_cache |
| **Entry Points** | Ingest scripts, runtime retrieve() |
| **Technology** | ChromaDB persistent client |
| **Complexity** | Medium |

---

## DB-07: NIOS SQLite Stores

| File | Module | Purpose |
|------|--------|---------|
| `nios_memory.sqlite3` | `kernel/memory_bus.py` | 7-level cognitive memory |
| `nios_telemetry.sqlite3` | `kernel/telemetry_store.py` | Request telemetry |
| `nios_provenance.sqlite3` | `intelligence/provenance_graph.py` | Evidence lineage |
| `nios_knowledge_graph.sqlite3` | `knowledge/graph/store.py` | Temporal knowledge graph |
| `nios_world_state.sqlite3` | `representations/world_state/store.py` | 12-domain world state |
| `nios_governance.sqlite3` | `governance/audit.py` | Governance audit |

**Optional:** `NIOS_MEMORY_BACKEND=postgres` → `memory_bus_pg.py` with `memory_bus.schema.postgres.sql`

---

## DB-08: Orbix SQLite (`data/orbix_memory.sqlite3`)

| Field | Value |
|-------|-------|
| **Purpose** | Orbix v2 working + episodic memory |
| **Responsibilities** | Per-tenant session memory, tool observation history |
| **Dependencies** | aiosqlite, `ORBIX_MEMORY_DB` env |
| **Dependents** | `OrbixAgentEngine`, memory_tools |
| **Public API** | `/orbix/v2/memory/forget` |
| **Internal API** | `memory/store.py`, `schema.sql` |
| **Entry Points** | `bootstrap.get_memory()` |
| **Technology** | SQLite, async Python |
| **Complexity** | Medium |

---

## DB-09: Cloudflare R2 Object Storage

| Field | Value |
|-------|-------|
| **Purpose** | Durable object storage for uploaded documents and assets |
| **Responsibilities** | Store original files + extracted markdown per tenant/company |
| **Dependencies** | `R2_*` credentials, boto3 |
| **Dependents** | Knowledge pipeline, storage health check |
| **Public API** | Python `backend.storage.*`; `GET /storage/health` |
| **Internal API** | `R2StorageService`, key layout `knowledge/{tenant}/{company}/{doc}/` |
| **Entry Points** | Upload via knowledge API |
| **Technology** | S3 API, Cloudflare R2 |
| **Complexity** | Medium-High |

---

## DB-10: Browser Storage (non-Dexie)

| Store | Keys / Purpose |
|-------|----------------|
| `localStorage` | `sutra_theme`, `nios_session_id`, `nios_tenant_id`, `nios_company_id`, `erp_bot_session_id`, `sutra_last_sync_pull`, Falcon/eKhata chat persist |
| `sessionStorage` | `sutra_user_id`, `sutra_company_id`, `sutra:ai-*-draft` (invoice, khata, party, chat) |

---

## Data Ownership Matrix

| Data | Write Owner (primary) | Read Consumers |
|------|----------------------|----------------|
| ERP vouchers/invoices | `store/index.ts` → Dexie | pages, reports, AI |
| Cloud vouchers (Khata) | `packages/backend/khata.ts` → PG | khata-app |
| Sync masters | Bidirectional sync engine | Dexie ↔ PG |
| Vector embeddings | ingest scripts / worker | RAG retrieve |
| AI chat history | AI stores / erp_bot sessions | UI panels |
| Tenant documents | backend/knowledge orchestrator | NIOS federation |
| Ledger postings (cloud) | khata confirm, sync (partial) | PG reports |

---

## Schema Migration Paths

| Store | Migration Mechanism |
|-------|---------------------|
| Dexie | `db.version(n).stores()` chain in `lib/db.ts` |
| packages/backend PG | `schema.sql` full apply OR `runKhataMigrations` incremental |
| backend/knowledge PG | `schema.sql` via `ensure_schema()` |
| NIOS PG memory | `memory_bus.schema.postgres.sql` manual |
| Chroma | Re-index scripts (`rebuild_index.py`, ingest scripts) |
| Orbix SQLite | `migrations/001_tenant_scope.sql` |
