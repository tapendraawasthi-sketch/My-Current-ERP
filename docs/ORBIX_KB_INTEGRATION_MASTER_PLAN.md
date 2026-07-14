# Orbix Nepali Language KB — Integration Master Plan

## Objective

Safely validate, structure, index, test, and integrate the Orbix Nepali and Romanized Nepali Language Intelligence knowledge base (Files 0001–0088) into the existing Sutra/Orbix ERP stack without granting the knowledge base posting authority.

## Discovered architecture (baseline)

| Layer | Location | Role |
|-------|----------|------|
| Frontend Orbix UI | `src/components/ekhata/*`, `src/store/eKhataStore.ts` | Chat workspace, posting preview UI |
| Conversation / SSE | `erp_bot/src/conversation/manager.py`, NIOS gateway | Streaming chat orchestration |
| NLU | `erp_bot/src/nlu/*` | Intent, normalize, clarify, hybrid search |
| Tiered lexical KB | `erp_bot/src/knowledge/knowledge_registry.py`, `data/ekhata/knowledge` | Existing language/accounting chunks |
| Vector stores | Chroma via `erp_bot/src/vectorstore/*` | Optional semantic (`nomic-embed-text` / Ollama) |
| Orbix v2 API | `erp_bot/src/orbix/api.py` | `/orbix/v2/chat` (+ stream) |
| Authoritative posting | Khata / mode-aware ERP services | Only mutation authority |

**Integration principle:** extend NLU/retrieval adapters; never replace ERP posting services. Lexical FTS5 is mandatory/local; semantic Chroma is optional and non-authoritative for safety.

## Source packages

Discovered under `Knowledge source/` (config key `paths.source_dir`):

1. `ORBIX_NP_LANGUAGE_KB_FILES_0001_TO_0016.zip`
2. `ORBIX_NP_LANG_KB_FILES_0017_TO_0088.zip`

Original ZIPs are immutable. Extracts live under `knowledgebase/raw/nepali_language/`.

## Phase sequence

| Phase | Name | Gate |
|-------|------|------|
| 0 | Discovery & ZIP inventory | 88 numbered files identified safely |
| 1 | Extract + package validation | Raw immutable; structural errors reported |
| 2 | Streaming parse → JSONL | Quarantine malformed; no eval mix into prod corpus |
| 3 | Quality / duplicates / contradictions | Annotate only; eligibility labels |
| 4 | Human review sample | ~1500–2000 stratified rows |
| 5 | Lexical (+ optional semantic) indexes | Eval-only collections separated |
| 6 | Runtime adapter + feature flags | KB never posts; rollback via config |
| 7 | Evaluation / safety invariants | Critical invariants 100% |
| 8 | Perf / security / release gate | Never auto `production_approved` |

## Feature flags (runtime)

```
ORBIX_NP_KB_ENABLED
ORBIX_NP_KB_ROOT
ORBIX_NP_KB_LEXICAL_ENABLED
ORBIX_NP_KB_SEMANTIC_ENABLED
ORBIX_NP_KB_LEXICAL_TOP_K
ORBIX_NP_KB_SEMANTIC_TOP_K
ORBIX_NP_KB_MIN_QUALITY_SCORE
ORBIX_NP_KB_REVIEW_POLICY   # reviewed_only | reviewed_and_generated | development_all
ORBIX_NP_KB_CITATIONS_ENABLED
```

Default: **disabled** (`ORBIX_NP_KB_ENABLED` unset/false).

## Large-file policy

Do not commit: raw extracts, large JSONL, SQLite indexes, Chroma dirs. Track code, schemas, small manifests/reports. See `.gitignore` updates under Phase 5/8.

## Status tracker

Live status: `knowledgebase/review/phase_status.json`

## Execution outcome (development)

- Phase 0–1: **passed** / **passed_with_warnings** — 88 files extracted; raw SHA immutable; ~5.69M RECORD headers detected.
- Phase 2: **passed_with_warnings** — 5,694,440 canonical records; 310 quarantined; eval collections separated.
- Phase 3: **passed_with_warnings** — streaming quality; avg score ~0.89; near-dup bounded; no silent deletions.
- Phase 4: **passed** — human review sample **1800** rows (~87/88 files represented).
- Phase 5: **passed** — FTS5 prod **5,682,218** / eval **12,222**; semantic pending optional.
- Phase 6: **passed** — `np_kb_adapter` + optional Orbix metadata; **disabled by default**.
- Phase 7: **passed** — critical invariants **100%**; generated evaluation only (not human/production evidence).
- Phase 8: **development_ready** (not production_approved). Human review required.

## Prohibited

No paid APIs, no upload of KB content, no silent raw repairs, no production approval claims, no KB-driven mutations.
