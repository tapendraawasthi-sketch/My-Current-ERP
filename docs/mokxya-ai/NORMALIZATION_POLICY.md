# NORMALIZATION_POLICY

## Allowed (SAFE_AUTOMATIC)

- Unicode NFC outside protected spans (UNICODE_CANONICAL / SAFE_SEMANTIC / RETRIEVAL)
- CRLF/CR → LF (SAFE_SEMANTIC / RETRIEVAL)
- Selected Unicode spaces → U+0020 (SAFE_SEMANTIC / RETRIEVAL)

## Retrieval-only

- Latin casefold (unprotected)
- Devanagari↔ASCII digit equivalence (unprotected only)
- Whitespace collapse / trim

## Candidate-only (never auto-applied)

- Quote/dash/danda punctuation equivalents
- Abbreviation expansions (`amt`, `dr`/`cr` with alternatives)
- Repetition reduction (`hellooo` → candidate)

## Prohibited

- Translitaration / phonetic conversion
- Semantic synonyms
- Entity resolution / account mapping
- Intent rewrite
- Global NFKC
- Silent removal of bidi/ZW/controls
- Transforming protected spans

## Protected spans

Copied code-point-exactly into every view. NUMBER_LITERAL digits remain unchanged (role deferred to MAI-09).

## Security

BIDI/ZW/controls → SECURITY_REVIEW_REQUIRED edits; preserved in RAW.

## Reconstruction integrity (MAI-06C2)

- Raw preservation ≠ structural reconstruction.
- Reconstruction uses normalized view + ordered applied edits + offset map + integrity descriptor.
- Reconstruction never uses `bundle.raw_text`.
- Digests bind source/view/edits/map/artifact under domain `MOKXYA_NORMALIZATION_RECONSTRUCTION_V1`.
- Trusted-descriptor integrity only — not a digital signature against an attacker who can replace data and digests together.
- Integrity digests must never appear in MAI-03 traces or routine logs.
- Candidate-only transformations remain unapplied.
- `production_approved` remains false; `GAP-P0-001` remains OPEN; MAI-07 remains NOT_STARTED.

## Future

- MAI-07: Romanized↔Devanagari candidates (not identity)
- MAI-08: typo robustness beyond repetition candidates
