# MAI-31 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-31.0.2-slice2`  
**Authority:** ADR_0048 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Default consume | `PAYLOAD_ONLY` draft payload candidate |
| Live `start_or_merge_*` | not invoked (`allow_port_invoke=false`) |
| Port executed | false |
| Draft mutations | 0 |
| Dexie / journal / mode_aware | false / not invoked |
| Incomplete / unsupported | `BLOCKED` |
| GAP-P0-001 | unchanged (no new writer) |
| GAP-P2-008 / GAP-P2-001 | remain OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai31_slice2.py`
- `domain_port_consume_service.py`
- `evals/mai31/manifests/MAI_31_SLICE2.manifest.json`
