# Human Review Guide

## Purpose

Phase 4 produces a stratified sample (`processed/review_ready/human_review_sample.csv` and `.jsonl`) for native-language and domain reviewers. Completed reviews are imported via `import_human_reviews.py` into `processed/records/review_overlays.jsonl`.

**Raw source files are never modified.**

## Review decisions

| Decision | Meaning |
|----------|---------|
| `approve` | Record is acceptable for retrieval/training use under stated scope |
| `approve_with_edit` | Accept after noted correction (apply edit in overlay notes; do not edit raw) |
| `reject` | Do not use in production retrieval |
| `needs_clarification` | Ambiguous; requires follow-up |
| `defer` | Skip for now |
| `promote_to_gold` | Elevate to evaluation/gold corpus (still not auto-production) |

## Workflow

1. Run `build_human_review_sample.py` after Phase 3 quality annotations exist.
2. Assign reviewers by stratum (priority domains oversampled: accounting, banking, payroll, tax, security, privacy, cross-tenant).
3. Fill `review_decision`, `reviewer_notes`, and `reviewed_at` (ISO-8601 UTC).
4. Import: `python knowledgebase/scripts/import_human_reviews.py --input path/to/completed.csv`
5. Overlays merge at runtime by `record_id`; parsed JSONL remains immutable.

## Schema

See `knowledgebase/schemas/human_review.schema.json`.

## Prohibited actions

- Editing files under `knowledgebase/raw/nepali_language/`
- Setting `execution_allowed` to true without ERP architect approval
- Moving evaluation records into production FTS without explicit release gate
