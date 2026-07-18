# MAI-00 Runtime Flow (actual code paths)

Diagrams reflect **current checkout behavior**, not only the target master architecture.

Trust boundaries:

- Browser (untrusted client) ↔ Node `serve.mjs` / optional `packages/backend`
- Browser ↔ Python `erp_bot` via `/erp-bot` reverse proxy
- Python providers (Groq/Ollama) — external LLM boundary
- Dexie IndexedDB — local ledger authority (Model B)
- Postgres — sync / khata-app authority

---

## A. Active read / answer pipeline

```mermaid
flowchart TD
  UI["OrbixWorkspace / eKhataStore.sendMessage"] --> Client["orbixQwenClient.streamOrbixQwenChat"]
  Client --> Proxy["serve.mjs /erp-bot proxy"]
  Proxy --> SSE["POST /orbix/chat/stream<br/>erp_bot api/server.py"]
  SSE --> Ingress["oip_chat_ingress.submit_chat / stream_orbix_kernel_events"]
  Ingress --> Gate{"oip_chat_enabled?<br/>OIP_ENABLED ∧ ORCHESTRATOR ∧ PROVIDER_RUNTIME"}
  Gate -->|yes| Kernel["IntelligenceKernelFacade.submit"]
  Gate -->|no| Legacy["agent_builder / conversation.manager<br/>LEGACY paths"]
  Kernel --> Orch["OrchestratorService.execute_workflow"]
  Orch --> Stages["Validation → Conversation → Session<br/>→ Planning → Routing → Knowledge → Memory"]
  Stages --> Exec["ExecutionStageAdapter"]
  Exec --> Pre["preprocess_erp_message<br/>shop NLU + mode_aware_erp + regex"]
  Pre -->|skip_llm| Card["Typed card / draft / report response_ref"]
  Pre -->|need LLM| Ground["build_prompt_grounding + np_kb_adapter"]
  Ground --> Prov["Provider Runtime<br/>Groq / Ollama / stubs"]
  Card --> Qual["Quality stage"]
  Prov --> Qual
  Qual --> Stream["Streaming finalize"]
  Stream --> UI2["OrbixResponseRenderer / cards"]

  subgraph disconnected ["Mounted but not primary SPA path"]
    NIOS["/nios/v1 → nios.gateway"]
    OrbixV2["/orbix/v2 → OrbixAgentEngine Ollama"]
    V2["/v2/chat → conversation.manager"]
    OipHttp["/oip/v1 routers<br/>IMPORT BROKEN in this checkout"]
  end
```

### Notes

1. **OIP `/oip/v1` HTTP mount fails** in this environment because
   `erp_bot/src/oip/modules/planner/api/router.py` imports
   `...application.commands` which resolves to missing
   `src.oip.modules.application` (should be `..application`).
   Chat ingress still imports when `oip_chat_enabled()` is true; container is
   async via `get_container()`.
2. Deterministic preprocess frequently returns without calling a provider.
3. Ask mode policy is enforced in mode-aware ERP and frontend confirm gates —
   incomplete as executable global constitution (MAI-01).

---

## B. Active mutation pipeline (product path)

```mermaid
flowchart TD
  Card["Confirmation card in UI"] --> ConfirmBtn["User clicks Confirm<br/>confirmPending"]
  ConfirmBtn --> Mode{"orbixMode === accountant<br/>+ permissions?"}
  Mode -->|no| Deny["ModeRestriction / deny"]
  Mode -->|yes| Exec["executeOrbixConfirm<br/>orbixPostingService.ts"]
  Exec --> Domains{"Intent family"}
  Domains --> Pur["postPurchaseTransaction"]
  Domains --> Sale["postSalesTransaction"]
  Domains --> Adj["post*AdjustmentTransaction"]
  Domains --> Set["postPayment/Receipt/Contra/Journal"]
  Domains --> Khata["confirmKhataViaProposal → confirmKhataEntry"]
  Domains --> Treas["treasury engines"]
  Pur --> Dexie[(Dexie IndexedDB vouchers/stock/audit)]
  Sale --> Dexie
  Adj --> Dexie
  Set --> Dexie
  Khata --> Dexie
  Treas --> Dexie
  Dexie --> EQ["eventSyncQueue enqueue"]
  Exec -.-> Ack["POST /orbix/drafts/{id}/mark-posted<br/>draft status only Model B"]
  EQ --> Sync["syncCoordinator → packages/backend<br/>/api/sync/events"]
  Sync --> PG[(Postgres)]

  subgraph bypass ["Parallel / legacy mutation paths"]
    AddV["voucherSlice.addVoucher + pages"]
    KhataAPI["POST /api/khata/confirm<br/>UNAUTH body tenant/company"]
    LegacyPush["syncOutbox → /api/sync/push"]
    OEC["ActionRuntime → ERPCommandPort → OEC<br/>PARTIAL — not Orbix UI day path"]
  end
  AddV --> Dexie
  KhataAPI --> PG
  LegacyPush --> PG
```

### OEC-only verdict (for diagrams)

**Disproved for primary Orbix/Sutra ledger writes.** OEC is a real Python
module and orchestrator stage, but Dexie Model B + Node khata/sync are the
live writers.

---

## C. Active RAG / knowledge path

```mermaid
flowchart LR
  Zip["Knowledge source/*.zip"] --> Pipe["knowledgebase/scripts pipeline"]
  Pipe --> Idx["knowledgebase/indexes/lexical<br/>kb_lexical.sqlite (+ optional semantic)"]
  Idx --> Adapter["nlu/np_kb_adapter"]
  Adapter --> Ground["prompt_grounding / hybrid_nlu"]
  Adapter --> ExecLLM["Provider prompts when skip_llm false"]

  Chroma["erp_bot vectorstore Chroma<br/>often Ollama embeddings"] --> Hybrid["knowledge/hybrid_rag"]
  Hybrid -.-> LocalOnly["Local/dev; Render skips Ollama ingest"]
```

Language zips are **offline inputs**, not loaded into prompts wholesale at chat time.

---

## D. Sync overview

```mermaid
flowchart LR
  Dexie[(Dexie)] --> E1["eventSyncQueue"]
  Dexie --> E2["syncOutbox legacy"]
  E1 --> API1["/api/sync/events/*"]
  E2 --> API2["/api/sync/push"]
  API1 --> PG[(Postgres)]
  API2 --> PG
  Remote["pull/applyRemoteEvent"] --> Dexie
```

Accounting entities are blocked from legacy outbox via `syncEnqueueRouter`
(intended), while domain posts use event sync.

---

## Legacy / duplicate paths (summary)

| Path | Status |
|------|--------|
| `/nios/v1` | Mounted if imports succeed; parallel Cognitive/Multi-agent |
| `/orbix/v2` | Ollama agent loop; not SPA Orbix SSE target |
| `/v2/chat`, `/khata/*` | Legacy e-Khata endpoints |
| Falcon TS panel | ERP help NLP, not posting authority |
| Action→OEC | Implemented; not sole product mutation path |
| `/oip/v1` module routers | Present in tree; **cannot mount** due to planner import bug in this checkout |
