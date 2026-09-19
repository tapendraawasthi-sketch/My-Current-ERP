# MAI-07R3C Baseline V2 Quality Report

- QUALITY_GATES_PASSED: **False**
- LINGUIST_APPROVED: **false**
- PRODUCTION_APPROVED: **false**
- dataset_hash: `0cee0c07d07430bded793e2dbe162e7b496223ecff762cdd69bca8d8d992d4b9`
- predictions_sha256: `88016f847678fefcd2b8545659ca03f8c4bf6849525d64855d563e9a95fd0c5a`
- per_case_audit_sha256: `b01592abcc90412e06424f3ede09bae6d74e54aeae42a9517d4f00d31d1ddeea`

## Target population
- N=288
- top1={'numerator': 254, 'denominator': 288, 'value_unrounded': '127/144', 'value_float': 0.8819444444444444}
- recall@5={'numerator': 277, 'denominator': 288, 'value_unrounded': '277/288', 'value_float': 0.9618055555555556}
- MRR={'numerator_sum': '531/2', 'denominator': 288, 'value_unrounded': '59/64', 'value_float': 0.921875}
- multiple_preferred_ambiguity=1

## Gates
- target_candidate_top1_accuracy: PASS observed=0.8819444444444444
- target_candidate_recall_at_5: PASS observed=0.9618055555555556
- target_candidate_mrr: PASS observed=0.921875
- core_target_recall_at_5: FAIL observed=0.9669117647058824
- unambiguous_target_top1: PASS observed=0.9647058823529412
- english_identity_top1: FAIL observed=0.9607843137254902
- false_devanagari_on_english: FAIL observed=0.0392156862745098
- protected_mutations: FAIL observed=6.0
- raw_view_mutations: PASS observed=0.0
- deterministic_output_rate: PASS observed=1.0
- candidate_caps_respected: PASS observed=1.0

One-shot protocol: runtime not retuned; overlay disabled.
