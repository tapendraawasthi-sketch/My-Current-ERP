# TRANSLITERATION_RESOURCE_PROVENANCE

Pack family: `mai07_transliteration_pack_*`

| Version | Content hash | Authority |
|---------|--------------|-----------|
| **`mai-07.1.13-r3s-active` / pack `mai-07.1.11-r3n6-chaincomplete` (ACTIVE default)** | `8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106` | ADR_0024 cutover; V3-qualified R3N6 pack under R3S runtime identity; R3N4 finalize on default attach path |
| `mai-07.1.3-r3f-sealnew` (previous active; lineage only) | `1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930` | Pre-R3S active; retained under `sealed_packs/` |
| `mai-07.1.11-r3n6-chaincomplete` (qualified pack bytes) | `8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106` | Same bytes as active pack; also addressable as candidate pack dir |
| `mai-07.1.5-r3h2-shared` (R3H2 RC pack; not default active) | `8716589a172b47c4d4b3a2419ee442b5b3c0aa170e2bb5e9aff742810878e60a` | Non-frozen R3H2 sealed pack; policy `mai-07-r3h2.1.0.0`; holdout **PASSED_CORRECTIVE_RC**; **not promoted** |
| `mai-07.1.4-r3h-englishid` (R3H RC pack; not default active) | `2a4599fe3fccb83257130407324321b4121e5c01fe6efcdc32406ebdcacded7e` | Non-frozen R3H sealed pack derived from `mai-07.1.3-r3f-sealnew`; identity-disposition policy `mai-07-r3h.1.0.0`; holdout **FAILED_HOLDOUT_QUALITY**; overlay disabled |
| `mai-07.1.2-r3f` historical claim | `e94cc8c7775d9ce77ab854ab478387d950a018ba1b76d96e9749d4aad425e50a` | INVALIDATED_BY_SEAL_DRIFT — claim preserved in `resources/`; unrestorable |
| `mai-07.1.1-r3d` parent | `083bce288907c0db882bdf7082bf9093e9086035c653dadcd4964625b61e966f` | R3D corrective parent |
| `mai-07.1.0` parent | `18628335c0feb74a4f28f65ca70b2683f8b54a54790fd03e9033d8cd08ed4566` | Pre-R1 / R3A–R3C safe baseline (parent) |
| `mai-07.2.0` R1 failed | `0f0af894…` | Archived `historical_r1/` — non-authoritative |
| `mai-07.3.0` R2 failed | `c1c5a603…` | Overlay config archived `historical_r2/` — non-authoritative |

Active path: `transliteration/sealed_packs/mai-07.1.11-r3n6-chaincomplete/`.  
Previous active path: `transliteration/sealed_packs/mai-07.1.3-r3f-sealnew/`.  
Historical invalidated path: `transliteration/resources/` (claim `e94cc8c…` only).

`ENABLE_PROMOTION_OVERLAY=false`. Production must not enable failed R2 overlay.

Fresh SEAL-NEW datasets: `evals/mai07_r3f_seal_new/` (`prohibited_for_training=true`).

`LINGUIST_APPROVED=true`.  
`QUALITY_GATES_PASSED=true` (V3 FE / R3Q).  
`PRODUCTION_APPROVED=true` (ADR_0023).  
`candidate_promoted=true` (ADR_0024).  
R3Q identity `mai-07.1.12-r3q-protspan` is **eval alignment only** (no sealed pack directory).  
MAI-08 = NOT_STARTED.
