# MAI-07 eval (MAI-07C2 target scorer)

evaluator_version=mai-07.1.3
all_gates_passed=False
AUTOMATED_ENGINEERING_GATES_PASSED=True
QUALITY_GATES_PASSED=False
LINGUIST_APPROVED=False
PRODUCTION_APPROVED=False

## MAI-07C2 correction notice

MAI-07C1 any-acceptable metrics are retained only as a diagnostic: identity candidates may
be counted as acceptable. MAI-07C2 quality gates score only non-identity Devanagari targets.

C2 gates score only non-identity Devanagari target candidates on V2 populations.

| Target metric | Value |
| --- | --- | --- |
| top-1 | 0.7563291139240507 |
| recall@5 | 0.9810126582278481 |
| MRR | 0.8686708860759493 |

Runtime/resources remain unchanged. Evaluator/scorer: `mai-07.1.3`.

## C2 target context contingency (N=64)

- Both correct: 5
- Context-free only: 0
- Contextual only: 5
- Neither: 54
- Lift: 5/64 = 5/64

## Runtime semantic hash

`097d500c37392383e974c110568799e738a3989f37c5d69dc20bd6d1141c72fd`

## Per-case audit

`evals/mai07/baselines/MAI_07_per_case_metric_audit_v2.jsonl` hash=`c89a0c4e1031acec28d92ce9ccc8be0411e06207e696f44a28dcbfea3787c9d9`

## Full JSON

```json
{
  "ALIGNMENT_EXACTNESS": 1.0,
  "AUTOMATED_ENGINEERING_GATES_PASSED": true,
  "AUTOMATIC_CANDIDATE_APPLICATION_COUNT": 0,
  "CANDIDATE_CAP_COMPLIANCE": 1.0,
  "DETERMINISTIC_OUTPUT_RATE": 1.0,
  "INVALID_OFFSET_COUNT": 0,
  "LINGUIST_APPROVED": false,
  "NETWORK_CALL_COUNT": 0,
  "NORMALIZATION_VIEW_MUTATION_COUNT": 0,
  "PRODUCTION_APPROVED": false,
  "PROTECTED_SPAN_MUTATION_COUNT": 0,
  "QUALITY_GATES_PASSED": false,
  "RAW_MUTATION_COUNT": 0,
  "TRACE_OR_LOG_SURFACE_LEAK_COUNT": 0,
  "abstention_population": {
    "expected": 40,
    "fn": 0,
    "fp": 0,
    "population_id": "ABSTENTION_POPULATION",
    "tp": 40
  },
  "abstention_precision": 1.0,
  "abstention_recall": 1.0,
  "all_gates_passed": false,
  "c1_audit_hash_verified": true,
  "candidate_uniqueness_rate": 1.0,
  "context_challenge_n": 64,
  "context_free_recall_at_5": 0.28125,
  "context_preferred_contingency": {
    "both_correct": 21,
    "context_free_only": 0,
    "contextual_only": 14,
    "lift": {
      "denominator": 64,
      "numerator_net": 14,
      "value_float": 0.21875,
      "value_unrounded": "7/32"
    },
    "neither_correct": 29
  },
  "context_target_contingency": {
    "both_correct": 5,
    "context_free_only": 0,
    "context_free_recall_at_5": 0.28125,
    "contextual_only": 5,
    "contextual_recall_at_5": 0.28125,
    "lift": {
      "denominator": 64,
      "numerator_net": 5,
      "value_float": 0.078125,
      "value_unrounded": "5/64"
    },
    "neither_correct": 54
  },
  "contextual_recall_at_5": 0.28125,
  "contextual_top1_lift": 0.078125,
  "core_target_candidate_population": {
    "correct_target_behind_identity_count": 62,
    "denominator": 307,
    "hit_rank_histogram": {
      "1": 239,
      "2": 62,
      "none": 6
    },
    "identity_at_rank1_count": 68,
    "no_target_count": 6,
    "population_id": "CORE_TRANSLITERATION_REQUIRED",
    "target_candidate_top1_accuracy": {
      "denominator": 307,
      "numerator": 239,
      "value_float": 0.7785016286644951,
      "value_unrounded": "239/307"
    },
    "target_mrr": {
      "denominator": 307,
      "numerator_sum": "270/1",
      "value_float": 0.8794788273615635,
      "value_unrounded": "270/307"
    },
    "target_recall_at_1": {
      "denominator": 307,
      "numerator": 239,
      "value_float": 0.7785016286644951,
      "value_unrounded": "239/307"
    },
    "target_recall_at_3": {
      "denominator": 307,
      "numerator": 301,
      "value_float": 0.9804560260586319,
      "value_unrounded": "301/307"
    },
    "target_recall_at_5": {
      "denominator": 307,
      "numerator": 301,
      "value_float": 0.9804560260586319,
      "value_unrounded": "301/307"
    }
  },
  "core_target_recall_at_5": 0.9804560260586319,
  "devanagari_identity_accuracy": 1.0,
  "english_identity_top1_accuracy": 1.0,
  "evaluator_version": "mai-07.1.3",
  "false_devanagari_preference_on_english": 0.0,
  "float_interpolation_usage_count": 0,
  "identity_presence_rate": 1.0,
  "independent_audit_scorer": {
    "c1_any_acceptable": {
      "agrees_with_canonical": true,
      "denominator": 319,
      "excluded_count": 0,
      "hit_rank_histogram": {
        "1": 319
      },
      "included_count": 319,
      "mrr": "1",
      "mrr_sum": "319",
      "no_hit_count": 0,
      "recall_at_1_numerator": 319,
      "recall_at_3_numerator": 319,
      "recall_at_5_numerator": 319,
      "top1_numerator": 319
    },
    "c2_target": {
      "agrees_with_canonical": true,
      "cases_with_no_acceptable_target_label": 0,
      "correct_target_behind_identity_count": 71,
      "denominator": 316,
      "hit_rank_histogram": {
        "1": 239,
        "2": 71,
        "none": 6
      },
      "identity_at_rank1_count": 77,
      "mrr": "549/632",
      "mrr_sum": "549/2",
      "no_target_count": 6,
      "recall_at_1_numerator": 239,
      "recall_at_3_numerator": 310,
      "recall_at_5_numerator": 310,
      "top1_numerator": 239
    }
  },
  "latency_ms_p95_observed": 0.8586999902036041,
  "leakage_audit": {
    "dataset_manifest_separate_from_resources": true,
    "errors": [],
    "legitimate_lexicon_token_overlap_count": 249,
    "legitimate_lexicon_token_overlap_sample": [
      "aaja",
      "aamdani",
      "aath",
      "aaunu",
      "aayo",
      "aba",
      "advance",
      "aile",
      "aja",
      "amdani",
      "ani",
      "anita",
      "baaki",
      "bakaya",
      "balance",
      "bank",
      "basnu",
      "bata",
      "bech",
      "beche"
    ],
    "ok": true,
    "runtime_files_scanned": 9
  },
  "mai07c2_correction": {
    "c1_retained_only_for_diagnostic_comparison": true,
    "note": "C2 gates score only non-identity Devanagari target candidates on V2 populations."
  },
  "mai07c_any_acceptable_diagnostic": {
    "candidate_ranking_population": {
      "denominator": 319,
      "hit_rank_histogram": {
        "1": 319
      },
      "mrr": {
        "denominator": 319,
        "numerator_sum": "319/1",
        "value_float": 1.0,
        "value_unrounded": "1"
      },
      "no_hit_count": 0,
      "population_id": "CANDIDATE_RANKING_POPULATION",
      "recall_at_1": {
        "denominator": 319,
        "numerator": 319,
        "value_float": 1.0,
        "value_unrounded": "1"
      },
      "recall_at_3": {
        "denominator": 319,
        "numerator": 319,
        "value_float": 1.0,
        "value_unrounded": "1"
      },
      "recall_at_5": {
        "denominator": 319,
        "numerator": 319,
        "value_float": 1.0,
        "value_unrounded": "1"
      },
      "top1_acceptable_accuracy": {
        "denominator": 319,
        "numerator": 319,
        "value_float": 1.0,
        "value_unrounded": "1"
      }
    },
    "core_candidate_population": {
      "denominator": 307,
      "hit_rank_histogram": {
        "1": 307
      },
      "mrr": {
        "denominator": 307,
        "numerator_sum": "307/1",
        "value_float": 1.0,
        "value_unrounded": "1"
      },
      "no_hit_count": 0,
      "population_id": "CORE_CANDIDATE_POPULATION",
      "recall_at_1": {
        "denominator": 307,
        "numerator": 307,
        "value_float": 1.0,
        "value_unrounded": "1"
      },
      "recall_at_3": {
        "denominator": 307,
        "numerator": 307,
        "value_float": 1.0,
        "value_unrounded": "1"
      },
      "recall_at_5": {
        "denominator": 307,
        "numerator": 307,
        "value_float": 1.0,
        "value_unrounded": "1"
      },
      "top1_acceptable_accuracy": {
        "denominator": 307,
        "numerator": 307,
        "value_float": 1.0,
        "value_unrounded": "1"
      }
    },
    "mrr": 1.0,
    "recall_at_5": 1.0,
    "semantically_insufficient_for_transliteration_quality": "C1 counts identity candidates as acceptable; C2 target metrics exclude them.",
    "top1_acceptable_accuracy": 1.0
  },
  "per_case_audit_content_hash": "c89a0c4e1031acec28d92ce9ccc8be0411e06207e696f44a28dcbfea3787c9d9",
  "per_case_audit_path": "evals/mai07/baselines/MAI_07_per_case_metric_audit_v2.jsonl",
  "population_counts": {
    "ABSTENTION_POPULATION": 40,
    "CONTEXT_CHALLENGE_POPULATION": 64,
    "CORE_TRANSLITERATION_REQUIRED": 307,
    "IDENTITY_REQUIRED": 145,
    "TRANSLITERATION_OPTIONAL_OR_AMBIGUOUS": 172,
    "TRANSLITERATION_REQUIRED": 316,
    "UNAMBIGUOUS_TRANSLITERATION": 209
  },
  "population_schema_version": "mai07-eval-populations-v2",
  "preferred_devanagari_top1": {
    "denominator": 212,
    "numerator": 182,
    "value_float": 0.8584905660377359
  },
  "proper_name_forced_transliteration_count": 0,
  "protected_identity_accuracy": 1.0,
  "runtime_output_semantic_hash": "097d500c37392383e974c110568799e738a3989f37c5d69dc20bd6d1141c72fd",
  "target_candidate_exclusion_ledger": {
    "no_acceptable_nonidentity_devanagari_target": 3,
    "suite_not_ranking_eligible": 10,
    "suite_not_ranking_eligible;abstention_expected;no_acceptable_nonidentity_devanagari_target": 40,
    "suite_not_ranking_eligible;context_challenge_separate": 22,
    "suite_not_ranking_eligible;context_challenge_separate;no_acceptable_nonidentity_devanagari_target": 42,
    "suite_not_ranking_eligible;no_acceptable_nonidentity_devanagari_target": 263
  },
  "target_candidate_mrr": 0.8686708860759493,
  "target_candidate_population": {
    "correct_target_behind_identity_count": 71,
    "denominator": 316,
    "hit_rank_histogram": {
      "1": 239,
      "2": 71,
      "none": 6
    },
    "identity_at_rank1_count": 77,
    "no_target_count": 6,
    "population_id": "TRANSLITERATION_REQUIRED",
    "target_candidate_top1_accuracy": {
      "denominator": 316,
      "numerator": 239,
      "value_float": 0.7563291139240507,
      "value_unrounded": "239/316"
    },
    "target_mrr": {
      "denominator": 316,
      "numerator_sum": "549/2",
      "value_float": 0.8686708860759493,
      "value_unrounded": "549/632"
    },
    "target_recall_at_1": {
      "denominator": 316,
      "numerator": 239,
      "value_float": 0.7563291139240507,
      "value_unrounded": "239/316"
    },
    "target_recall_at_3": {
      "denominator": 316,
      "numerator": 310,
      "value_float": 0.9810126582278481,
      "value_unrounded": "155/158"
    },
    "target_recall_at_5": {
      "denominator": 316,
      "numerator": 310,
      "value_float": 0.9810126582278481,
      "value_unrounded": "155/158"
    }
  },
  "target_candidate_recall_at_5": 0.9810126582278481,
  "target_candidate_top1_accuracy": 0.7563291139240507,
  "total_cases": 696,
  "unambiguous_target_population": {
    "correct_target_behind_identity_count": 30,
    "denominator": 209,
    "hit_rank_histogram": {
      "1": 179,
      "2": 30
    },
    "identity_at_rank1_count": 30,
    "no_target_count": 0,
    "population_id": "UNAMBIGUOUS_TRANSLITERATION",
    "target_candidate_top1_accuracy": {
      "denominator": 209,
      "numerator": 179,
      "value_float": 0.8564593301435407,
      "value_unrounded": "179/209"
    },
    "target_mrr": {
      "denominator": 209,
      "numerator_sum": "194/1",
      "value_float": 0.9282296650717703,
      "value_unrounded": "194/209"
    },
    "target_recall_at_1": {
      "denominator": 209,
      "numerator": 179,
      "value_float": 0.8564593301435407,
      "value_unrounded": "179/209"
    },
    "target_recall_at_3": {
      "denominator": 209,
      "numerator": 209,
      "value_float": 1.0,
      "value_unrounded": "1"
    },
    "target_recall_at_5": {
      "denominator": 209,
      "numerator": 209,
      "value_float": 1.0,
      "value_unrounded": "1"
    }
  },
  "unambiguous_target_top1": 0.8564593301435407
}
```
