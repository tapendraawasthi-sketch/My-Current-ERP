# MAI_06_NORMALIZATION_BASELINE

## Dataset

- Manifest: `evals/mai06/manifests/MAI_06_LOSSLESS_NORMALIZATION_V1.manifest.json`
- Hash: `abe90267a94479f58be9fa7caf353fcd069ea3e2f77145a3fe68c884fcc23bc5`
- Total unique cases: **470**
- `prohibited_for_training=true`

| Suite | Count |
|-------|------:|
| unicode_canonical_v1 | 70 |
| whitespace_v1 | 50 |
| digit_equivalence_v1 | 50 |
| protected_no_change_v1 | 100 |
| punctuation_candidates_v1 | 50 |
| abbreviation_candidates_v1 | 20 |
| repetition_candidates_v1 | 20 |
| offset_mapping_v1 | 60 |
| unicode_security_v1 | 30 |
| adversarial_v1 | 20 |

## Resources

- Pack: `mai06_normalization_pack_v1` / `mai-06.1.0`
- Hash: `4558bcad1f2c7915968faa8a7371bb3e1f038fd4732eafd6203ea837f437e65f`

## Metrics (gates all passed — after MAI-06C2 integrity closure)

| Metric | Value | Threshold |
|--------|-------|-----------|
| VALID_RECONSTRUCTION_ACCURACY | 1.0 | 1.0 |
| RAW_PRESERVATION_ACCURACY | 1.0 | 1.0 |
| EDIT_BASED_RECONSTRUCTION_ACCURACY | 1.0 | 1.0 |
| STRUCTURAL_CORRUPTION_DETECTION_RATE | 1.0 | 1.0 |
| SAME_LENGTH_ORIGINAL_SURFACE_CORRUPTION_DETECTION_RATE | 1.0 | 1.0 |
| CROSS_ARTIFACT_SUBSTITUTION_DETECTION_RATE | 1.0 | 1.0 |
| VALID_ARTIFACT_FALSE_REJECTION_RATE | 0 | 0 |
| RAW_TEXT_SHORTCUT_USAGE_COUNT | 0 | 0 |
| FLOAT_INTERPOLATION_USAGE_COUNT | 0 | 0 |
| PROTECTED_SPAN_MUTATION_COUNT | 0 | 0 |
| SENSITIVE_ERROR_OR_TRACE_LEAK_COUNT | 0 | 0 |
| raw mutations | 0 | 0 |
| protected identity mapping rate | 1.0 | 1.0 |
| corrupt-edit silent success | 0 | 0 |
| mapping validator failures | 0 | 0 |
| offset gaps | 0 | 0 |
| idempotence failures | 0 | 0 |
| silent candidates | 0 | 0 |
| prohibited applied | 0 | 0 |
| security silent removal | 0 | 0 |
| unicode canonical | 1.0 | ≥0.995 |
| digit equivalence | 1.0 | ≥0.995 |
| SAFE_AUTOMATIC precision | 1.0 | ≥0.995 |

Normalizer: `mai-06.1.1`. Resource hash unchanged.
Generated structural + integrity corruption corpus: seed `20260714`, n=1000 (reported separately from frozen quality dataset).

Observed p95 latency ~1–2 ms (n=470 frozen + generated tests, local, not an SLO).

## Remaining limitations

- Digit equivalence skips NUMBER_LITERAL-protected runs (by design).
- Integrity digests are trusted-descriptor checks, not adversarial signatures.
- No transliteration (MAI-07 NOT_STARTED).
- `production_approved=false`; GAP-P0-001 OPEN.
- Candidate quality needs linguist review.
