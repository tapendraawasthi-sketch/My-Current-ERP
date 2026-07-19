# MAI-12 — Language Data Governance and Training Pipeline

**Date:** 2026-07-19  
**Status:** `PASSED_ENGINEERING` (slices 1–2; `production_approved=false`)  
**Authority:** [ADR_0029](decisions/ADR_0029_LANGUAGE_DATA_GOVERNANCE_AUTHORITY.md)  
**Runtime:** `mai-12.0.2-slice2` (engineering; not production-approved)

## Objective

Version and gate language datasets so frozen evals cannot enter training, and
source/index assets are manifested with rebuildability status (GAP-P2-005).

## Slice 1

1. `LanguageDataCatalogV1` contract + `data_governance` package
2. Registry of MAI-08…11 eval manifests, seed ontology, KB/source slots
3. Validators: frozen ⇒ non-training; JSONL `prohibited_for_training`; hashes
4. `evals/mai12` fixtures + baseline

## Slice 2

1. `KbRebuildabilityReportV1` + `rebuildability_service.py`
2. Versioned source→index recipe (discover → parse → build_retrieval_indexes)
3. Catalog attaches rebuild report; registry includes config + pipeline scripts
4. Docs: [MAI_12_KB_SOURCE_TO_INDEX_REBUILD_PATH.md](MAI_12_KB_SOURCE_TO_INDEX_REBUILD_PATH.md)

## Gates

| Check | Expect |
|-------|--------|
| Frozen evals | never training-eligible |
| Rebuild assessment | non-`BLOCKED` when index or sources/processed present |
| Recipe steps | include `build_retrieval_indexes.py` |
| Zips in git | not required |

## Non-goals

- Committing large Knowledge-source zips
- Linguist / production approval
- Auto-enabling NP KB in production
