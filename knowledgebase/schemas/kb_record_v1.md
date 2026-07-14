# KB Record Schema v1.0.0

Human-readable reference for `knowledgebase/schemas/kb_record.schema.json`.

## Purpose

Each JSONL line is one flattened **canonical record** derived from the ONLI raw `.txt` package. Records preserve provenance, support retrieval indexing, and gate runtime execution (`execution_allowed` defaults to **false**).

Machine validation uses the JSON Schema file; Phase 2 also performs lightweight required-field checks without external dependencies.

## Required fields

| Field | Type | Meaning |
|-------|------|---------|
| `record_id` | string | Immutable identifier from `RECORD <id>` header or synthetic ID for normative sections |
| `record_type` | string | Semantic type (e.g. `language_rule`, `intent_example`, `gold_test`, `normative_section`) |
| `schema_version` | string | Always `1.0.0` for this contract |
| `source_file_id` | string | Four-digit file number (`0001`–`0088`) |
| `source_filename` | string | Raw filename (never modified on disk) |
| `source_sha256` | string | SHA-256 of the raw source file at parse time |
| `source_line_start` | int | 1-based start line in source |
| `source_line_end` | int | 1-based end line in source |
| `execution_allowed` | bool | **Default false.** Only true when explicitly set in source |
| `parse_status` | enum | `ok`, `warning`, `quarantined`, `partial` |
| `content_text` | string | Indexable body text |
| `content_hash` | string | SHA-256 of `content_text` |
| `normalized_content_hash` | string | SHA-256 of normalized `content_text` (casefold + whitespace collapse) |

## Common optional fields

| Field | Notes |
|-------|-------|
| `collection` | Parser bucket: `language_rules`, `gold_tests`, `domain_records`, etc. |
| `domain` | String or list; accounting, banking, tax, security, … |
| `language_form` | Devanagari, romanized, English, mixed |
| `raw_input` / `normalized_input` | Surface text layers (never collapse) |
| `intent`, `entities`, `slots` | Interpretation artifacts |
| `operation_class`, `read_only`, `preview`, `mutation`, `destructive` | Action gating |
| `rules`, `expected_behavior` | Normative or evaluation expectations |
| `safety_labels` | Risk tags from source |
| `quality_score`, `eligibility`, `review_status` | Filled in Phase 3+ |
| `metadata` | Runtime contract JSON, section context, parser notes |
| `fields` | Full key-value map from the RECORD block |

## Collection routing (Phase 2)

Production retrieval corpora **exclude** evaluation collections by default:

| Collection | Typical content |
|------------|-----------------|
| `language_rules` | Orthography, morphology, normalization rules |
| `lexicon` | Abbreviations, terms, glosses |
| `normalization_examples` | Surface → candidate examples |
| `intent_examples` | Intent-labeled utterances |
| `entity_examples` | Entity-labeled utterances |
| `slot_examples` | Slot-filling examples |
| `dialogue_examples` | Multi-turn dialogue |
| `domain_records` | Accounting / ERP domain datasets (files 0033+) |
| `safety_rules` | Abstention, negation, safety policy |
| `authorization_rules` | Execution / authorization constraints |
| `runtime_contracts` | Structured JSON runtime contracts |
| `gold_tests` | Gold recognition / contrastive tests |
| `adversarial_tests` | Adversarial evaluation inputs |
| `e2e_tests` | End-to-end integration tests |
| `unclassified_records` | Fallback bucket |

## Eligibility (Phase 3)

| Value | Meaning |
|-------|---------|
| `eligible` | Safe for production lexical retrieval (subject to review policy) |
| `eligible_with_warning` | Usable with quality warnings |
| `evaluation_only` | Test/gold/adversarial/e2e — never default production FTS |
| `quarantined` | Parse or integrity failure |
| `human_review_required` | Needs reviewer decision |

## Immutability rules

1. Raw files under `knowledgebase/raw/nepali_language/` are **never** modified by pipeline scripts.
2. Human review overlays (Phase 4 import) append to `review_overlays.jsonl`; they do not rewrite parsed records or raw sources.
3. `content_hash` enables exact deduplication; `normalized_content_hash` supports near-duplicate detection.

## Versioning

Incompatible field or meaning changes require a **major** schema version bump and migration map per ONLI KB-0005.
