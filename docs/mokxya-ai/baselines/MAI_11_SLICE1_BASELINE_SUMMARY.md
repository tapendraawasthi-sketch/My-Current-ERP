# MAI-11 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-11.0.1-slice1`  
**Authority:** ADR_0028  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| MAI-11 status | `IN_PROGRESS` |
| MAI-10 | **PASSED_ENGINEERING** |
| Devanagari shop → response | `NEPALI_DEVANAGARI` |
| Romanized shop → response | `ROMANIZED_NEPALI` |
| Formal EN accounting | `ENGLISH` + `ACCOUNTING_FORMAL` |
| Honorific (`tapai`/`hajur`) | `SHOP_INFORMAL` |
| Response rewrite applied | **false** |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai11_slice1.py`
- `evals/mai11/frozen/response_register_critical_v1.jsonl`
- `docs/mokxya-ai/baselines/MAI_10_ENGINEERING_CLOSURE.md`
