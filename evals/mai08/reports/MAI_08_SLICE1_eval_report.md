# MAI-08 Slice 1 Eval Report

Dataset: `mai08-slice1-v1`  
Manifest: `evals/mai08/manifests/MAI_08_SLICE1.manifest.json`

| Suite | Cases | Gate focus |
|-------|------:|------------|
| `slot_stable_code_mix_v1` | 12 | Intent/amount/qty stable across EN/ROMAN/DEV variants |
| `slot_stable_typo_abbr_v1` | 12 | Same slots under typo/abbr noise |
| `fuzzy_high_risk_abstain_v1` | 8 | No silent party/item bind on close names |
| `ood_unknown_party_v1` | 10 | Unknown party abstains |

Thresholds: `evals/mai08/manifests/MAI_08_SLICE1_THRESHOLDS.json`  
Baseline: `docs/mokxya-ai/baselines/MAI_08_SLICE1_BASELINE_SUMMARY.md`
