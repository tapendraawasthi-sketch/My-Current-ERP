# MAI-06 — Lossless Normalization

## 1. Objective

Create deterministic, reversible, provenance-preserving normalization views without replacing user raw text. No transliteration.

## 2. Pre-edit normalizer inventory

| Path | Behavior | MAI-06? |
|------|----------|--------|
| `nlu/text_normalize.py` | NFKC, spelling rewrites (`xa`→`cha`), digit convert, mutates for NLU | **Legacy only** |
| `falcon_trader/normalizer.py` | NFKC + lower + strip for matching | Legacy |
| Knowledge pipeline `normalize` stage | lower + whitespace collapse for RAG query | Unchanged |
| `language_runtime` MAI-05 | Annotation only | Upstream |
| `language_runtime/normalization` | Named views + edits | **Canonical** |

Stop conditions: none. Raw preserved at ingress. Protected spans available from LanguageFrame.

## 3. Selected normalization authority

`erp_bot/src/oip/modules/language_runtime/normalization/` — version `mai-06.1.1` (integrity closure). Resource pack remains `mai-06.1.0`.

## 4. Raw-text immutability

`CanonicalAIRequestV1.raw_text` and `NormalizationBundleV1.raw_text` always equal the original. Views are derived.

## 5–8. Views / edits / safety / offsets

See `NORMALIZATION_POLICY.md` and `ADR_0007`. Offset unit UNICODE_CODE_POINT. Structural reconstruction uses view + edits + map + integrity metadata (never raw).

## 9–16. Unicode / whitespace / digits / casefold / candidates / security

NFC only (no global NFKC). Casefold + digit equivalence + whitespace collapse = RETRIEVAL. Candidates never applied. Controls flagged, not erased.

## 17. Protected-span enforcement

Identity copy into every view. Overlaps rejected. Mutation count: **0** on MAI-06 eval.

## 18–19. Reversibility / idempotence

### Closure (structural reversibility)

Two *separate* properties are enforced:

**PROPERTY A — RAW PRESERVATION** via `get_preserved_raw(bundle)` → `bundle.raw_text`.

**PROPERTY B — EDIT-BASED RECONSTRUCTION** via
`reconstruct_from_view(view_text, applied_edits, offset_map, integrity=...)`
which **must not** read `bundle.raw_text`.

Previous behavior that only returned `bundle.raw_text` is no longer accepted as Property B.

Exact integer code-point boundary ranges replace all float-ratio/proportion mapping.
Many-to-one and one-to-many segments map to explicit boundary ranges (no interpolation).

### MAI-06C2 — self-validating structural reconstruction

Each reversible view carries `ReconstructionIntegrityV1` (SHA-256 digests with domain
`MOKXYA_NORMALIZATION_RECONSTRUCTION_V1`). Before/after reconstruction the API validates
view/edits/map/artifact digests and reconstructed source digest. Corruption (including
same-length `original_surface` changes) raises typed `ReconstructionIntegrityError`
(or `UnsupportedReconstructionVersionError`) — never silent wrong text.

Integrity metadata is a **trusted-descriptor** check, not a digital signature /
adversarial authenticity mechanism. Digests are sensitive and must not appear in
MAI-03 traces, routine logs, or error payloads.

Anti-shortcut tests destroy/replace `bundle.raw_text` and still recover original from
view+edits+map+integrity. Generated corpus: seed `20260714`, **1000** combinations
(valid + one structural mutation each).

100% reconstruction on valid artifacts; normalize(raw) twice → identical digests and texts.

## 20. Resource pack

`normalization/resources/` — hashed, load-once, second-run no-diff.

## 21. Active integration

Ingress: MAI-05 → NORMALIZATION_* → `LanguageFrameV1.normalization_bundle`. Intent still uses raw.

## 22. Legacy normalizer boundary

`nlu.text_normalize` marked `MAI06_CANONICAL=False`; not auto-fed MAI-06 views.

## 23–25. Dataset / metrics / regression

470 cases; gates passed. MAI-04/05 hashes unchanged.

## 26–28. Security / accounting / limitations

No raw/normalized/reconstructed text or integrity digests in traces/errors. No accounting,
posting, sync, OEC, routing, or prompt impact. Candidate-only transforms still unapplied.
No transliteration (MAI-07). `GAP-P0-001` remains OPEN. Linguist review for candidate quality.

## 29. Rollback

Remove integrity fields/helpers and revert normalizer to `mai-06.1.0` behavior; or remove
normalization package + MAI-06 evals/docs; revert ingress hook and optional LanguageFrame field.

## 30. Gate verdict

**PASSED** (MAI-06C2 integrity closure). `production_approved=false`. MAI-07 remains **NOT_STARTED**.
