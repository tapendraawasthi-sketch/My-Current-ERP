# MAI_05_LANGUAGE_SPAN_BASELINE

## Dataset

- Manifest: `evals/mai05/manifests/MAI_05_LANGUAGE_SPANS_V1.manifest.json`
- Total cases (eval report): 470 annotated utterances across shards
- `prohibited_for_training=true`
- Review: ENGINEERING_REVIEWED + SECURITY_REVIEWED on Unicode shards; Romanized uncertain cases marked ambiguous / linguist-review-required where needed

## Targeted eval (frozen V1 gold)

| Metric | Value | Threshold | Pass |
|--------|-------|-----------|------|
| raw_text_mutation_count | 0 | 0 | ✓ |
| offset_roundtrip_failures | 0 | 0 | ✓ |
| uncovered_codepoints | 0 | 0 | ✓ |
| overlapping_base_spans | 0 | 0 | ✓ |
| script_char_accuracy | 1.0 | ≥0.995 | ✓ |
| protected_span_exact_f1 | 1.0 | ≥0.98 | ✓ |
| url_email_precision | 1.0 | ≥0.99 | ✓ |
| language_form_macro_f1 | 0.962 | ≥0.90 | ✓ |
| romanized_precision | 1.0 | ≥0.90 | ✓ |
| ambiguous_latin_accuracy | 1.0 | ≥0.85 | ✓ |

`all_gates_passed`: true (`evals/mai05/baselines/MAI_05_eval_report.json`)

Dataset hash: `2eb4f0d8edd5544fb8266fd8eebf6eceffd40f13db1f37b6892eb48ea61dbe7c`  
Unique utterances: 470 · protected-annotated cases: 120 · ambiguous cases: 120 · accounting-tagged: 260

### Per-form (engineering-reviewed)

- ENGLISH: P=1.0 R=0.8 F1≈0.889
- NEPALI_DEVANAGARI: P/R/F1=1.0
- ROMANIZED_NEPALI: P/R/F1=1.0
- SHARED_OR_AMBIGUOUS_LATIN: high precision/recall on gold ambiguous suite

## Latency (local warm, n=100 medium-mix samples)

- cold resource load ≈1.1 ms
- p50 ≈0.13 ms, p95 ≈0.21 ms (under 25 ms target)
- adversarial ~8k code points ≈6 ms, no timeout

## Remaining weaknesses

- English recall tradeoff vs ambiguous abstention (names/short tokens)
- Full naturalness review for Romanized still linguist-pending
- No normalization/transliteration coverage (deferred)

## Analyzer / resources

- Analyzer: `mai-05.1.0`
- Resource pack hash: `6fd49e99acbea3f15fb9442d741d38982391a57438300d15926a5aececb06aa6`
