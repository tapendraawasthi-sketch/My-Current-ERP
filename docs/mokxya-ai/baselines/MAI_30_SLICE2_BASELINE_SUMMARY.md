# MAI-30 Slice 2 — Baseline Summary

**Date:** 2026-07-19  
**Runtime:** `mai-30.0.2-slice2`  
**Authority:** ADR_0047 (slice 2 addendum)  
**Status:** Engineering baseline (not production-approved)

## Verdict

| Field | Value |
|-------|-------|
| Consume | Gate grounding / safe no-answer when ungrounded |
| Ungrounded claim-like | `ABSTAIN_UNGROUNDED` + `SAFE_NO_ANSWER_BLOCK` |
| Grounded candidates | `ALLOW_WITH_CANDIDATES` (still unverified) |
| Claims verified | false |
| Citations verified | false |
| Verifier executed | false |
| Legal proof claimed | false |
| Fake citation allowed | false |
| GAP-P2-008 | remains OPEN (progress only; professional review pending) |
| GAP-P2-001 | remains OPEN |
| GAP-P1-004 / GAP-P1-008 | remain REDUCED |
| `production_approved` | false |

## Evidence

- `erp_bot/tests/oip/language_runtime/test_mai30_slice2.py`
- `claim_citation_service` consume helpers + `prompt_grounding` gate
- `evals/mai30/manifests/MAI_30_SLICE2.manifest.json`
