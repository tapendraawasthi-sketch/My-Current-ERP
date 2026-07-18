# Cross-role diagnostic methodology (MAI-07R3K)

## Purpose

Consolidate AI-assisted, user-accepted role judgments into case-level diagnostics to:

1. Measure **shared-generator consistency** across simulated roles.
2. Surface safety-sensitive / soft / ambiguous cases for optional targeted human follow-up.
3. Document provenance contamination that forbids treating agreement as independent reliability.

## Join

Cases join on sealed V3 `source_item_id` from `V3_BLIND_MAPPING.json` (hash `d0875db7…`).

Each case carries role-scoped `review_id`s. Authority text/span must be identical across roles for the same `source_item_id`.

## Decision sources

| Source | Meaning |
|--------|---------|
| `ACCOUNTING_DOMAIN_VERIFIED_IMPORT` | Judgment from accounting verified import |
| `ACCOUNTING_VERIFIED_CONTENT_MAP` | Remaining-role draft inherited accounting content labels |
| `HEURISTIC_V1` | Remaining-role draft filled by deterministic heuristic |

## Agreement (engineering only)

Reported metrics are **percent agreement** among AI outputs.

They are explicitly labeled `NON_INDEPENDENT_AI_OUTPUT_SIMILARITY_ONLY`.

They are **not**:

- Cohen’s κ / Krippendorff’s α as human IRR
- Independent multi-rater reliability
- Gold labels or majority votes as authority (`majority_as_gold=false` always)

## Outputs

Canonical JSONL decisions + risk queue + aggregate JSON + optional blinded targeted packet.
