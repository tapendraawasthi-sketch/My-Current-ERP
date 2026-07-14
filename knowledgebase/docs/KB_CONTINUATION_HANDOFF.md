# ONLI KB Integration Continuity Handoff

## Current state

| Item | Status |
|------|--------|
| Release gate | **`staging_candidate`** |
| Production approved | **false** |
| Overlays | **261** (27 approve · 25 clarify · 209+ defer) |
| Lexical smoke | 36 hits / 8 queries · execution always forbidden |
| Semantic | Partial (100) — Ollama still down for expand |

## Latest pass

1. Specialist dossier: `SPECIALIST_CLARIFY_PACKET.md` + blank `SPECIALIST_CLARIFY_DECISIONS.jsonl` (25 tax/statutory rows)
2. Priority-queue machine `defer` suggestions imported as operator deferrals (merge-safe import)
3. Production blockers list: `knowledgebase/docs/PRODUCTION_BLOCKERS.md`
4. Overlay import now **merges** by `record_id` (no wipe on re-import)

## Still blocked for production

Fill specialist decisions for the 25 clarify rows, then language + accounting + security sign-off. Do not set `production_approved: true` from automation.

```powershell
npm run kb:specialist
# edit SPECIALIST_CLARIFY_DECISIONS.jsonl
python knowledgebase/scripts/import_human_reviews.py --input knowledgebase/processed/review_ready/SPECIALIST_CLARIFY_DECISIONS.jsonl --reviewer NAME
npm run kb:apply-overlays
npm run kb:gate
```
