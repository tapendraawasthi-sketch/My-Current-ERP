# Package Validation Report (Phase 1)

Generated: 2026-07-14T04:55:51+00:00
Status: **passed_with_warnings**

## Counts

- Numbered files found: 88
- Expected: 88
- Missing IDs: none
- Duplicate IDs: none
- Zero-byte files: 0
- UTF-8 failures: 0
- Critical issues: 0
- Error issues: 310
- Warning issues: 721
- Duplicate whole-file hashes: none
- Cross-file reused record IDs: 192
- Total records detected: 5692378

## Raw integrity

- All before/after SHA-256 matched: **True**

## Notes

- Structural warnings do not block Phase 2 if all 88 files exist.
- Critical corruption blocks production index creation.
- Language signals are detectors only — not human language approval.

## Validation checks performed

- 88 numbered files 0001-0088
- UTF-8 decode (streaming)
- END OF FILE marker
- filename / document identity
- record headers and duplicate IDs
- declared statistics where verifiable
- language signals (non-approving)
- raw SHA-256 before/after immutability
