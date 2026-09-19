# MAI-06 eval

all_gates_passed=True

VALID_RECONSTRUCTION_ACCURACY=1.0
RAW_PRESERVATION_ACCURACY=1.0
EDIT_BASED_RECONSTRUCTION_ACCURACY=1.0
STRUCTURAL_CORRUPTION_DETECTION_RATE=1.0
SAME_LENGTH_ORIGINAL_SURFACE_CORRUPTION_DETECTION_RATE=1.0
CROSS_ARTIFACT_SUBSTITUTION_DETECTION_RATE=1.0

```json
{
  "total_cases": 470,
  "raw_text_mutation_count": 0,
  "VALID_RECONSTRUCTION_ACCURACY": 1.0,
  "RAW_PRESERVATION_ACCURACY": 1.0,
  "EDIT_BASED_RECONSTRUCTION_ACCURACY": 1.0,
  "STRUCTURAL_CORRUPTION_DETECTION_RATE": 1.0,
  "SAME_LENGTH_ORIGINAL_SURFACE_CORRUPTION_DETECTION_RATE": 1.0,
  "CROSS_ARTIFACT_SUBSTITUTION_DETECTION_RATE": 1.0,
  "VALID_ARTIFACT_FALSE_REJECTION_RATE": 0.0,
  "RAW_TEXT_SHORTCUT_USAGE_COUNT": 0,
  "FLOAT_INTERPOLATION_USAGE_COUNT": 0,
  "PROTECTED_SPAN_MUTATION_COUNT": 0,
  "SENSITIVE_ERROR_OR_TRACE_LEAK_COUNT": 0,
  "independent_reconstruction_cases": 1410,
  "independent_reconstruction_failures": 0,
  "protected_span_mutation_count": 0,
  "protected_identity_mapping_rate": 1.0,
  "offset_gaps": 0,
  "mapping_validator_failures": 0,
  "boundary_mapping_failures": 0,
  "idempotence_failures": 0,
  "silent_candidate_applications": 0,
  "prohibited_edits_applied": 0,
  "security_silent_removals": 0,
  "unicode_canonical_correctness": 1.0,
  "digit_equivalence_correctness": 1.0,
  "safe_automatic_precision": 1.0,
  "float_interpolation_usage_count": 0,
  "corrupt_edit_silent_success": 0,
  "analyzer_exceptions": 0,
  "latency_ms_p95_observed": 3.14410000009957,
  "latency_sample_count": 470,
  "thresholds": {
    "raw_mutations": 0,
    "preservation": 1.0,
    "structural": 1.0,
    "valid_recon": 1.0,
    "structural_corrupt": 1.0,
    "same_len": 1.0,
    "cross": 1.0,
    "false_reject": 0,
    "protected_identity": 1.0,
    "gaps": 0,
    "float": 0,
    "corrupt_silent": 0,
    "map_validator": 0,
    "idempotence_fail": 0,
    "silent_cand": 0,
    "prohibited": 0,
    "security_removal": 0,
    "leak": 0,
    "unicode": 0.995,
    "digit": 0.995,
    "safe_auto": 0.995
  },
  "gates": {
    "raw_ok": true,
    "preservation_ok": true,
    "structural_ok": true,
    "valid_recon_ok": true,
    "structural_corrupt_ok": true,
    "same_len_ok": true,
    "cross_ok": true,
    "false_reject_ok": true,
    "protected_ok": true,
    "protected_identity_ok": true,
    "gaps_ok": true,
    "map_validator_ok": true,
    "idemp_ok": true,
    "cand_ok": true,
    "prohibited_ok": true,
    "security_ok": true,
    "unicode_ok": true,
    "digit_ok": true,
    "safe_auto_ok": true,
    "float_ok": true,
    "corrupt_silent_ok": true,
    "leak_ok": true,
    "exceptions_ok": true,
    "shortcut_ok": true
  },
  "all_gates_passed": true
}
```
