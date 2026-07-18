# MAI-00 — Complete Repository and Authority Audit

**Phase:** MAI-00  
**Audited at:** 2026-07-14  
**Commit:** `ab08b89b0d9e0f327db3746ff4aecf8d0fff5f37` (`main`)  
**Verdict:** **PASSED** (architecture audit only; production runtime unchanged)

---

## 1. Executive verdict

This repository is a real Git monorepo (~25k tracked-eligible files excluding `.git`/`node_modules`/`dist`) containing:

1. **Sutra/MokXya ERP SPA** (Vite/React/Dexie) as the primary offline-first accounting UI.
2. **Python `erp_bot` FastAPI** as the AI chat brain (Orbix SSE → OIP orchestrator when flags enable).
3. **Node `packages/backend`** for Postgres sync and khata confirm (including an unauthenticated confirm route).
4. **Offline Nepali language KB pipeline** (`knowledgebase/`) feeding lexical indexes — zips under `Knowledge source/` are not loaded at chat time.

**What is truly active for product Orbix chat:** deterministic ERP preprocess (`nepali_shop_nlu` → `mode_aware_erp` → khata drafts) inside OIP execution, with Groq Provider Runtime when LLM is needed; UI posts via **Dexie Model B** (`executeOrbixConfirm`), not OEC.

**OEC is not the sole mutation authority.** Action Runtime → ERPCommandPort → OEC exists as Python infrastructure but is not the day-to-day Orbix ledger write path.

**Largest launch risks:** unauthenticated `/api/khata/confirm`; weak OIP auth + default `tenant-a`/`company-a`; dual ledger writers; broken `/oip/v1` HTTP mount (planner relative import); incomplete Ask-mode global constitution.

---

## 2. Repository identity and completeness

| Field | Value |
|-------|-------|
| Root | repository root (`.`) |
| Branch | `main` (tracks `origin/main`) |
| Commit | `ab08b89b0d9e0f327db3746ff4aecf8d0fff5f37` |
| Kind | Real Git checkout (not a truncated archive) |
| File count (excl. `.git`/`node_modules`/`dist`/`.workspace`/`.tanstack`) | ~25535 |
| Submodules | none observed |
| Completeness | **APPEARS_COMPLETE** for source audit |
| Dirty worktree | Yes — many untracked items (Knowledge source zips, sqlite data, patch scripts, master roadmap txt). **Not modified by this phase except docs under `docs/mokxya-ai/`.** |

Major top-level dirs: `src/`, `erp_bot/`, `packages/`, `backend/`, `knowledgebase/`, `Knowledge source/`, `docs/`, `e2e/`, `khata-app/`, `data/`, `scripts/`, `nios/`.

Evidence limitations: full async OIP DI bootstrap hung under a 20s probe in this environment; `/oip/v1` import fails (code defect, not missing checkout). Static source mapping remains valid.

---

## 3. Governing repository instructions

| Document | Scope | Conflict with MAI-00? |
|----------|-------|------------------------|
| `AGENTS.md` | Lovable history rules; Sutra UI design system; “only edit named files”; “do not search rest of repo just in case” | **YES** — MAI-00 mandates full-repo inspection. **Resolution:** follow MAI-00 for audit; production code untouched; deliverables only under `docs/mokxya-ai/`. |
| `README.md` | Minimal “BUSY ERP” monorepo note | No |
| `DEPLOYMENT.md` | Render architecture Browser→Node→erp_bot→Groq | No |
| `MOKXYA_AI_MASTER_ARCHITECTURE_AND_CURSOR_ROADMAP_V1.txt` | Master MAI roadmap | Path cited as `docs/mokxya-ai/...` **missing**; file is at **repo root** (untracked). See `docs/mokxya-ai/README.md` pointer. |
| `package.json` / `render.yaml` / `docker-compose.yml` / `pytest.ini` / `knowledgebase/config.json` | Scripts, deploy, tests, KB | No |
| `docs/typescript-baseline.md` | Historical tsc debt | No |
| CONTRIBUTING | **Not found** | — |

No silent override of safety constitution: MAI non-negotiables treated as target; deviations recorded in ADR-0001.

---

## 4. Runtime and deployment entrypoints

| Runtime | Path | Startup | Port | Prod status | Evidence |
|---------|------|---------|------|-------------|----------|
| SPA + proxy | `src/main.tsx`, `serve.mjs` | `npm run dev` / `npm start` | Vite / `PORT` | ACTIVE (`sutra-erp` on Render) | `package.json`, `render.yaml` |
| erp_bot FastAPI | `erp_bot/src/api/server.py` | `python scripts/start_render.py` | `PORT`/`8765` | ACTIVE (`sutra-erp-bot`) | `render.yaml`, `DEPLOYMENT.md` |
| Express backend | `packages/backend/src/server.ts` | `npm run dev/start` | 3000 | ACTIVE_SUPPORTING (compose; not in render.yaml blueprint as SPA peer) | `docker-compose.yml` |
| khata-app | `khata-app/` | app scripts | — | ACTIVE_SUPPORTING | `khata-app/package.json` |
| KB pipeline | `knowledgebase/scripts/` | `npm run kb:*` | — | offline tooling | `package.json`, `config.json` |
| Postgres/Redis | compose | `docker compose up` | 5432/6379 | dev | `docker-compose.yml` |

Notable: docker-compose does **not** run erp_bot. Production chat path documented as Node reverse-proxy → erp_bot → Groq.

---

## 5. End-to-end request flows

### A–B. Conversational / company-data answers

UI `sendMessage` → `streamOrbixQwenChat` → `POST /orbix/chat/stream` → `oip_chat_ingress` → `IntelligenceKernelFacade` → Orchestrator → Execution preprocess → optional Provider Runtime → SSE → `OrbixResponseRenderer`.

Company facts for Orbix ledger views primarily come from **local Dexie**, not live server ERP reads in the AI path.

### C–E. Draft / clarification / correction

`preprocess_erp_message` → shop NLU / `handle_mode_aware_erp` → `start_or_merge_*` draft modules → clarification or preview cards (`skip_llm` often true). Turn-relation-before-merge (MAI-14) is **not** proven; pending draft selection can bind follow-ups.

### F–I. Preview / confirm / post / receipt / sync

Preview card in UI → explicit Confirm → `confirmPending` → `executeOrbixConfirm` → domain `post*Transaction` → Dexie + audit + `eventSyncQueue` → optional `mark-posted` ack → sync coordinator → Postgres.

### J. Knowledge/RAG

NP KB: indexes via `np_kb_adapter` / grounding. Chroma/BM25 hybrid exists but Render skips Ollama ingest — production retrieval ≠ full local RAG stack.

### K. Degraded model

Stub providers / offline flags / deterministic `skip_llm` paths; legacy agent if `oip_chat_enabled()` false.

Flow diagrams: `MAI_00_RUNTIME_FLOW.md`.

---

## 6. AI subsystem inventory

See `MAI_00_MACHINE_INVENTORY.json` → `ai_subsystems`. Summary:

| Subsystem | Status |
|-----------|--------|
| OIP kernel + orchestrator + provider runtime + ERP preprocess | ACTIVE_AUTHORITATIVE |
| Khata drafts + operation classifier + NP KB adapter | ACTIVE_AUTHORITATIVE / SUPPORTING |
| Action Runtime + OEC | PARTIAL |
| Orbix v2, NIOS, Falcon, `/v2` conversation | LEGACY_REACHABLE |
| `/oip/v1` aggregate routers | LEGACY_UNREACHABLE (import bug) |

---

## 7. Language intelligence findings

Supported in practice (partial): English, Devanagari Nepali, Romanized Nepali, code-mix via shop NLU + NP KB + classifiers.

Not fully at MAI-05–11 target: span-level LanguageFrame, protected IDs, lossless normalize contract, role-typed numbers, BS/AD policy, field confidence, OOD hierarchical router.

**Knowledge package:** `Knowledge source/*.zip` (2 zips, untracked) → offline pipeline → `knowledgebase/indexes/lexical/kb_lexical.sqlite` (**exists**). Runtime consumes indexes under `ORBIX_NP_KB_*`; zips not inserted wholesale into prompts. Config separates review/eval collections (`knowledgebase/config.json`). Language KB must not be treated as legal/rate authority (ADR-0001).

**Documented anti-patterns with evidence (not fixed in MAI-00):**

- Regex-heavy intent including purchase clarification labels — `operation_classifier.py`.
- Pending draft merge via `start_or_merge_*` without proven turn-relation gate — `mode_aware_erp.py`.
- Incomplete-amount clarification templates in `khata_preprocess.py`.

---

## 8. Conversation / context / memory findings

| Concern | Finding |
|---------|---------|
| History store | UI local + OIP conversation/session; legacy session JSON; NIOS sqlite |
| Durable? | Partial (sqlite/Dexie); Render OIP sqlite may be ephemeral |
| Tenant ownership | Weak — defaults + client context overrides |
| Active draft selection | mode_aware pending status/draft_id heuristics |
| Turn relation before merge | Not proven |
| Corrections | clarification merges; discourse confirm re-presents |
| ERP facts in memory | Prefer local Dexie for UI; AI may ground language KB |
| Cross-company session mix | Risk if session_id reused without tenant bind (GAP-P0-003) |
| Stale draft capture | Risk (GAP-P1-004) |

---

## 9. Model / provider / prompt findings

| Item | Evidence |
|------|----------|
| Prod provider | Groq `llama-3.3-70b-versatile` (`render.yaml`) |
| Local | Ollama qwen defaults in `erp_bot/src/config.py` |
| Adapters | Groq/Ollama/OpenAI/Anthropic/Gemini/stub under provider_runtime |
| Port | Provider Runtime registry (business modules should not call Groq SDK directly on OIP path) |
| Fast/capable routing | Env model names exist; cloud path uses single default model |
| Privacy on fallback | Stub/offline modes; vendor fallback not fully policy-proven |
| Prompts | `prompt_grounding` not a versioned PromptRegistry |
| Think-tag stripping | `strip_reasoning` imported in server; Orbix v2 may miss module |

Env **names** only: `OIP_GROQ_API_KEY`, `OIP_PROVIDER`, `OIP_DEFAULT_MODEL`, `OIP_FORCE_STUB_PROVIDERS`, `OLLAMA_BASE_URL`, `CONVERSATIONAL_MODEL`, `FAST_MODEL_NAME`, … (values not recorded).

---

## 10. Knowledge / RAG findings

| Stage | Status |
|-------|--------|
| Source registry / manifests | knowledgebase pipeline ACTIVE tooling |
| Lexical index | ACTIVE (`kb_lexical.sqlite`) |
| Vector / Chroma | PARTIAL; Render skips Ollama ingest |
| Hybrid fusion | local `hybrid_rag` |
| Claim-citation verification | PARTIAL (citations flag; verifier incomplete) |
| Legal effective dating | NOT proven as prod authority |
| Semantic search integrity | Lexical FTS path is primary for NP KB; do not assume hash/random vectors for NP KB lexical |

---

## 11. Accounting authority findings

| Capability | Authority |
|------------|-----------|
| Orbix inventory purchase/sale/adjust/settlement/treasury | Dexie domain engines via `executeOrbixConfirm` |
| Manual vouchers/invoices/payroll pages | Often `addVoucher` / form totals (LEGACY parallel) |
| Mobile/API khata | Postgres `executeKhataConfirm` |
| Chart/reports | Dexie engines / pages |
| VAT | Client domain/forms |
| Period locks | Dexie + flags (accounting tests partially failing here) |
| OEC connectors | Python PARTIAL; not sole |

---

## 12. Mutation-path findings

Classified inventory lives in machine JSON. Highlights:

- AUTHORIZED_DOMAIN_LOCAL: Dexie domain posts  
- LEGACY: `addVoucher` / legacy sync push  
- CONFIRMED_BYPASS: unauthenticated `/api/khata/confirm`  
- OFFLINE_QUEUE_ONLY: draft `mark-posted`  
- AUTHORITATIVE_OEC: Action→OEC path (exists, not primary UI)  
- TEST_ONLY: e2e seeds  

---

## 13. OEC-only mutation verdict

**DISPROVED for primary Orbix/Sutra ledger writes.**

Expected chain Action→ERPCommandPort→OEC→Connector→ERP is implemented in Python modules but product Model B explicitly keeps Dexie authoritative (`orbix_drafts.py`). Additional writers exist on Node and legacy UI paths.

---

## 14. Security / tenant / privacy findings

- `OIP_AUTH_REQUIRED=false` in Render blueprint  
- Default service tenant `tenant-a`; ingress defaults `company-a` / `orbix-user`  
- Trust of client `tenant_id`/`company_id` in ingress context  
- `/api/khata/confirm` unauthenticated body tenant/company  
- JWT secret fallback `dev-insecure-secret-change-me`  
- OEC API defaults `tenant_id="tenant-a"`  
- CORS middleware present on FastAPI (review for prod tightness later)

No secret values recorded in this audit.

---

## 15. Frontend contract findings

- Composer: `OrbixWorkspace`  
- Modes: `ask` | `accountant` (`orbixOperatingMode`)  
- SSE: `orbixQwenClient.streamOrbixQwenChat`  
- Confirm: explicit button → `confirmPending` (NL “yes” does not post ledger)  
- Frontend calculates totals and hosts Dexie writes (Model B)  
- Dual panels: Falcon help vs Orbix posting  
- Sync badges: presentational specs exist; dual queues risk honesty bugs  

---

## 16. Test and diagnostic baseline

| Suite | Command | Result this audit |
|-------|---------|-------------------|
| Orbix vitest | `npm run test:orbix-contract` | **129 passed**, exit 0 |
| Accounting vitest | `npm run test:accounting` | 17 passed, 3 failed (+ suite import error), exit 1 |
| TypeScript | `npx tsc --noEmit` | **2 errors** `InvoicePrint.tsx`, exit 2 |
| Pytest collect | `python -m pytest erp_bot/tests --collect-only` | **39 collection errors**, interrupted |
| KB status | `npm run kb:status` | phases 0–8 reported passed/warnings, exit 0 |
| Playwright UI6 | not run (needs services) | skipped |
| CI `.github/workflows/test.yml` | lint + tsc + accounting + backend tsc | does not run full orbix vitest or pytest |

Historical UI-6 11/11 and “151 diagnostics” **not reaffirmed** as current; measured numbers above supersede.

---

## 17. Duplicate / legacy / stub register

| Item | Status |
|------|--------|
| Multiple chat stacks | DUPLICATED / LEGACY_REACHABLE |
| Dexie vs PG vs OEC writes | DUPLICATED |
| eventSync vs syncOutbox | DUPLICATED |
| Memory stores (OIP/Orbix/NIOS/legacy) | DUPLICATED |
| `/oip/v1` routers | UNREACHABLE defect |
| Falcon | LEGACY client |
| Knowledge zips | offline DOCUMENTATION/pipeline source |

---

## 18. P0/P1/P2/P3 gap summary

See `MAI_00_GAP_REGISTER.md`.

- **P0:** GAP-P0-001…004 (OEC myth, khata unauth, OIP auth defaults, `/oip/v1` import)  
- **P1:** parallel AI stacks, dual sync, JWT default secret, draft merge, pytest blocked, Ask policy  
- **P2/P3:** RAG mismatch, frontend calc ownership, tenant-a seeds, tsc syntax, KB zip governance, docs path, AGENTS conflict  

---

## 19. MAI phase evidence mapping

`MAI_PHASE_LEDGER.json` lists MAI-00…MAI-53 exactly once.

- **MAI-00:** PASSED with gate_evidence = these deliverables  
- **Later phases:** NOT_STARTED for gates; `implementation_evidence` may list related code without claiming PASS  

---

## 20. Recommended next phase

**Exactly one:** **MAI-01 — Product Constitution as Executable Policy**

Why: P0 auth/tenant and Ask/mutation policy gaps are launch-critical and underpin every later language/RAG/OEC phase.  

Prerequisites: MAI-00 complete (this audit); treat GAP-P0-004 import fix as parallel unblocker but do not skip constitution.

---

## 21. Environment limitations

- Pytest/OIP HTTP import broken → Python suite ENVIRONMENT-BLOCKED  
- OIP container async probe timed out → live DI smoke incomplete  
- Playwright not executed  
- Did not install/upgrade dependencies or start long-running servers  
- Master roadmap not under `docs/mokxya-ai/` at start  

---

## 22. Exact evidence references

| Claim | Evidence |
|-------|----------|
| Model B Dexie authority | `erp_bot/src/api/orbix_drafts.py` module docstring; `orbixPostingService.ts` header |
| OIP chat ingress | `oip_chat_ingress.py` `oip_chat_enabled`, `build_intelligence_request` |
| OIP mount failure | `planner/api/router.py` `from ...application.commands`; `ModuleNotFoundError` |
| Unauth confirm | `packages/backend/src/routes/khata.ts` confirm handler body tenant fields, no authMiddleware |
| Render Groq/auth | `render.yaml` env block |
| NP KB offline zips | `knowledgebase/config.json` `source_dir`; runtime indexes path |
| Orbix vitest green | audit command output 129 passed |
| Production deploy map | `DEPLOYMENT.md` |

---

## 23. Final MAI-00 gate verdict

| Gate criterion | Met? |
|----------------|------|
| Complete checkout inspected | YES |
| Governing instructions read + conflicts recorded | YES |
| Runtimes/entrypoints mapped | YES |
| Request + mutation pipelines traced | YES |
| AI subsystems classified | YES |
| Providers/tools inventoried | YES |
| Language/context/memory mapped | YES |
| Knowledge/RAG traced | YES |
| Accounting authorities mapped | YES |
| Mutation paths inventoried | YES |
| OEC-only proven or deviations listed | YES (deviations) |
| Security/tenant inspected | YES |
| Frontend contracts mapped | YES |
| Test/diagnostic baselines honest | YES |
| Seven deliverables created + JSON validated | YES |
| MAI-00…53 once in ledger | YES |
| No production behavior change | YES |
| No baseline worsened by MAI-00 docs | YES |
| No secrets in deliverables | YES |
| Next phase evidence-based | YES → MAI-01 |

**MAI-00 VERDICT: PASSED**
