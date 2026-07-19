# MAI-12 — KB Source → Index Rebuild Path

**Authority:** ADR_0029  
**Runtime:** `mai-12.0.2-slice2`  
**Gap:** GAP-P2-005

## Purpose

Document and machine-check whether the Nepali Language KB lexical index can be
rebuilt from present artifacts without committing large Knowledge-source zips.

## Rebuild statuses

| Status | Meaning |
|--------|---------|
| `FULL_REBUILD_READY` | Config + pipeline scripts + ≥1 source zip present |
| `INCREMENTAL_FROM_PROCESSED` | Scripts + `processed/jsonl` present (no zips needed) |
| `INDEX_PRESENT_SOURCES_MISSING` | Runtime index exists; cannot rebuild from this checkout |
| `BLOCKED` | Missing config/scripts and no usable intermediates |

## Recipe (canonical)

Assess anytime:

```bash
cd erp_bot
PYTHONPATH=src python -m src.oip.modules.language_runtime.data_governance.application.rebuildability_service
```

Full rebuild (when zips present):

```bash
python knowledgebase/scripts/run_kb_pipeline.py --from-phase 0 --to-phase 5
```

Index-only from processed JSONL:

```bash
python knowledgebase/scripts/build_retrieval_indexes.py
```

## Outputs

- `knowledgebase/indexes/lexical/kb_lexical.sqlite`
- `knowledgebase/indexes/metadata/kb_metadata.sqlite`

## Non-goals

- Committing Knowledge-source zips into git
- Training from frozen evals
- Automatic production enable of `ORBIX_NP_KB_ENABLED`
