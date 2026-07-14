# KB Retrieval Architecture

## Overview

Phase 5 builds **local-only** retrieval artifacts for the Orbix Nepali Language KB (ONLI). Lexical search is mandatory; semantic search is optional and non-authoritative.

## Indexes

| Artifact | Path | Role |
|----------|------|------|
| Production FTS5 | `indexes/lexical/kb_lexical.sqlite` → table `prod_fts` | Default runtime lexical retrieval |
| Evaluation FTS5 | same DB → table `eval_fts` | Gold/adversarial/e2e tests only |
| Metadata SQLite | `indexes/metadata/kb_metadata.sqlite` | Record metadata, eligibility, routing |
| Semantic (optional) | `indexes/semantic/` | Chroma/Ollama when enabled |

## Collection separation

Parser JSONL collections map to **retrieval collections** (see `manifests/retrieval_collections.json`):

- `language_and_normalization`
- `intent_and_dialogue`
- `accounting_and_erp`
- `safety_and_governance`
- `support_and_help`
- `analytics_and_decision_support`
- `evaluation_only` ← **never** in `prod_fts`

Gold, adversarial, and e2e tests stay in `eval_fts` only.

## Domain routing

`manifests/domain_routing_map.json` lists domain → retrieval collection precedence (e.g. `BANKING` → accounting + safety).

## Runtime feature flags

```
ORBIX_NP_KB_ENABLED=false          # default
ORBIX_NP_KB_LEXICAL_ENABLED
ORBIX_NP_KB_SEMANTIC_ENABLED
ORBIX_NP_KB_MIN_QUALITY_SCORE
ORBIX_NP_KB_REVIEW_POLICY
```

## Query flow (conceptual)

```
User utterance
    → NLU normalize
    → FTS5 prod_fts (filter: eligibility, quality_score, review policy)
    → optional semantic (if enabled)
    → merge + rank (lexical authority > semantic)
    → cite record_id + source_file_id (never auto-post)
```

## Rebuild

```bash
python knowledgebase/scripts/parse_kb_to_jsonl.py
python knowledgebase/scripts/analyze_kb_quality.py
python knowledgebase/scripts/build_retrieval_indexes.py
python knowledgebase/scripts/build_semantic_index.py   # optional
```

## Safety invariants

1. `execution_allowed` defaults false at parse time.
2. Evaluation corpora excluded from production FTS.
3. KB retrieval informs interpretation; **Khata/mode-aware ERP** retains posting authority.
