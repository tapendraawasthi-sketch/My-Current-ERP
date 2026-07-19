# MAI-09 Engineering Closure

**Date:** 2026-07-19  
**Runtime:** `mai-09.0.2-slice2`  
**Authority:** ADR_0026

## Verdict

| Field | Value |
|-------|-------|
| Status | **PASSED_ENGINEERING** |
| `production_approved` | false |
| `linguist_approved` | false |
| Slices complete | 1 (duration/ID/unknown) + 2 (word numerals + BS/AD) |
| GAP-P1-007 | REDUCED (not closed) — engineering number-role path landed |
| Next | **MAI-10** |

## Engineering gates met

- Candidate-only `NumberRoleBundleV1` on LanguageFrame; `silent_applications=0`
- Duration before amount; protected invoice/PAN/phone never amount
- Bare uncued digits → `unknown` (not amount)
- Word numerals: hajar/lakh/crore (+ tin/dui) expand to amount
- Deterministic BS↔AD for BS years 2000–2090
- Live ingress attach after MAI-08; EntityExtractor aligned
- Eval adapter uses the same parser

## Explicit non-claims

Does not authorize MAI-09 production cutover or fully close GAP-P1-007
without broader MAI-04 number-role suite green.
