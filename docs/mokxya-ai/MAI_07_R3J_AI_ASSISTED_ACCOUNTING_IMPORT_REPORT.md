# MAI-07R3J-AI-ASSISTED-ACCOUNTING-IMPORT

**Verdict:** `PASSED_ENGINEERING_IMPORT`  
**Date:** 2026-07-17  
**Scope:** ACCOUNTING_DOMAIN Round A — AI-assisted, user-accepted engineering evidence only

## Non-claims (explicit)

| Claim | Status |
|-------|--------|
| Independent blinded human review | **false** |
| Row-by-row independent review | **false** |
| Professional linguist adjudication | **false** |
| `LINGUIST_APPROVED` | **false** |
| `PRODUCTION_APPROVED` | **false** |
| Official Round A lock eligible | **false** |
| Round B authorized / released | **false** |
| Frozen V3 quality-gate gold | **false** |
| Runtime / resource pack promotion | **not performed** |
| MAI-08 | **NOT_STARTED** |
| Training use | **prohibited** |

`review_method=AI_ASSISTED_HUMAN_VERIFIED`  
`user_confirmation=USER_ACCEPTED_AI_SUGGESTIONS_WITHOUT_CHANGES`  
`ai_autofill_used=true`  
`declaration_no_ai_autofill=false` (must not be claimed true)

## Package integrity

| Artifact | SHA-256 |
|----------|---------|
| Input ZIP | `f558fefdc186ba79bbe2a8757569204b88ce1aa1ed27400cda7705c1551cdb68` |
| Canonical semantic hash | `b96bec29e30ddcdc6dce1a5ef09a2003ee9de003a336cd98b43341c6e55e363b` |
| Canonical JSONL | `89305364ea86fd60637d1787aca07aba523781f77473805a9022516f6ff0de9b` |

Workbooks: **6** · Completed Round A rows: **611** · Unique review IDs: **611**

All six `verified_sha256` values matched recomputed file hashes. Authority fields `input_text` / `highlighted_span` matched official blank ACCOUNTING_DOMAIN batches. Reviewer user-declaration fields blank. Round B uncompleted. No macros.

## Canonical evidence path

`docs/mokxya-ai/reviews/mai07_v3_ai_assisted/accounting_domain/`

- `evidence/workbooks/` — byte-for-byte verified XLSX
- `evidence/package_metadata/` — provenance, manifest, source batch, prompts
- `canonical/ACCOUNTING_DOMAIN_ROUND_A_AI_ASSISTED_HUMAN_VERIFIED.jsonl`
- `reports/IMPORT_REPORT.json`
- `reports/SEMANTIC_HASH.json`

**Not** written to `docs/mokxya-ai/reviews/mai07_v3/review_operations/round_a_inbox/`.

## Importer

`erp_bot/src/oip/modules/language_runtime/transliteration/application/import_mai07_r3j_ai_assisted_accounting.py`

Extends existing MAI-07 R3J-A review/import authority (shared dispositions, sheet contract, official authority map). Separate evidence root; fail-closed; governance flags hard-coded.

## Distributions (imported)

**Disposition:** ENGLISH_IDENTITY_REQUIRED 244; DEVANAGARI_TRANSLITERATION_REQUIRED 159; IDENTITY_FIRST_REVIEW_REQUIRED 123; TRANSLITERATION_OPTIONAL 38; ACRONYM_OR_IDENTIFIER 30; CONTEXT_DEPENDENT 16; ABSTAIN_CANNOT_DECIDE 1

**Confidence:** HIGH 411; MEDIUM 60; LOW 140

**natural_context_ok:** YES 460; NO 151  
**suspected_ambiguity:** NO 411; YES 200

## Validation commands (this phase)

| Command | Exit | Result |
|---------|------|--------|
| `pytest tests/oip/language_runtime/test_mai07_r3j_ai_assisted_accounting_import.py -v` | 0 | 19 passed |
| `pytest tests/oip/language_runtime -q` | 0 | 499 passed, 6 skipped |
| `python -m src.oip.contracts.export_schemas --check` | 0 | ok |
| `python -m …resource_repository --check` | 0 | hash `16174253…`, mutated_canonical=false |
| MAI-04/05/06 focused | 0 | 43 passed |
| `pytest tests/oip/test_mai02_canonical_contracts.py` | 0 | 22 passed |
| vitest mai01/mai02 orbix | 0 | 11 passed |
| `tsc -p tsconfig.mai02/03/05.json --noEmit` | 0 | ok |
| Deterministic re-import proof | 0 | identical semantic hash + JSONL |

## Governance boundary

Official review ops remain waiting for independent Round A with `ROUND_A_LOCKED=false`, `ROUND_B_READY=false`. Active runtime remains `mai-07.1.3-r3f-sealnew`. MAI-07 remains `NEEDS_CORRECTIVE_WORK`. Gaps requiring independent human / linguist review stay OPEN.

## ADR

`docs/mokxya-ai/decisions/ADR_0011_AI_ASSISTED_VS_INDEPENDENT_REVIEW_EVIDENCE.md`
