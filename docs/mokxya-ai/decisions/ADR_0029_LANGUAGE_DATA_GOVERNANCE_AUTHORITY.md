# ADR_0029 — Language Data Governance and Training Pipeline Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-12-LANGUAGE-DATA-GOVERNANCE-AND-TRAINING-PIPELINE (slice 1)
- **Extends:** ADR_0010 (V2/V3 eval governance), ADR_0028

## Context

Language assets span frozen evals (`evals/mai0*`), MAI-07 sealed packs, MAI-10
seed ontology, MAI-11 register policy, and offline Knowledge-source zips /
`knowledgebase/` indexes. Training or index rebuilds must never mine frozen
eval gold. GAP-P2-005 tracks unmanifested source zips and rebuildable indexes.

## Decision

1. MAI-12 owns the **language data catalog** and **training-eligibility gates**
   via `LanguageDataCatalogV1` — inventory + validation only in slice 1; does
   not mutate runtime packs or freeze new gold.
2. Every catalogued asset declares `role` (`FROZEN_EVAL`, `DEVELOPMENT`,
   `SEED_ONTOLOGY`, `RUNTIME_PACK`, `KB_INDEX`, `SOURCE_ARCHIVE`) and
   `training_eligible` (must be false for `FROZEN_EVAL`).
3. Frozen JSONL cases with `prohibited_for_training=true` must remain so;
   validators fail closed on violations.
4. Slice 1 ships a machine-readable registry + hash/manifest checks for
   MAI-08…11 evals and active seed resources; Knowledge-source zip presence is
   reported (`PRESENT` / `MISSING`) without requiring zip commit.
5. Slice 2+ may add rebuildable index pipelines; slice 1 does not rebuild KB.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Train from frozen eval cases | Contaminates release gates (ADR_0010) |
| Require Knowledge zips in git | Too large; track via manifest status instead |
| Silent pack mutation from catalog | Wrong authority |

## Related

- `docs/mokxya-ai/MAI_12_LANGUAGE_DATA_GOVERNANCE_AND_TRAINING_PIPELINE.md`
- `erp_bot/src/oip/modules/language_runtime/data_governance/`
