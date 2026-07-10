# 03 — Module Inventory

**Project:** Sutra ERP  
**Generated:** 2026-07-10

Each module entry includes: **Purpose**, **Responsibilities**, **Dependencies**, **Dependents**, **Public API**, **Internal API**, **Entry Points**, **Technology**, **Complexity**.

---

## Package: `src/` — Frontend SPA (801 files)

---

### MOD-001: `src/main.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | React application bootstrap |
| **Responsibilities** | Mount root; global error handlers; production guards |
| **Dependencies** | React 19, `App.tsx`, `styles.css` |
| **Dependents** | Browser entry |
| **Public API** | None (entry only) |
| **Internal API** | `createRoot`, error boundary hooks |
| **Entry Points** | `index.html` script tag |
| **Technology** | React 19, TypeScript |
| **Complexity** | Low |

---

### MOD-002: `src/App.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Root application shell with auth gate and page router |
| **Responsibilities** | Auth stage routing; `currentPage` switch (~100 routes); AI provider mounting |
| **Dependencies** | `useStore`, `Layout`, all page components, AI providers |
| **Dependents** | All authenticated UI |
| **Public API** | `App` component |
| **Internal API** | `renderPage()` switch, auth stage logic |
| **Entry Points** | `main.tsx` |
| **Technology** | React, Zustand |
| **Complexity** | Very High |

---

### MOD-003: `src/store/index.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Monolithic Zustand application store |
| **Responsibilities** | All ERP CRUD; journal posting; invoice/stock; sync enqueue; initialization |
| **Dependencies** | `lib/db.ts`, `lib/accounting.ts`, slices, `syncEngine` |
| **Dependents** | 190+ pages/components, AI stores |
| **Public API** | `useStore`, `postInvoiceJournal`, `initializeApp` |
| **Internal API** | Slice merge, inline journal helpers |
| **Entry Points** | `initializeApp()` on boot |
| **Technology** | Zustand 5, TypeScript |
| **Complexity** | Very High |

---

### MOD-004: `src/store/slices/`

| Field | Value |
|-------|-------|
| **Purpose** | Domain-specific state slices merged into main store |
| **Responsibilities** | Accounts, vouchers, inventory, settings CRUD |
| **Dependencies** | `lib/db.ts`, `store.types.ts` |
| **Dependents** | `store/index.ts` only |
| **Public API** | None (internal to store) |
| **Internal API** | `accountSlice`, `voucherSlice`, `inventorySlice`, `settingsSlice` |
| **Entry Points** | Store actions |
| **Technology** | TypeScript |
| **Complexity** | High |

---

### MOD-005: `src/store/eKhataStore.ts`

| Field | Value |
|-------|-------|
| **Purpose** | e-Khata/Orbix chat state and message pipeline |
| **Responsibilities** | Send message; confirm cards; offline/online routing; chat persistence |
| **Dependencies** | `lib/ekhata/processMessage`, `erpBotClient`, `selfContainedAi` |
| **Dependents** | `EKhataProvider`, `EKhataPanel` |
| **Public API** | `useEKhataStore`, `sendMessage`, `confirmEntry` |
| **Internal API** | Message history, confirmation state |
| **Entry Points** | Ctrl+Shift+K launcher |
| **Technology** | Zustand, localStorage |
| **Complexity** | Very High |

---

### MOD-006: `src/store/falconStore.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Falcon assistant chat state |
| **Responsibilities** | Message send; session persistence; streaming display |
| **Dependencies** | `lib/falcon/smartAssistant`, `erpBotClient` |
| **Dependents** | `FalconProvider`, `FalconPanel` |
| **Public API** | `useFalconStore`, `sendMessage` |
| **Internal API** | Chat history localStorage |
| **Entry Points** | Falcon launcher UI |
| **Technology** | Zustand |
| **Complexity** | Medium |

---

### MOD-007: `src/store/sutraAiStore.ts`

| Field | Value |
|-------|-------|
| **Purpose** | SUTRA AI chat state |
| **Responsibilities** | Drive IntelligenceCore; manage drafts; feedback |
| **Dependencies** | `ai/core/IntelligenceCore`, `ai/learning/*` |
| **Dependents** | `SutraAiProvider`, `AIChat` |
| **Public API** | `useSutraAiStore`, `sendMessage` |
| **Internal API** | Session context builders |
| **Entry Points** | Ctrl+Shift+A |
| **Technology** | Zustand |
| **Complexity** | High |

---

### MOD-008: `src/store/niosStore.ts`

| Field | Value |
|-------|-------|
| **Purpose** | NIOS shell UI state |
| **Responsibilities** | Panel open/close; message list; NIOS client calls |
| **Dependencies** | `nios/client/niosClient`, `nios/session` |
| **Dependents** | `NiosProvider`, `NiosShell` |
| **Public API** | `useNiosStore` |
| **Internal API** | UI chrome state |
| **Entry Points** | NIOS launcher (when flag on) |
| **Technology** | Zustand |
| **Complexity** | Medium |

---

### MOD-009: `src/lib/db.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Dexie IndexedDB schema and access layer |
| **Responsibilities** | 70+ tables; migrations v18→v22; type definitions; ID generation |
| **Dependencies** | Dexie 4, browser IndexedDB |
| **Dependents** | store, all pages, accounting, AI RAG |
| **Public API** | `openDB`, `getDB`, `DB*` interfaces, `generateId`, `resetDB` |
| **Internal API** | Version chain, `safeTableGet` |
| **Entry Points** | `initializeApp()` |
| **Technology** | Dexie 4, TypeScript |
| **Complexity** | Very High |

---

### MOD-010: `src/lib/accounting.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Core double-entry accounting engine |
| **Responsibilities** | Validate Dr=Cr; trial balance; P&L; balance sheet; ledger queries |
| **Dependencies** | `lib/db.ts` types |
| **Dependents** | store, reports, e-Khata, Orbix report engine |
| **Public API** | `validateDoubleEntry`, `computeTrialBalance`, `computeProfitLoss`, `computeBalanceSheet` |
| **Internal API** | Internal aggregation helpers |
| **Entry Points** | Voucher posting, report pages |
| **Technology** | TypeScript |
| **Complexity** | Very High |

---

### MOD-011: `src/lib/syncEngine.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Cloud sync between Dexie and packages/backend |
| **Responsibilities** | Pull/push incremental changes; outbox processing; sync loop |
| **Dependencies** | `lib/db.ts`, `VITE_API_URL`, JWT auth |
| **Dependents** | `store/index.ts`, `Layout` |
| **Public API** | `startSyncLoop`, `pullChanges`, `pushChanges`, `enqueueSyncRecord` |
| **Internal API** | Conflict resolution, table mapping |
| **Entry Points** | Post-login sync loop |
| **Technology** | TypeScript, fetch |
| **Complexity** | High |

---

### MOD-012: `src/lib/erpBotClient.ts`

| Field | Value |
|-------|-------|
| **Purpose** | HTTP client for erp_bot AI backend |
| **Responsibilities** | Chat, stream, classify; NIOS routing when flag on |
| **Dependencies** | `VITE_ERP_BOT_URL` or `/erp-bot` proxy, `niosClient` |
| **Dependents** | falconStore, eKhataStore, sutraAiStore, niosStore |
| **Public API** | `askErpBot`, `askErpBotStream`, `classifyIntent`, `getErpBotBaseUrl` |
| **Internal API** | SSE parser, session ID management |
| **Entry Points** | All AI stores |
| **Technology** | TypeScript, fetch, EventSource |
| **Complexity** | High |

---

### MOD-013: `src/ai/` (SUTRA AI — 134 files)

| Field | Value |
|-------|-------|
| **Purpose** | In-ERP conversational AI assistant |
| **Responsibilities** | 22-stage pipeline: intent → RAG → guards → action drafts |
| **Dependencies** | Dexie, optional Ollama, `erpBotClient`, `sutraAiStore` |
| **Dependents** | `SutraAiProvider`, tests |
| **Public API** | `ai/index.ts` (~120 exports): `IntelligenceCore`, handlers, guards, types |
| **Internal API** | `prompts/systemPrompt.ts`, handler chain order |
| **Entry Points** | `IntelligenceCore.processInput()` |
| **Technology** | TypeScript |
| **Complexity** | Very High |

#### MOD-013a: `ai/core/IntelligenceCore.ts`

| Field | Value |
|-------|-------|
| **Purpose** | SUTRA AI orchestration pipeline |
| **Responsibilities** | Route input through 22 stages: language, intent, RAG, LLM, guards, actions |
| **Dependencies** | All ai/ submodules |
| **Dependents** | `sutraAiStore` |
| **Public API** | `IntelligenceCore`, `processInput` |
| **Internal API** | Stage ordering, context assembly |
| **Entry Points** | `sutraAiStore.sendMessage` |
| **Technology** | TypeScript |
| **Complexity** | Very High |

#### MOD-013b: `ai/rag/` (31 handlers)

| Field | Value |
|-------|-------|
| **Purpose** | Rule-based ERP data queries |
| **Responsibilities** | Ledger, stock, khata, invoice, overdue, digest handlers from `ErpRagContext` |
| **Dependencies** | Dexie data via context |
| **Dependents** | IntelligenceCore |
| **Public API** | Per-handler `handle*` functions |
| **Internal API** | Handler registry |
| **Entry Points** | RAG stage in pipeline |
| **Technology** | TypeScript |
| **Complexity** | High |

#### MOD-013c: `ai/learning/SutraAiDexie.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Separate IndexedDB for AI learning data |
| **Responsibilities** | Feedback, LLM cache, sessions, phrase usage |
| **Dependencies** | Dexie |
| **Dependents** | LearningEngine, LlmResponseCache |
| **Public API** | `SutraAiLearning` database instance |
| **Internal API** | Table schemas |
| **Entry Points** | AI interactions |
| **Technology** | Dexie 4 |
| **Complexity** | Medium |

---

### MOD-014: `src/lib/ekhata/` (~40 files)

| Field | Value |
|-------|-------|
| **Purpose** | Client-side e-Khata/Orbix conversational accounting |
| **Responsibilities** | 30+ stage offline router; Qwen streaming; confirm cards; CA drafts |
| **Dependencies** | `lib/nepal-ai/*`, `erpBotClient`, `eKhataStore` |
| **Dependents** | `EKhataProvider`, Playwright e2e |
| **Public API** | `processEKhataMessage`, `confirmKhataEntry`, `index.ts` exports |
| **Internal API** | 30+ `*Brain.ts` modules, `conversationState`, `runtimeMaps` |
| **Entry Points** | `eKhataStore.sendMessage` |
| **Technology** | TypeScript |
| **Complexity** | Very High |

#### MOD-014a: `lib/ekhata/processMessage.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Main e-Khata message router |
| **Responsibilities** | Try offline brains → server fallback → confirm card generation |
| **Dependencies** | All ekhata brains, orbixQwenClient |
| **Dependents** | `eKhataStore` |
| **Public API** | `processEKhataMessage` |
| **Internal API** | Stage try/catch chain |
| **Entry Points** | eKhataStore.sendMessage |
| **Technology** | TypeScript |
| **Complexity** | Very High |

#### MOD-014b: `lib/ekhata/orbixQwenClient.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Streaming Qwen chat to erp_bot |
| **Responsibilities** | SSE stream parsing; session management |
| **Dependencies** | `erpBotClient` |
| **Dependents** | processMessage |
| **Public API** | `streamOrbixQwen` |
| **Internal API** | Stream event parser |
| **Entry Points** | Online path in processMessage |
| **Technology** | TypeScript, SSE |
| **Complexity** | Medium |

---

### MOD-015: `src/lib/falcon/` (~30 files)

| Field | Value |
|-------|-------|
| **Purpose** | Falcon ERP help and navigation assistant |
| **Responsibilities** | Page index search; intent taxonomy; KB answers; optional streaming |
| **Dependencies** | `generatedPageIndex.ts`, `falconBrain.ts`, `erpBotClient` |
| **Dependents** | `FalconProvider`, `falconStore` |
| **Public API** | `askSmartAssistantAsync`, `falconBrain`, KB modules |
| **Internal API** | `engine.ts` (legacy offline), `conversationMemory` |
| **Entry Points** | `falconStore.sendMessage` |
| **Technology** | TypeScript |
| **Complexity** | High |

---

### MOD-016: `src/lib/nepal-ai/` (~40 files)

| Field | Value |
|-------|-------|
| **Purpose** | Offline Nepali NLP lexicons and ERP phrase knowledge |
| **Responsibilities** | Verb normalization, WSD, scenarios, edge cases, safety gate |
| **Dependencies** | `generated/runtimeMaps.ts` (build export) |
| **Dependents** | e-Khata processMessage, SUTRA AI language layer |
| **Public API** | Per-file `match*` / `format*` exports |
| **Internal API** | `runtimeMaps.ts` (8000+ lines generated) |
| **Entry Points** | e-Khata router try* branches |
| **Technology** | TypeScript static data |
| **Complexity** | High |

---

### MOD-017: `src/nios/` (18 files)

| Field | Value |
|-------|-------|
| **Purpose** | NIOS v3 client stubs and HTTP facade |
| **Responsibilities** | Session IDs; niosClient HTTP; event bus; phase-0 stubs |
| **Dependencies** | `erpBotClient`, localStorage |
| **Dependents** | `NiosProvider`, `niosStore` |
| **Public API** | `niosClient`, `session.ts` helpers, types |
| **Internal API** | CognitiveOS, TruthLayer, evidence stubs |
| **Entry Points** | `niosStore.sendMessage` |
| **Technology** | TypeScript |
| **Complexity** | Medium |

#### MOD-017a: `nios/client/niosClient.ts`

| Field | Value |
|-------|-------|
| **Purpose** | HTTP facade for `/nios/v1` endpoints |
| **Responsibilities** | chat, simulate, federation, world-state calls |
| **Dependencies** | `erpBotClient` base URL |
| **Dependents** | niosStore, erpBotClient (when flag on) |
| **Public API** | `niosChat`, `niosSimulate`, `niosFederationQuery` |
| **Internal API** | Request builders |
| **Entry Points** | NIOS chat UI |
| **Technology** | TypeScript, fetch |
| **Complexity** | Medium |

#### MOD-017b: `nios/events/eventBus.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Browser pub/sub for NIOS domain events |
| **Responsibilities** | Emit `voucher.posted`, `invoice.created` to NIOS backend |
| **Dependencies** | CustomEvent API |
| **Dependents** | store posting hooks |
| **Public API** | `emitNiosEvent`, `onNiosEvent` |
| **Internal API** | Event type registry |
| **Entry Points** | Post-invoice journal |
| **Technology** | TypeScript |
| **Complexity** | Low |

---

### MOD-018: `src/components/` (175 files)

| Field | Value |
|-------|-------|
| **Purpose** | Reusable UI components and domain widgets |
| **Responsibilities** | Design system, auth, invoice forms, AI panels, reports, vouchers |
| **Dependencies** | store, lib engines, Radix UI |
| **Dependents** | All pages, App.tsx |
| **Public API** | Exported React components |
| **Internal API** | Sub-component trees |
| **Entry Points** | Page imports |
| **Technology** | React 19, Tailwind 4, Radix UI |
| **Complexity** | Very High |

#### MOD-018a: `components/invoice/SalesInvoiceForm.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Single invoice form for all 4 billing tabs |
| **Responsibilities** | Sales/purchase invoice and return entry and posting |
| **Dependencies** | useStore, accounting, nepalTax |
| **Dependents** | BillingInvoice page |
| **Public API** | `SalesInvoiceForm` component |
| **Internal API** | Line item state, tax calc |
| **Entry Points** | BillingInvoice tabs |
| **Technology** | React |
| **Complexity** | Very High |

#### MOD-018b: `components/ui/` (32 primitives)

| Field | Value |
|-------|-------|
| **Purpose** | Design system UI primitives |
| **Responsibilities** | Button, Select, Dialog, NepaliDatePicker, etc. |
| **Dependencies** | Radix UI, Tailwind, AGENTS.md tokens |
| **Dependents** | All components and pages |
| **Public API** | Per-component exports |
| **Internal API** | CVA variants |
| **Entry Points** | Component imports |
| **Technology** | React, Radix, Tailwind |
| **Complexity** | Medium |

#### MOD-018c: `components/Layout.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Main authenticated app shell |
| **Responsibilities** | Sidebar, topbar, sync loop, AI provider wrappers |
| **Dependencies** | store, syncEngine, AI providers |
| **Dependents** | App.tsx |
| **Public API** | `Layout` component |
| **Internal API** | Provider nesting order |
| **Entry Points** | Authenticated App render |
| **Technology** | React |
| **Complexity** | High |

---

### MOD-019: `src/pages/` (214 files)

| Field | Value |
|-------|-------|
| **Purpose** | ERP screen implementations |
| **Responsibilities** | Masters, transactions, reports, admin, tax, payroll, banking |
| **Dependencies** | useStore, components, lib engines |
| **Dependents** | App.tsx renderPage switch |
| **Public API** | Page React components |
| **Internal API** | Per-page state and filters |
| **Entry Points** | App.tsx route cases (~100 wired) |
| **Technology** | React, TypeScript |
| **Complexity** | Very High |

---

### MOD-020: `src/lib/*Engine.ts` (domain engines)

| Field | Value |
|-------|-------|
| **Purpose** | Specialized business logic engines |
| **Responsibilities** | P&L, balance sheet, stock, payroll, TDS, CBMS, depreciation, etc. |
| **Dependencies** | `lib/db.ts`, `lib/accounting.ts` |
| **Dependents** | Pages, reports, store |
| **Public API** | Per-engine compute functions |
| **Internal API** | Internal aggregation |
| **Entry Points** | Report pages, store actions |
| **Technology** | TypeScript |
| **Complexity** | High (each) |

---

### MOD-021: `serve.mjs`

| Field | Value |
|-------|-------|
| **Purpose** | Production HTTP edge server |
| **Responsibilities** | Static dist; SPA fallback; /erp-bot proxy; health |
| **Dependencies** | `dist/`, `ERP_BOT_BACKEND_URL` |
| **Dependents** | Render deploy, production users |
| **Public API** | HTTP routes (see 07_API_INVENTORY) |
| **Internal API** | `handleErpBotRequest` |
| **Entry Points** | `npm start` |
| **Technology** | Node.js http |
| **Complexity** | Medium |

---

### MOD-022: `src/server.js` (legacy)

| Field | Value |
|-------|-------|
| **Purpose** | Parallel Node Express ERP API |
| **Responsibilities** | Company, fiscal year, backup, audit routes |
| **Dependencies** | `src/db/pool.js`, PostgreSQL |
| **Dependents** | Legacy integrations (limited SPA use) |
| **Public API** | `/api/*` REST |
| **Internal API** | controllers/, routes/ |
| **Entry Points** | Manual start :3001 |
| **Technology** | Express, JavaScript |
| **Complexity** | Medium |

---

## Package: `erp_bot/` — AI Backend (334 files)

---

### MOD-023: `erp_bot/src/api/server.py`

| Field | Value |
|-------|-------|
| **Purpose** | Main FastAPI application |
| **Responsibilities** | Mount all routers; legacy chat/khata; lifespan hooks |
| **Dependencies** | All erp_bot subsystems, optional backend mount |
| **Dependents** | SPA proxy, khata-app, eval scripts |
| **Public API** | All HTTP endpoints (see 07_API_INVENTORY) |
| **Internal API** | `get_kernel`, `get_gateway`, `get_engine` |
| **Entry Points** | `scripts/start.py`, uvicorn |
| **Technology** | FastAPI, Python |
| **Complexity** | Very High |

---

### MOD-024: `erp_bot/src/config.py`

| Field | Value |
|-------|-------|
| **Purpose** | Central environment configuration |
| **Responsibilities** | Model names, paths, thresholds, feature flags |
| **Dependencies** | `os.environ`, `.env` |
| **Dependents** | All erp_bot modules |
| **Public API** | Config dataclass / constants |
| **Internal API** | Default fallbacks |
| **Entry Points** | Import at module load |
| **Technology** | Python |
| **Complexity** | Medium |

---

### MOD-025: `erp_bot/src/nios/` (112 files)

| Field | Value |
|-------|-------|
| **Purpose** | NIOS v3 financial intelligence platform |
| **Responsibilities** | Kernel, gateway, capabilities, federation, governance |
| **Dependencies** | Ollama, Chroma, SQLite/PG, agent fallback |
| **Dependents** | niosClient, erpBotClient |
| **Public API** | `/nios/v1/*` REST |
| **Internal API** | Kernel singleton, plugin loader |
| **Entry Points** | `POST /nios/v1/chat` |
| **Technology** | Python, FastAPI |
| **Complexity** | Very High |

#### MOD-025a: `nios/gateway.py`

| Field | Value |
|-------|-------|
| **Purpose** | Sole NIOS intelligence entry pipeline |
| **Responsibilities** | UIL parse → cognitive OS → route → research → evidence |
| **Dependencies** | kernel, cognitive, intelligence, capabilities, khata |
| **Dependents** | `nios/api.py` |
| **Public API** | `NiosGateway.chat()` |
| **Internal API** | `_route()`, scheduler, cache |
| **Entry Points** | `/nios/v1/chat` |
| **Technology** | Python |
| **Complexity** | Very High |

#### MOD-025b: `nios/kernel/kernel.py`

| Field | Value |
|-------|-------|
| **Purpose** | NIOS kernel singleton |
| **Responsibilities** | Boot, event bus, memory bus, plugin registry, telemetry |
| **Dependencies** | SQLite/PG stores, config |
| **Dependents** | gateway, api, all nios subsystems |
| **Public API** | `get_kernel()`, `NiosKernel` |
| **Internal API** | Boot sequence, registry |
| **Entry Points** | Server lifespan |
| **Technology** | Python |
| **Complexity** | Very High |

#### MOD-025c: `nios/api.py`

| Field | Value |
|-------|-------|
| **Purpose** | NIOS REST router (40+ endpoints) |
| **Responsibilities** | Expose all NIOS capabilities via HTTP |
| **Dependencies** | gateway, kernel, domain engines |
| **Dependents** | niosClient |
| **Public API** | FastAPI router `/nios/v1` |
| **Internal API** | Request/response models |
| **Entry Points** | Mounted on server.py |
| **Technology** | FastAPI |
| **Complexity** | High |

---

### MOD-026: `erp_bot/src/orbix/` (21 files)

| Field | Value |
|-------|-------|
| **Purpose** | Orbix v2 plan→tool→verify agent |
| **Responsibilities** | Bounded tool execution; ledger verification; episodic memory |
| **Dependencies** | Ollama, SQLite memory, Chroma code tools |
| **Dependents** | `/orbix/v2/*`, optional OrbixPanel |
| **Public API** | `/orbix/v2/chat`, `/chat/stream` |
| **Internal API** | `OrbixAgentEngine`, ToolRegistry |
| **Entry Points** | `get_engine().chat()` |
| **Technology** | Python, httpx, aiosqlite |
| **Complexity** | High |

---

### MOD-027: `erp_bot/src/agent/` (15 files)

| Field | Value |
|-------|-------|
| **Purpose** | Legacy Orbix/Falcon chat agent |
| **Responsibilities** | Classify → RAG → intent branch → SSE stream |
| **Dependencies** | Ollama, unified_retriever, khata, nav_resolver |
| **Dependents** | `/chat`, `/chat/stream`, `/orbix/chat/stream` |
| **Public API** | `ask()`, `run_routed_agent_stream()` |
| **Internal API** | cascade_router, intent_router |
| **Entry Points** | Legacy chat endpoints |
| **Technology** | Python, LangChain |
| **Complexity** | High |

---

### MOD-028: `erp_bot/src/conversation/` (4 files)

| Field | Value |
|-------|-------|
| **Purpose** | e-Khata v2 conversation manager |
| **Responsibilities** | Multi-turn orchestration: entry/query/report/education |
| **Dependencies** | nlu, reasoning, bridges, memory, agent, knowledge |
| **Dependents** | `/v2/chat`, `/v2/chat/stream` |
| **Public API** | `ConversationManager.chat()` |
| **Internal API** | `session_store.py`, `utils.py` |
| **Entry Points** | v2 chat routes |
| **Technology** | Python (~1400 lines manager.py) |
| **Complexity** | Very High |

---

### MOD-029: `erp_bot/src/khata/` (11 files)

| Field | Value |
|-------|-------|
| **Purpose** | Khata entry parsing and validation pipeline |
| **Responsibilities** | LLM+regex parse → journal generation → balance check → cards |
| **Dependencies** | Ollama, sector KB |
| **Dependents** | conversation manager, nios, `/khata/*` |
| **Public API** | `parse_khata_entry`, `handle_khata_intent` |
| **Internal API** | khata_chat sessions, feedback_store |
| **Entry Points** | `/khata/chat`, `/khata/parse` |
| **Technology** | Python, Pydantic |
| **Complexity** | Very High |

---

### MOD-030: `erp_bot/src/nlu/` (11 files)

| Field | Value |
|-------|-------|
| **Purpose** | Extended NLU engine for accounting intents |
| **Responsibilities** | Regex→NN→LLM pipeline; hybrid search; clarification |
| **Dependencies** | Chroma nlu_knowledge, Ollama |
| **Dependents** | conversation manager, khata, nios |
| **Public API** | `nlu.engine.parse_entry`, `hybrid_nlu_search` |
| **Internal API** | clarification_planner, compound_entry_batch |
| **Entry Points** | Post-message in conversation pipeline |
| **Technology** | Python |
| **Complexity** | Very High |

---

### MOD-031: `erp_bot/src/reasoning/` (4 files)

| Field | Value |
|-------|-------|
| **Purpose** | LLM journal generation with deterministic verification |
| **Responsibilities** | DEAD CLIC rules; sector templates; chain verify |
| **Dependencies** | Ollama, nepal_accounting_kb |
| **Dependents** | conversation manager, nios, khata |
| **Public API** | `generate_journal_entry`, `JournalEntry` models |
| **Internal API** | journal_verifier_chain |
| **Entry Points** | Post-NLU in pipelines |
| **Technology** | Python, Pydantic |
| **Complexity** | High |

---

### MOD-032: `erp_bot/src/knowledge/` (15 files)

| Field | Value |
|-------|-------|
| **Purpose** | RAG orchestration and unified retrieval |
| **Responsibilities** | Hybrid dense+BM25; multi-source merge; authority scoring |
| **Dependencies** | Chroma collections, Ollama embeddings |
| **Dependents** | agent, nios, orbix, citation_qa, nlu |
| **Public API** | `unified_retriever.retrieve()`, `format_retrieved_context()` |
| **Internal API** | hybrid_rag, knowledge_registry, embed_cache |
| **Entry Points** | Any RAG-needing chat path |
| **Technology** | Python, ChromaDB, rank-bm25 |
| **Complexity** | High |

---

### MOD-033: `erp_bot/src/vectorstore/` (6 files)

| Field | Value |
|-------|-------|
| **Purpose** | ChromaDB collection adapters |
| **Responsibilities** | Per-domain vector stores: codebase, Nepal KB, NLU, CA, nav, grammar |
| **Dependencies** | chromadb, Ollama embed |
| **Dependents** | knowledge/, agent tools, ingest scripts |
| **Public API** | Per-store `search()`, `upsert()` |
| **Internal API** | Collection clients |
| **Entry Points** | Ingest scripts, runtime retrieve |
| **Technology** | ChromaDB |
| **Complexity** | Medium |

---

### MOD-034: `erp_bot/src/ingestion/` (4 files)

| Field | Value |
|-------|-------|
| **Purpose** | ERP codebase scan, chunk, embed for RAG |
| **Responsibilities** | TS/JS scanner; chunker; embedder; index to Chroma |
| **Dependencies** | Chroma erp_codebase, Ollama embed |
| **Dependents** | agent code_qa, `/reindex` |
| **Public API** | `rebuild_index()` |
| **Internal API** | scanner, parser, ts_chunker |
| **Entry Points** | `/reindex`, ingest scripts |
| **Technology** | Python |
| **Complexity** | Medium |

---

### MOD-035: `erp_bot/src/bridges/` (3 files)

| Field | Value |
|-------|-------|
| **Purpose** | Bridge ERP session data to AI server |
| **Responsibilities** | In-memory Dexie snapshot for agent context |
| **Dependencies** | Client-posted erp_context JSON |
| **Dependents** | agent, conversation manager, nios federation |
| **Public API** | `session_data` dict accessors |
| **Internal API** | dexie_bridge |
| **Entry Points** | Chat request body `erp_context` |
| **Technology** | Python |
| **Complexity** | Low |

---

### MOD-036: `erp_bot/src/falcon_trader/` (5 files)

| Field | Value |
|-------|-------|
| **Purpose** | Legacy regex-based Khata NLU |
| **Responsibilities** | Fast regex intent + entity extraction fallback |
| **Dependencies** | None (pure Python) |
| **Dependents** | khata fallback path |
| **Public API** | `parse_khata_message()` |
| **Internal API** | normalizer, intent_classifier, entity_extractor |
| **Entry Points** | Low-confidence NLU fallback |
| **Technology** | Python, regex |
| **Complexity** | Medium |

---

### MOD-037: `erp_bot/scripts/` (66 files)

| Field | Value |
|-------|-------|
| **Purpose** | Ops, ingest, bootstrap, CI test, eval scripts |
| **Responsibilities** | Start server, ingest vectors, export runtime maps, benchmarks |
| **Dependencies** | erp_bot src, Ollama, data files |
| **Dependents** | Build pipeline, CI, ops |
| **Public API** | Shell/Python CLI scripts |
| **Internal API** | Per-script logic |
| **Entry Points** | `start.py`, ingest_*, test_*, eval_* |
| **Technology** | Python, Bash |
| **Complexity** | Medium (aggregate) |

---

## Package: `backend/` — Storage & Knowledge (68 files)

---

### MOD-038: `backend/storage/` (25 files)

| Field | Value |
|-------|-------|
| **Purpose** | Cloudflare R2 object storage abstraction |
| **Responsibilities** | Upload, download, list, delete, CDN URLs, circuit breaker |
| **Dependencies** | `R2_*` env, boto3 |
| **Dependents** | knowledge pipeline, `/storage/health` |
| **Public API** | `upload_file`, `download_bytes`, `delete_file`, `list_objects` |
| **Internal API** | `R2StorageService`, `StorageContainer`, circuit_breaker |
| **Entry Points** | Knowledge orchestrator |
| **Technology** | Python, boto3, S3 API |
| **Complexity** | High |

---

### MOD-039: `backend/knowledge/` (22 files)

| Field | Value |
|-------|-------|
| **Purpose** | Tenant document ingestion and search pipeline |
| **Responsibilities** | Upload → R2 → extract → chunk → embed → Chroma → PG metadata |
| **Dependencies** | PostgreSQL, R2, Chroma, Ollama embed |
| **Dependents** | NIOS federation, `/knowledge/v1/*` |
| **Public API** | `/knowledge/v1/documents`, `/search` |
| **Internal API** | orchestrator, repository, worker thread |
| **Entry Points** | `POST /knowledge/v1/documents` |
| **Technology** | Python, FastAPI mount |
| **Complexity** | High |

#### MOD-039a: `knowledge/pipeline/orchestrator.py`

| Field | Value |
|-------|-------|
| **Purpose** | Document ingestion orchestrator |
| **Responsibilities** | Job lifecycle: queued → extracting → chunking → embedding → indexed |
| **Dependencies** | R2, PG repository, Chroma adapter, extractors |
| **Dependents** | API, worker thread |
| **Public API** | `process_job(document_id)` |
| **Internal API** | Stage transitions, retry logic |
| **Entry Points** | Worker dequeue |
| **Technology** | Python |
| **Complexity** | High |

---

### MOD-040: `backend/api/health_routes.py`

| Field | Value |
|-------|-------|
| **Purpose** | Storage health check endpoint |
| **Responsibilities** | Verify R2 connectivity |
| **Dependencies** | backend/storage |
| **Dependents** | Ops monitoring |
| **Public API** | `GET /storage/health` |
| **Internal API** | Health probe logic |
| **Entry Points** | Mounted on erp_bot server |
| **Technology** | FastAPI |
| **Complexity** | Low |

---

## Package: `packages/backend/` — Cloud API (16 files)

---

### MOD-041: `packages/backend/src/server.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Express application entry |
| **Responsibilities** | Mount routes; middleware stack; listen |
| **Dependencies** | routes/, middleware/, lib/ |
| **Dependents** | syncEngine, khata-app |
| **Public API** | HTTP `/api/*` |
| **Internal API** | App configuration |
| **Entry Points** | `npm run dev`, `npm start` |
| **Technology** | Express 5, TypeScript |
| **Complexity** | Medium |

---

### MOD-042: `packages/backend/src/routes/auth.ts`

| Field | Value |
|-------|-------|
| **Purpose** | JWT authentication routes |
| **Responsibilities** | Login, refresh, logout; session in Redis |
| **Dependencies** | PostgreSQL users, Redis, bcrypt, JWT |
| **Dependents** | Protected routes |
| **Public API** | `POST /api/auth/login|refresh|logout` |
| **Internal API** | Token generation, session hash |
| **Entry Points** | Auth middleware chain |
| **Technology** | Express, jsonwebtoken |
| **Complexity** | Medium |

---

### MOD-043: `packages/backend/src/routes/sync.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Cloud sync pull/push |
| **Responsibilities** | Incremental pull since timestamp; batch upsert push |
| **Dependencies** | syncHandlers, syncPull, PostgreSQL |
| **Dependents** | `syncEngine.ts` |
| **Public API** | `GET /api/sync/pull`, `POST /api/sync/push` |
| **Internal API** | Table mapping, conflict rules |
| **Entry Points** | syncEngine loop |
| **Technology** | Express, pg |
| **Complexity** | High |

---

### MOD-044: `packages/backend/src/routes/khata.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Mobile Khata REST API |
| **Responsibilities** | NLU transaction → draft voucher; confirm post; balance; insights |
| **Dependencies** | PostgreSQL, falconNlu subprocess |
| **Dependents** | khata-app |
| **Public API** | `/api/khata/transaction|confirm|balance|insights|payment-webhook` |
| **Internal API** | Voucher type mapping, KH-* COA |
| **Entry Points** | khata-app API calls |
| **Technology** | Express, pg |
| **Complexity** | High |

---

### MOD-045: `packages/backend/src/lib/falconNlu.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Python NLU subprocess bridge |
| **Responsibilities** | Spawn erp_bot NLU for khata transaction parsing |
| **Dependencies** | Python 3, erp_bot nlu module |
| **Dependents** | khata routes |
| **Public API** | `parseKhataMessage(text)` |
| **Internal API** | subprocess spawn, JSON IPC |
| **Entry Points** | khata/transaction route |
| **Technology** | TypeScript, child_process |
| **Complexity** | Medium |

---

### MOD-046: `packages/backend/src/db/schema.sql`

| Field | Value |
|-------|-------|
| **Purpose** | PostgreSQL canonical cloud ERP schema |
| **Responsibilities** | ~42 tables + Khata extensions; immutability triggers |
| **Dependencies** | PostgreSQL 15 |
| **Dependents** | All packages/backend routes |
| **Public API** | SQL DDL |
| **Internal API** | Khata migrations |
| **Entry Points** | `npm run migrate` |
| **Technology** | PostgreSQL SQL |
| **Complexity** | Very High |

---

## Package: `khata-app/` — Mobile Khata (31 files)

---

### MOD-047: `khata-app/src/App.tsx`

| Field | Value |
|-------|-------|
| **Purpose** | Chat-first mobile Khata application |
| **Responsibilities** | Onboarding; chat UI; offline queue; payment reconcile |
| **Dependencies** | khataApi, offlineQueue, ChatWindow |
| **Dependents** | Mobile users |
| **Public API** | `App` component |
| **Internal API** | Auth state, tenant config |
| **Entry Points** | `main.tsx` |
| **Technology** | React, Capacitor |
| **Complexity** | Medium |

---

### MOD-048: `khata-app/src/api/khataApi.ts`

| Field | Value |
|-------|-------|
| **Purpose** | REST client for packages/backend Khata API |
| **Responsibilities** | transaction, confirm, balance, insights calls |
| **Dependencies** | `VITE_API_BASE` |
| **Dependents** | App.tsx, ChatWindow |
| **Public API** | `postTransaction`, `confirmEntry`, `getBalance` |
| **Internal API** | Request builders |
| **Entry Points** | Chat message send |
| **Technology** | TypeScript, fetch |
| **Complexity** | Medium |

---

### MOD-049: `khata-app/src/lib/offlineQueue.ts`

| Field | Value |
|-------|-------|
| **Purpose** | IndexedDB offline confirm queue |
| **Responsibilities** | Queue confirms when offline; replay on reconnect |
| **Dependencies** | IndexedDB `mobile-khata-offline` |
| **Dependents** | App.tsx, service worker |
| **Public API** | `enqueue`, `flushQueue` |
| **Internal API** | IDB schema |
| **Entry Points** | Offline confirm action |
| **Technology** | IndexedDB |
| **Complexity** | Medium |

---

### MOD-050: `khata-app/public/sw.js`

| Field | Value |
|-------|-------|
| **Purpose** | Service worker for PWA offline |
| **Responsibilities** | Cache assets; background sync for offline queue |
| **Dependencies** | Cache API, offlineQueue |
| **Dependents** | PWA install |
| **Public API** | SW lifecycle events |
| **Internal API** | Cache strategies |
| **Entry Points** | Browser SW registration |
| **Technology** | JavaScript Service Worker |
| **Complexity** | Medium |

---

## Package: `scripts/` — Root Build & Test (31 files)

---

### MOD-051: `scripts/render-build.sh`

| Field | Value |
|-------|-------|
| **Purpose** | Render.com CI build script |
| **Responsibilities** | npm install; npm run build |
| **Dependencies** | package.json, Python (runtime maps) |
| **Dependents** | Render deploy |
| **Public API** | Shell script |
| **Internal API** | — |
| **Entry Points** | render.yaml buildCommand |
| **Technology** | Bash |
| **Complexity** | Low |

---

### MOD-052: `scripts/build-falcon-page-index.mjs`

| Field | Value |
|-------|-------|
| **Purpose** | Generate Falcon ERP page index |
| **Responsibilities** | Scan pages/components → `generatedPageIndex.ts` |
| **Dependencies** | src/ file tree |
| **Dependents** | Falcon brain, npm run build |
| **Public API** | Node script |
| **Internal API** | File walker |
| **Entry Points** | `npm run build`, `npm run falcon:index` |
| **Technology** | Node.js ESM |
| **Complexity** | Medium |

---

### MOD-053: `scripts/test-ekhata-*.ts` (10+ files)

| Field | Value |
|-------|-------|
| **Purpose** | e-Khata automated test suites |
| **Responsibilities** | Language, CA entries, brain, framework, benchmark tests |
| **Dependencies** | lib/ekhata, optional erp_bot |
| **Dependents** | CI (ekhata-ci.yml) |
| **Public API** | npm scripts `test:ekhata*` |
| **Internal API** | Test fixtures |
| **Entry Points** | `npm run test:ekhata-*` |
| **Technology** | TypeScript, tsx |
| **Complexity** | Medium (each) |

---

## Package: `e2e/` — Playwright (2 specs)

---

### MOD-054: `e2e/ekhata-panel.spec.ts`

| Field | Value |
|-------|-------|
| **Purpose** | End-to-end e-Khata panel tests |
| **Responsibilities** | Browser automation of e-Khata chat flows |
| **Dependencies** | Playwright, Vite dev/preview |
| **Dependents** | CI ekhata-ci.yml |
| **Public API** | Playwright test spec |
| **Internal API** | helpers/indexedDb.ts |
| **Entry Points** | `npm run test:e2e:ekhata` |
| **Technology** | Playwright |
| **Complexity** | Medium |

---

## Package: `nios/` — Root Contracts (docs only)

---

### MOD-055: `nios/contracts/`

| Field | Value |
|-------|-------|
| **Purpose** | NIOS platform contract definitions |
| **Responsibilities** | Shared type contracts between client and server |
| **Dependencies** | None (static) |
| **Dependents** | Documentation, future codegen |
| **Public API** | Contract JSON/TS files |
| **Internal API** | — |
| **Entry Points** | Reference only |
| **Technology** | JSON, Markdown |
| **Complexity** | Low |

---

## Module Index by Complexity

| Complexity | Module IDs |
|------------|------------|
| **Very High** | MOD-002, MOD-003, MOD-005, MOD-009, MOD-010, MOD-013, MOD-013a, MOD-014, MOD-014a, MOD-018, MOD-018a, MOD-019, MOD-023, MOD-025, MOD-025a, MOD-025b, MOD-028, MOD-029, MOD-030, MOD-046 |
| **High** | MOD-004, MOD-007, MOD-011, MOD-012, MOD-015, MOD-016, MOD-017, MOD-018c, MOD-020, MOD-027, MOD-031, MOD-032, MOD-038, MOD-039, MOD-039a, MOD-043, MOD-044 |
| **Medium** | MOD-006, MOD-008, MOD-013c, MOD-014b, MOD-017a, MOD-018b, MOD-021, MOD-022, MOD-024, MOD-033, MOD-034, MOD-036, MOD-037, MOD-041, MOD-042, MOD-045, MOD-047–050, MOD-052–054 |
| **Low** | MOD-001, MOD-017b, MOD-040, MOD-051, MOD-055 |

---

## Module Dependency Hotspots

| Module | Fan-in | Role |
|--------|--------|------|
| MOD-003 `store/index.ts` | Very High | God store |
| MOD-009 `lib/db.ts` | Very High | All persistence |
| MOD-010 `lib/accounting.ts` | High | All financial logic |
| MOD-023 `server.py` | High | AI HTTP hub |
| MOD-025a `gateway.py` | High | NIOS intelligence hub |
| MOD-032 `unified_retriever` | High | RAG hub |
| MOD-028 `conversation/manager` | High | e-Khata v2 hub |
