# 05 — AI System Inventory

**Project:** Sutra ERP  
**Generated:** 2026-07-10

---

## AI Architecture Overview

Four client-side AI stacks + three server-side intelligence stacks, sharing Ollama, ChromaDB, and khata NLU pipelines.

| Stack | Client | Server | Feature Flag |
|-------|--------|--------|--------------|
| SUTRA AI | `src/ai/` | Ollama local / erp_bot | Hidden when NIOS on |
| Falcon | `src/lib/falcon/` | erp_bot agent / offline KB | Hidden when NIOS on |
| e-Khata / Orbix | `src/lib/ekhata/` | erp_bot Qwen stream / local brains | Hidden when NIOS on |
| NIOS v3 | `src/nios/` | `erp_bot/src/nios/` | `VITE_NIOS_PLATFORM_V3` |
| Orbix v2 (server) | `src/lib/orbix/` (alt UI) | `erp_bot/src/orbix/` | Independent |
| Legacy Agent | — | `erp_bot/src/agent/` | `/chat`, `/orbix/chat/stream` |

---

## AI-01: SUTRA AI (`src/ai/`)

| Field | Value |
|-------|-------|
| **Purpose** | In-ERP conversational assistant for transactions, queries, and navigation drafts |
| **Responsibilities** | Intent classification; RAG over ERP context; guards; action drafts to invoice/khata/party pages |
| **Dependencies** | `sutraAiStore`, `IntelligenceCore`, Dexie via `KhataRagProvider`, optional Ollama/`erpBotClient` |
| **Dependents** | `SutraAiProvider`, `AIChat.tsx`, mobile Layout |
| **Public API** | `src/ai/index.ts` (~120 exports): `IntelligenceCore`, handlers, guards, types |
| **Internal API** | `prompts/systemPrompt.ts`, `SutraAiDexie`, handler chain order in `IntelligenceCore` |
| **Entry Points** | `IntelligenceCore.processInput()`; Ctrl+Shift+A |
| **Technology** | TypeScript, Dexie, optional Ollama via `OllamaClient` |
| **Complexity** | Very High |

### SUTRA AI Submodules

| Module | Purpose | Complexity |
|--------|---------|------------|
| `core/IntelligenceCore.ts` | 22-stage pipeline orchestrator | Very High |
| `rag/*` (31 handlers) | Rule-based ERP queries from `ErpRagContext` | High |
| `routing/ShortcutRouter.ts` | `/help`, `/balance`, slash commands | Medium |
| `routing/HybridLlmRouter.ts` | When to call LLM vs rule path | Medium |
| `guard/*` | Duplicate, stock, credit limit, confirmation | Medium |
| `actions/*` | sessionStorage drafts to ERP forms | Medium |
| `learning/*` | Feedback, LLM cache, session memory | Medium |
| `language/*` | Nepali/English/Roman detection and translation | Medium |
| `interface/AIChat.tsx` | Chat UI component | Medium |

---

## AI-02: Falcon (`src/lib/falcon/` + `erp_bot/src/agent/`)

| Field | Value |
|-------|-------|
| **Purpose** | ERP help, navigation, and how-to assistant (Orbix brand alias on server) |
| **Responsibilities** | Page index search; intent taxonomy; KB answers; optional erp_bot streaming |
| **Dependencies** | `generatedPageIndex.ts`, `falconBrain.ts`, `erpBotClient`, `falconStore` |
| **Dependents** | `FalconProvider`, `FalconPanel` |
| **Public API** | `askSmartAssistantAsync`, `falconBrain`, `intentTaxonomy`, KB modules |
| **Internal API** | `engine.ts` (legacy offline), `conversationMemory` (module-global) |
| **Entry Points** | `falconStore.sendMessage`; Falcon launcher UI |
| **Technology** | TypeScript; server: LangChain + Ollama |
| **Complexity** | High |

### Falcon Server (agent/)

| Module | Purpose |
|--------|---------|
| `agent_builder.py` | Main chat: classify → RAG → stream |
| `cascade_router.py` | 4b/32b/none model tier selection |
| `intent_router.py` | Intent classification (regex + LLM) |
| `unified_tools.py` | LangChain tools: RAG, nav, ledger |
| `nav_resolver.py` | ERP screen navigation from source index |

---

## AI-03: e-Khata / Orbix Client (`src/lib/ekhata/`)

| Field | Value |
|-------|-------|
| **Purpose** | Nepali conversational accounting entry (udhaar, khata, CA journal drafts) |
| **Responsibilities** | 30+ stage offline router; Qwen streaming; confirm cards; report queries |
| **Dependencies** | `eKhataStore`, `processMessage.ts`, `lib/nepal-ai/*`, `erpBotClient`/`orbixQwenClient` |
| **Dependents** | `EKhataProvider`, `EKhataPanel`, Playwright e2e |
| **Public API** | `processEKhataMessage`, `confirmKhataEntry`, `index.ts` exports |
| **Internal API** | Individual `*Brain.ts` modules, `conversationState`, `runtimeMaps.ts` |
| **Entry Points** | `eKhataStore.sendMessage`; Ctrl+Shift+K |
| **Technology** | TypeScript; server: khata + nlu + Ollama |
| **Complexity** | Very High |

### e-Khata Brain Modules (selected)

| Brain | Responsibility |
|-------|----------------|
| `humanSemanticBrain.ts` | Frame semantics, ontology |
| `accountingLanguageBrain.ts` | Bilingual accounting Q&A |
| `caEntryEngine.ts` | CA journal draft generation |
| `orbixQwenClient.ts` | Qwen3 streaming to erp_bot |
| `orbixLocalEngine.ts` | Deterministic shortcuts offline |
| `orbixReportEngine.ts` | Chat-triggered financial reports |
| `unifiedIntelligence.ts` | Semantic orchestrator |

---

## AI-04: NIOS v3 (`erp_bot/src/nios/` + `src/nios/`)

| Field | Value |
|-------|-------|
| **Purpose** | Nepal Intelligence Operating System — unified financial intelligence platform |
| **Responsibilities** | Kernel orchestration; 200+ capabilities; federation; evidence; governance |
| **Dependencies** | Ollama, Chroma, SQLite/PG memory, agent cascade fallback, backend knowledge |
| **Dependents** | `NiosProvider`, `niosClient`, `erpBotClient` (when flag on) |
| **Public API** | `/nios/v1/*` (40+ endpoints); client: `niosChat`, `niosSimulate` |
| **Internal API** | `NiosKernel`, `NiosGateway`, `capability_runtime`, `plugin_loader` |
| **Entry Points** | `POST /nios/v1/chat`; `get_gateway().chat()` |
| **Technology** | Python FastAPI; client TypeScript stubs |
| **Complexity** | Very High |

### NIOS Server Subsystems

| Subsystem | Key Modules | Responsibility |
|-----------|-------------|----------------|
| Kernel | `kernel/kernel.py` | Singleton boot, event bus, memory bus |
| Gateway | `gateway.py` | Sole intelligence entry pipeline |
| Cognitive | `cognitive/cognitive_os.py` | Meta-decide, uncertainty, retry |
| Intelligence | `research_loop.py`, `evidence_verify.py` | RAG loop, evidence bundles |
| Capabilities | `capabilities/runtime.py`, `top50.py` | 7-stage contract executor |
| Federation | `knowledge/federation.py` | Multi-source knowledge adapters |
| Execution | `execution/*` | Tax, ERP, simulation engines |
| Domains | `domains/legal`, `investment`, `consultant` | Phase 6 plugins |
| Governance | `governance/*` | Audit, approvals, quality gates |

### NIOS Client (`src/nios/`)

| Module | Purpose | Maturity |
|--------|---------|----------|
| `session.ts` | Unified session/tenant IDs | Active |
| `client/niosClient.ts` | HTTP facade | Active |
| `events/eventBus.ts` | voucher.posted events | Active |
| `cognitive/CognitiveOS.ts` | Meta-decision stub | Phase 0 |
| `representations/*` | UIL parser, world state stubs | Phase 0 |

---

## AI-05: Orbix v2 Agent (`erp_bot/src/orbix/`)

| Field | Value |
|-------|-------|
| **Purpose** | Plan → tool → verify agentic loop with memory |
| **Responsibilities** | Bounded tool execution; ledger math verification; episodic memory |
| **Dependencies** | Ollama (`OllamaClient`), SQLite `MemoryStore`, Chroma code tools |
| **Dependents** | `/orbix/v2/chat`; optional `OrbixPanel` UI |
| **Public API** | `/orbix/v2/status`, `/chat`, `/chat/stream`, `/reindex`, `/memory/forget` |
| **Internal API** | `OrbixAgentEngine`, `ToolRegistry`, `planner`, `verifier`, `answerer` |
| **Entry Points** | `get_engine().chat()` |
| **Technology** | Python, httpx async, aiosqlite |
| **Complexity** | High |

---

## AI-06: Khata NLU Pipeline (`erp_bot/src/khata/`, `nlu/`, `falcon_trader/`)

| Field | Value |
|-------|-------|
| **Purpose** | Natural language → structured journal entry |
| **Responsibilities** | Parse, validate Dr=Cr, confirmation cards, multi-turn clarification |
| **Dependencies** | Ollama, sector KB, `hybrid_nlu_search`, `accounting_reasoner` |
| **Dependents** | All AI stacks, mobile Khata API, conversation manager |
| **Public API** | `parse_khata_entry`, `handle_khata_intent`, `nlu.engine.parse_entry` |
| **Internal API** | `khata_chat` sessions, `clarification_planner`, `compound_entry_batch` |
| **Entry Points** | `/khata/chat`, `/khata/parse`, `/v2/chat`, NIOS gateway khata route |
| **Technology** | Python, Pydantic, regex + NN + LLM |
| **Complexity** | Very High |

---

## AI-07: RAG / Retrieval (`erp_bot/src/knowledge/`, `vectorstore/`)

| Field | Value |
|-------|-------|
| **Purpose** | Multi-source retrieval for accounting Q&A and NLU |
| **Responsibilities** | Hybrid dense+BM25; unified merge; authority scoring; embed cache |
| **Dependencies** | ChromaDB, Ollama embeddings, markdown/json corpora |
| **Dependents** | agent, nios, orbix, citation_qa, nlu |
| **Public API** | `unified_retriever.retrieve()`, `format_retrieved_context()` |
| **Internal API** | `hybrid_rag`, `knowledge_registry`, per-store adapters |
| **Entry Points** | Any RAG-needing chat path |
| **Technology** | ChromaDB, rank-bm25, LangChain embeddings |
| **Complexity** | High |

### Chroma Collections

| Collection | Store Module | Content |
|------------|--------------|---------|
| `erp_codebase` | `chroma_store.py` | TS/JS ERP source chunks |
| `nepal_knowledge` | `nepal_knowledge_store.py` | Nepal tax/accounting markdown |
| `ca_knowledge` | `ca_knowledge_store.py` | IFRS conceptual framework |
| `nlu_knowledge` | `nlu_knowledge_store.py` | Sector NLU training examples |
| `nav_index` | `nav_index_store.py` | UI routes/components |
| `nepali_grammar` | `nepali_grammar_store.py` | Grammar reference |
| `tenant_documents` | `backend/knowledge/adapters/chroma_store.py` | Uploaded tenant docs |

---

## AI-08: Conversation Manager v2 (`erp_bot/src/conversation/`)

| Field | Value |
|-------|-------|
| **Purpose** | Multi-turn chat orchestration for e-Khata v2 API |
| **Responsibilities** | Route entry/query/report/education; NLU→reason→verify; agent tools |
| **Dependencies** | nlu, reasoning, bridges, memory, intelligence, agent, knowledge |
| **Dependents** | `POST /v2/chat`, `POST /v2/chat/stream` |
| **Public API** | `ConversationManager.chat()` |
| **Internal API** | `session_store.py`, `utils.py` |
| **Entry Points** | `api/streaming.py`, `/v2/chat` routes |
| **Technology** | Python (~1400 lines manager.py) |
| **Complexity** | Very High |

---

## AI-09: Reasoning / Journal (`erp_bot/src/reasoning/`)

| Field | Value |
|-------|-------|
| **Purpose** | LLM + template journal generation with deterministic verification |
| **Responsibilities** | DEAD CLIC rules; sector templates; chain verify; balance checks |
| **Dependencies** | Ollama, `nepal_accounting_kb`, `sector_journal_templates` |
| **Dependents** | conversation manager, nios, khata, compound batch |
| **Public API** | `generate_journal_entry`, `JournalEntry` models, `chain_verify` |
| **Internal API** | `journal_verifier_chain`, template fast-path |
| **Entry Points** | Post-NLU in conversation and khata pipelines |
| **Technology** | Python, Pydantic, LangChain Ollama |
| **Complexity** | High |

---

## AI-10: Nepal AI Static Knowledge (`src/lib/nepal-ai/`, `src/data/`)

| Field | Value |
|-------|-------|
| **Purpose** | Offline Nepali NLP lexicons and ERP phrase knowledge |
| **Responsibilities** | Verb normalization, WSD, scenarios, edge cases, safety gate |
| **Dependencies** | `generated/runtimeMaps.ts` (build export), static JSON in `src/data/` |
| **Dependents** | `processMessage.ts`, e-Khata brains, SUTRA AI language layer |
| **Public API** | Per-file `match*` / `format*` exports |
| **Internal API** | `runtimeMaps.ts` (8000+ lines generated) |
| **Entry Points** | Invoked from e-Khata router try* branches |
| **Technology** | TypeScript static data |
| **Complexity** | High (volume) |

---

## AI-11: Training / Model Artifacts (`erp_bot/training/`)

| Field | Value |
|-------|-------|
| **Purpose** | QLoRA fine-tuning for `orbix-nepali` Ollama model |
| **Responsibilities** | Corpus convert, train, merge, evaluate, Modelfile export |
| **Dependencies** | e-Khata training JSONL, GPU, HuggingFace stack |
| **Dependents** | Optional custom Ollama model |
| **Public API** | Shell scripts: `train_ekhata_lora.sh`, `export_to_ollama.sh` |
| **Internal API** | `qlora/train_trl.py`, `convert_corpus.py` |
| **Entry Points** | Manual training runs |
| **Technology** | Python QLoRA, Ollama Modelfile |
| **Complexity** | Medium (ops) |

---

## AI Model Configuration

| Model | Role | Config Source |
|-------|------|---------------|
| `qwen3:32b` | Conversational brain | `CONVERSATIONAL_MODEL` |
| `qwen3:4b` | Router, fast extraction | `FAST_MODEL_NAME` |
| `nomic-embed-text` | Embeddings | `EMBED_MODEL` |
| `ORBIX_AGENT_MODEL` | Orbix planner | `.env` ORBIX_* |
| `orbix-nepali` | Fine-tuned (optional) | training/qlora |

---

## AI Request Flow Summary

```
User message
  → [Client] AI store selects stack (NIOS flag gates legacy UIs)
  → [Client] erpBotClient / niosClient / local brain
  → [Edge] serve.mjs /erp-bot proxy
  → [Server] erp_bot route:
       /nios/v1/chat     → NiosGateway (primary when flag on)
       /chat/stream      → agent_builder (legacy Falcon)
       /orbix/v2/chat    → OrbixAgentEngine
       /v2/chat          → ConversationManager
       /khata/chat       → khata_chat (legacy)
  → [Inference] Ollama + Chroma RAG + deterministic engines
  → [Response] SSE stream or JSON + confirmation cards
```

---

## AI Graph: Citation & Evidence

| Layer | Client | Server |
|-------|--------|--------|
| Citation QA | — | `knowledge/citation_qa.py` |
| Evidence bundle | `nios/intelligence/evidenceEngine.ts` (stub) | `evidence_engine.py`, `evidence_verify.py` |
| Provenance | — | `provenance_graph.py` (SQLite) |
| Truth layer | `TruthLayer.ts` (stub) | `truth_layer.py` |
| Orbix verifier | — | `orbix/reasoning/verifier.py` |
