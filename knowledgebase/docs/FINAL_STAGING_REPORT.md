# Final Close-Out Report — Nepali Language KB

## Verdict

| Field | Value |
|-------|-------|
| Release | **`production_owner_attested`** |
| production_approved | **true** (owner Acer) |
| Licensed CA opinion | **false** |
| KB posting authority | **false** |
| Overlays | **304** |
| Approve-class | **88** |
| Rollback drill | **passed** |
| Semantic | partial (Ollama offline for expand) |

## What “production” means here

Owner risk-acceptance to enable **interpretation-only** NP-KB in this deployment via `ORBIX_NP_KB_ENABLED=true`.

It does **not** mean a licensed CA, language board, or legal firm certified the corpus.

## Enable

Set in your runtime env (example in `.env.example`):

```
ORBIX_NP_KB_ENABLED=true
ORBIX_NP_KB_ROOT=knowledgebase
```

## Artifacts

- `knowledgebase/review/OWNER_PRODUCTION_ATTESTATION.json`
- `knowledgebase/review/rollback_drill_report.json`
- `knowledgebase/review/final_release_gate.json`
- `knowledgebase/processed/review_ready/OWNER_CLOSEOUT_DECISIONS.jsonl`
