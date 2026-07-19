# MAI-12 — Language Data Governance and Training Pipeline

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0029](decisions/ADR_0029_LANGUAGE_DATA_GOVERNANCE_AUTHORITY.md)  
**Runtime:** `mai-12.0.1-slice1` (engineering; not production-approved)

## Objective

Version and gate language datasets so frozen evals cannot enter training, and
source/index assets are manifested with rebuildability status (GAP-P2-005).

## Slice 1

1. `LanguageDataCatalogV1` contract + `data_governance` package
2. Registry of MAI-08…11 eval manifests, seed ontology, response-register
   resources, KB index paths, Knowledge-source archive slots
3. Validators: frozen role ⇒ `training_eligible=false`; JSONL
   `prohibited_for_training`; manifest sha256 match
4. `evals/mai12` fixtures + baseline

## Gates (slice 1)

| Check | Expect |
|-------|--------|
| Frozen eval assets | `training_eligible=false` |
| Frozen JSONL rows | `prohibited_for_training=true` |
| Manifest hashes | match file sha256 |
| Knowledge zip slots | status `PRESENT` or `MISSING` (not crash) |

## Non-goals

- Rebuilding KB indexes in this slice
- Committing large Knowledge-source zips
- Linguist / production approval
- MAI-13+ phases
