# MAI-33 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-33.0.2-slice2`  
**Authority:** ADR_0050 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` preview candidate |
| Live `preview_message` / cards | not invoked (`allow_preview_generate=false`) |
| Preview hash minted | false |
| Effects computed | false (null) |
| Journal calculated | false |
| GAP-P2-002 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai33_slice2.py`
- `deterministic_preview_edit_loop_consume_service.py`
- `evals/mai33/manifests/MAI_33_SLICE2.manifest.json`
