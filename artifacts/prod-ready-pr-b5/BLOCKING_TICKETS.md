# PR-B5 blocking tickets

## TICKET-PR-B5-001 — Staging professional knowledge honesty review

- **Status:** OPEN
- **Blocks:** GAP-P2-008 CLOSED; contributes to PR-C caution (with PR-B1 tickets)
- **Does not block:** PR-B6 hygiene engineering
- **Required:** Professional reviewer re-runs the six critical
  `knowledge_no_answer_v1` cases on staging Ask MokXya path and attests
  naturalness / product wording (or files a blocking FIX list).
- **Clear when:** Sign note updated to `staging_professional_review_status=PASS`
  with reviewer name/date under `artifacts/prod-ready-pr-b5/manual/`, and
  `RUN_STATUS.json` `staging_professional_attested=true`.

## Related open tickets (unchanged)

- TICKET-PR-B1-001 / TICKET-PR-B1-002 — still block PR-C
- TICKET-PR-B3-001 — staging conflict attestation PENDING
