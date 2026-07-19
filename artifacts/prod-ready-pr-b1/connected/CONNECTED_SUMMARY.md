# Connected run summary (PR-B1)

**Date:** 2026-07-19  
**Target:** `http://127.0.0.1:8765` (local dev; `RENDER=false`)  
**Command:** `ORBIX_E2E_CONNECTED=true npx playwright test` on next12 + connected + sales-connected + sync  

## Result

| Metric | Count |
|--------|------:|
| Passed | 1 |
| Failed | 13 |
| Skipped | 5 |
| Did not run | 5 |

## Notes

- Health/ready API check passed.
- SSE `/orbix/chat/stream` paths often returned `general_error` / null complete (provider env incomplete locally).
- Browser specs failed: Playwright `chromium_headless_shell` missing in agent cache — run `npx playwright install`.
- Full machine log kept locally as `playwright-pr-b1.log` (gitignored); this summary is the committed evidence.
- Staging URL attestation still required before clearing TICKET-PR-B1-002 for PR-C.
