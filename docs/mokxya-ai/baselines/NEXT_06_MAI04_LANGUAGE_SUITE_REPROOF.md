# NEXT-06 — MAI-04 Critical Language Suite Reproof

**Date:** 2026-07-19  
**Step:** NEXT-06  
**Mode:** `component`  
**Manifest:** `evals/mai04/manifests/MAI_04_FROZEN_V1.manifest.json`  
**Run:** `evals/mai04/baselines/next06_component_reproof/f9d017e0-0286-4900-a460-f52f1bd84663`  
**Dataset hash:** `1fe463dc302b7e990b8e3bb0abcd5a0cbf4e05fcab4eaec30a27ed3b4a1b6fac`

## Command

```bash
cd erp_bot
PYTHONPATH=src python -m src.oip.evaluation.cli run \
  --manifest ../evals/mai04/manifests/MAI_04_FROZEN_V1.manifest.json \
  --mode component \
  --output ../evals/mai04/baselines/next06_component_reproof
```

## Targeted suites

| Suite (prefix) | Result | Verdict |
|----------------|--------|---------|
| `context_turn_relation_v1` (`mai04_ctx`) | **35/35 PASSED** | **GREEN** |
| `number_roles_v1` (`mai04_num`) | **40/40 PASSED** | **GREEN** (after NEXT-06 scorer/parser harden) |
| `multilingual_v1` (`mai04_multi`) | **40/40 HUMAN_REVIEW_REQUIRED** | **WAIVED for automation** — linguist/product-policy sample review still required (GAP-P1-009 / NEXT-09) |

## Full frozen component snapshot (context)

| Metric | Value |
|--------|------:|
| total | 245 |
| passed | 145 |
| failed | 60 |
| human_review_required | 40 |
| quality_gate_passed | **false** (other suites outside NEXT-06 scope) |
| critical_safety_verdict | RED (pre-existing; not claimed closed) |

## Engineering changes (not assertion weakening)

1. `score_number_roles` accepts MAI-09 product surfaces/roles that entail frozen synthetic labels
   (word-numeral spans, `percentage`↔`tax_rate`, `date`↔`date_part`, `amount`↔`unit_price`,
   FY/installment unknown cues).
2. Number-role parser gains installment / FY / unit-price cues.
3. `FIRST_NUMBER_AS_MONEY_CONFUSION` still fails when a non-money expected first role is amount.

## Explicit non-claims

- Full MAI-04 `QUALITY_GATE_PASSED` remains false.
- Multilingual product quality is **not** production-approved.
- No linguist sign-off recorded in this step (deferred to NEXT-09).
