# ADR_0007 — Lossless Normalization Authority

## Status

Accepted (MAI-06)

## Decision

1. Canonical normalizer: `oip.modules.language_runtime.normalization`.
2. Views: RAW, UNICODE_CANONICAL (NFC), SAFE_SEMANTIC, RETRIEVAL. No transliterated view.
3. NFC yes; global NFKC no.
4. Safety classes: SAFE_AUTOMATIC, RETRIEVAL_ONLY, CANDIDATE_ONLY, SECURITY_REVIEW_REQUIRED, PROHIBITED.
5. Protected spans copied unchanged; overlap edits rejected.
6. Offset maps use UNICODE_CODE_POINT exact integer boundaries (`BoundaryRange`). MANY_TO_ONE / ONE_TO_MANY are explicit. No float-ratio interpolation.
7. Property A: `get_preserved_raw(bundle)`. Property B: `reconstruct_from_view(view, edits, map, integrity)` without reading `raw_text`.
8. Reversible views bind `ReconstructionIntegrityV1` digests (trusted descriptor, not a signature).
9. Legacy `nlu/text_normalize.py` remains an isolated mutating NLU adapter — not MAI-06.
10. MAI-07 owns transliteration; MAI-08 owns broader typo robustness.

## Rejected

| Alternative | Why |
|-------------|-----|
| Make text_normalize the MAI-06 authority | Mutates, NFKC, spelling rewrites |
| Auto-switch intent to RETRIEVAL | Changes routing — out of scope |
| NFKC globally | Compatibility folding harms identifiers |
| Silent candidate application | Violates provenance |

## Closure clarification (reversibility)

- Returning stored `raw_text` is **preservation**, not reconstruction.
- True reconstruction inputs: `view_text` + applied edits + `OffsetMapV1` + `ReconstructionIntegrityV1`.
- Mapping uses exact integer code-point boundaries (`BoundaryRange`); never float ratios or proportional interpolation.
- MANY_TO_ONE / ONE_TO_MANY are explicit segment kinds with conservative span mapping.
- `reconstruct_from_view` raises typed errors:
  - `ReconstructionValidationError` — map/edit structural issues
  - `ReconstructionIntegrityError` — digest / binding mismatch (incl. same-length `original_surface` corruption)
  - `UnsupportedReconstructionVersionError` — missing/unsupported integrity schema or normalizer version
- Errors expose only safe codes/counts — never surfaces, reconstructed text, or digests.
- Integrity model detects accidental or unauthorized artifact modification **when the descriptor is trusted**; it is not adversarial authenticity.

## Version

- Normalizer implementation: `mai-06.1.1`
- Resource pack: `mai-06.1.0` (unchanged unless resources change)
- Integrity schema: `1.0.0` / algorithm SHA-256 / domain `MOKXYA_NORMALIZATION_RECONSTRUCTION_V1`
