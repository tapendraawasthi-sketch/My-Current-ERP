# MAI-30 Slice 1 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-30.0.1-slice1`  
**Authority:** ADR_0047  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Mode | Claim-citation / grounded-answer policy annotation |
| Grounded answer policy | ABSTAIN_WHEN_UNGROUNDED |
| Claims verified | false |
| Citations verified | false |
| Verifier executed | false |
| Legal proof claimed | false |
| Fake citation allowed | false |
| GAP-P2-008 | remains OPEN |
| GAP-P2-001 | remains OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai30_slice1.py`
- `claim_citation_service` + ingress stage
- `evals/mai30/manifests/MAI_30_SLICE1.manifest.json`
