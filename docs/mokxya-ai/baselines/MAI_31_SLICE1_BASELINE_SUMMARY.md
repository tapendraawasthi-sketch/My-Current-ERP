# MAI-31 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-31.0.1-slice1`  
**Authority:** ADR_0048  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | EventFrame → domain port mapping annotation |
| Port executed | false |
| Draft mutations | 0 |
| Dexie invoked | false |
| Journal calculated | false |
| Mode-aware invoked | false |
| Master lookup | ANNOTATION_ONLY |
| GAP-P0-001 | unchanged (must not worsen) |
| GAP-P2-008 / GAP-P2-001 | remain OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai31_slice1.py`
- `domain_port_mapping_service` + ingress stage
- `evals/mai31/manifests/MAI_31_SLICE1.manifest.json`
