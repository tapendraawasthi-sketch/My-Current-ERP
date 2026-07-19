# MAI-17 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-17.0.2-slice2`  
**Authority:** ADR_0034 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| OOD abstain | wired into mode_aware clarify path |
| Draft mutations on abstain | none |
| Pending clarify continuity | preserved |
| Soft OOD | mutating ops only |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai17_slice2.py`
- `should_abstain_router_decision` + mode_aware gate
- `evals/mai17/manifests/MAI_17_SLICE2.manifest.json`
