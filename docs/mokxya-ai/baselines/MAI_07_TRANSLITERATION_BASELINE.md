# MAI_07_TRANSLITERATION_BASELINE

- Dataset V1 (immutable): `5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208`
- Cases: **696**

## Active baseline (MAI-07R3A)

- Runtime/pack: `mai-07.1.0`
- Resource: `18628335c0feb74a4f28f65ca70b2683f8b54a54790fd03e9033d8cd08ed4566`
- Semantic: `b28e8240bf0c4faa1253212c40e721f77148516fb3a2a3303582303b8a035849`
- Overlay: **disabled** (`ENABLE_PROMOTION_OVERLAY=false`)
- Target top-1 (C2): **261/316**
- Conflict set (recomputed): **49** = 31 english_identity + 18 name-like

## Historical

| Phase | Result |
|-------|--------|
| C2 | QUALITY fail 261/316 |
| R1 | Failed / regressed 239/316 |
| R2 | Holdout fail; frozen not run |
| R3A | Policy review packet; blocked pending human review |

## Gates

| Flag | Value |
|------|-------|
| QUALITY_GATES_PASSED | false |
| LINGUIST_APPROVED | false |
| PRODUCTION_APPROVED | false |
| R3A | BLOCKED_PENDING_HUMAN_POLICY_REVIEW |
