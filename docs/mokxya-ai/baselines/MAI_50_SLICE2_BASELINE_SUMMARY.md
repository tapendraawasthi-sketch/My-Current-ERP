# MAI-50 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-50.0.2-slice2`  
**Authority:** ADR_0067 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `CANDIDATE_ONLY` Nepali/English speech channel candidate |
| Live ASR / TTS | not invoked (`allow_*=false`) |
| ASR / TTS / language / voice / mic plans | null |
| Speech channel enabled / ASR-TTS live / mic armed | false |
| GAP-P2-008 | remains OPEN |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai50_slice2.py`
- `nepali_english_speech_channel_consume_service.py`
- `evals/mai50/manifests/MAI_50_SLICE2.manifest.json`
