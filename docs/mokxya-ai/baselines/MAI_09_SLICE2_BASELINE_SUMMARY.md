# MAI-09 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-09.0.2-slice2`  
**Authority:** ADR_0026  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Word numerals | `5 hajar`→5000, `2 lakh`→200000, `1 crore`→10000000, `tin hajar`→3000 |
| BS→AD | `2081-01-01` BS → `2024-04-13` AD |
| AD↔BS table | BS 2000–2090 embedded; epoch 1943-04-14 AD |
| Duration + lakh coexist | yes |
| `production_approved` | false |
| MAI-10 | NOT_STARTED |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai09_slice2.py`
- `evals/mai09/frozen/word_numerals_and_dates_v1.jsonl`
- `bs_ad_service.py` / `word_numerals.py`
