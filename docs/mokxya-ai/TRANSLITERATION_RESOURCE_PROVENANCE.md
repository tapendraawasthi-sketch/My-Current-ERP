# TRANSLITERATION_RESOURCE_PROVENANCE

Pack family: `mai07_transliteration_pack_*`

| Version | Content hash | Authority |
|---------|--------------|-----------|
| **`mai-07.1.3-r3f-sealnew` (ACTIVE default)** | `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930` | SEAL-NEW versioned pack under seal-contract 2.0.0; decision logic unchanged from intended R3F; `SEALED_READ_ONLY` |
| `mai-07.1.5-r3h2-shared` (R3H2 RC pack; not default active) | `8716589a172b47c4d4b3a2419ee442b5b3c0aa170e2bb5e9aff742810878e60a` | Non-frozen R3H2 sealed pack; policy `mai-07-r3h2.1.0.0`; holdout **PASSED_CORRECTIVE_RC**; **not promoted** |
| `mai-07.1.4-r3h-englishid` (R3H RC pack; not default active) | `2a4599fe3fccb83257130407324321b4121e5c01fe6efcdc32406ebdcacded7e` | Non-frozen R3H sealed pack derived from `mai-07.1.3-r3f-sealnew`; identity-disposition policy `mai-07-r3h.1.0.0`; holdout **FAILED_HOLDOUT_QUALITY**; overlay disabled |
| `mai-07.1.2-r3f` historical claim | `e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a` | INVALIDATED_BY_SEAL_DRIFT — claim preserved in `resources/`; unrestorable |
| `mai-07.1.1-r3d` parent | `083bce288907c0db882bdf7082bf9093e9086035c653dadcd4964625b61e966f` | R3D corrective parent |
| `mai-07.1.0` parent | `18628335c0feb74a4f28f65ca70b2683f8b54a54790fd03e9033d8cd08ed4566` | Pre-R1 / R3A–R3C safe baseline (parent) |
| `mai-07.2.0` R1 failed | `0f0af894…` | Archived `historical_r1/` — non-authoritative |
| `mai-07.3.0` R2 failed | `c1c5a603…` | Overlay config archived `historical_r2/` — non-authoritative |

Active path: `transliteration/sealed_packs/mai-07.1.3-r3f-sealnew/`.  
Historical invalidated path: `transliteration/resources/` (claim `e94cc8c…` only).

`ENABLE_PROMOTION_OVERLAY=false`. Production must not enable failed R2 overlay.

Fresh SEAL-NEW datasets: `evals/mai07_r3f_seal_new/` (`prohibited_for_training=true`).

`LINGUIST_APPROVED=false`.  
`PRODUCTION_APPROVED=false`.
