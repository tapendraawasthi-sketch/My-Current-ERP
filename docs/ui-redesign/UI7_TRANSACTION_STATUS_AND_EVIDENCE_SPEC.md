# UI-7 — Transaction Status and Evidence Spec

| State | Label | Rule |
|-------|-------|------|
| draft | Draft | Not posted |
| validating | Validating | Local only |
| posting | Posting | Disable double submit |
| posted_local | Posted locally | Domain commit succeeded |
| pending | Waiting to sync | Enqueued / pending ack |
| synced | Synced | Remote acknowledgement only |
| failed | Failed | Retryable unless conflict |
| conflict | Conflict — review required | Never auto-retry as ordinary failure |

Evidence panel may show document number, amount, posting id short form, sync status, warnings. No secrets, tokens, provider names, or unauthorized cost.
