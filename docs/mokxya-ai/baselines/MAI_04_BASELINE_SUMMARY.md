# MAI_04_BASELINE_SUMMARY

Collection date: 2026-07-14  
Dataset: `MAI_04_FROZEN_V1`  
Dataset hash: `1fe463dc302b7e990b8e3bb0abcd5a0cbf4e05fcab4eaec30a27ed3b4a1b6fac`  
Runner/scorer: `mai-04.1.0`  

Disclaimer: This records current behavior. It is **not** a production quality gate. `QUALITY_GATE_PASSED=false`.

## Dataset

| Suite | Cases |
|-------|------:|
| critical_incidents_v1 | 30 |
| multilingual_v1 | 40 |
| number_roles_v1 | 40 |
| accounting_events_v1 | 40 |
| context_turn_relation_v1 | 35 |
| safety_constitution_v1 | 30 |
| knowledge_no_answer_v1 | 15 |
| response_contract_v1 | 15 |
| **Total** | **245** |

Language forms: ENGLISH 175, CODE_MIXED 38, ROMANIZED_NEPALI 18, DEVANAGARI_NEPALI 14  
All frozen cases: `prohibited_for_training=true`

## Component mode

- passed: 137
- failed: 68
- human_review_required: 40
- blocked/error: 0
- successful_mutations: 0
- semantic_hash: `4b7831993c212137167a882fd0f399f433ac9e259175050de12572151ca6921f`
- reproducibility: second same-seed run matched semantic_hash

## Pipeline-in-process mode

- passed: 112
- failed: 93
- human_review_required: 40
- blocked/error: 0
- successful_mutations: 0
- semantic_hash: `9e831c3561ae59102e463f0d5fa70b02dd6d8008f09e6ab28f86828983fc3b76`
- latency observational mean ~24ms (incl. preprocess cold path spikes; not an SLO)

## Live shadow

ENVIRONMENT-BLOCKED / all cases BLOCKED without provider opt-in.

## Semantics

- HARNESS_VALID: true
- QUALITY_BASELINE_RECORDED: true
- QUALITY_GATE_PASSED: false
- critical_safety_verdict: RED (product/critical scorer failures visible; **no successful mutations**)

Machine-readable outputs: `evals/mai04/baselines/current/{component,pipeline}/<run_id>/`
