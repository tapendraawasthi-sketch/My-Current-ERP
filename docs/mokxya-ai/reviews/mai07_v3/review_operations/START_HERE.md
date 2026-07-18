# MAI-07 V3 Review Operations — START HERE

## What this automates
Mechanical packaging, validation, locking, agreement reports, and adjudication packaging.

## What only humans do
1. Choose real reviewers
2. Send role-specific ZIPs
3. Receive completed packages
4. Place returns in the role inbox folders
5. Verify reviewer identity/credentials manually
6. Send disagreement packet to the adjudicator (after Round B lock + agreement)

## One-click
- `RUN_REVIEW_WORKFLOW.bat` — advance workflow safely
- `CHECK_REVIEW_STATUS.bat` — print / open status

## Critical rules
- AI does **not** fill answers
- Round B never releases before Round A lock
- `LINGUIST_APPROVED` stays false until full professional workflow + manual credential verification
- Do not edit blind mapping
