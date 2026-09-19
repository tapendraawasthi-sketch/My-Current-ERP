# MAI-05 evaluation

```json
{
  "total_cases": 470,
  "raw_text_mutation_count": 0,
  "uncovered_codepoints": 0,
  "overlapping_base_spans": 0,
  "offset_roundtrip_failures": 0,
  "script_char_accuracy": 1.0,
  "protected_span_exact_f1": 1.0,
  "url_email_precision": 1.0,
  "language_form_macro_f1": 0.9622222222222223,
  "language_form_per_class": {
    "ENGLISH": {
      "precision": 1.0,
      "recall": 0.8,
      "f1": 0.888888888888889
    },
    "NEPALI_DEVANAGARI": {
      "precision": 1.0,
      "recall": 1.0,
      "f1": 1.0
    },
    "ROMANIZED_NEPALI": {
      "precision": 1.0,
      "recall": 1.0,
      "f1": 1.0
    },
    "SHARED_OR_AMBIGUOUS_LATIN": {
      "precision": 0.9230769230769231,
      "recall": 1.0,
      "f1": 0.9600000000000001
    }
  },
  "romanized_precision": 1.0,
  "ambiguous_latin_accuracy": 1.0,
  "quality_flag_recall": 1.0,
  "engineering_reviewed_form_pairs": 320,
  "thresholds": {
    "script_char_accuracy": 0.995,
    "protected_f1": 0.98,
    "url_email_precision": 0.99,
    "macro_f1": 0.9,
    "romanized_precision": 0.9,
    "ambiguous_accuracy": 0.85,
    "raw_mutations": 0,
    "uncovered": 0,
    "overlaps": 0,
    "offset_fail": 0
  },
  "gates": {
    "raw_mutations_ok": true,
    "offset_ok": true,
    "script_ok": true,
    "protected_ok": true,
    "url_email_ok": true,
    "macro_f1_ok": true,
    "romanized_ok": true,
    "ambiguous_ok": true
  },
  "all_gates_passed": true
}
```
