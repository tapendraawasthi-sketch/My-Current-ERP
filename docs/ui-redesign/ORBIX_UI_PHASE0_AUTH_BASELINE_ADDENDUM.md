# Phase UI-0 Authentication Baseline Addendum

**Date:** 2026-07-13  
**Related:** `ORBIX_UI_PHASE0_BASELINE_AND_GOVERNANCE_REPORT.md`

## Result

Phase UI-0 was blocked on Login and Company Selector because `/e2e/ui-qa.html` auto-authenticates.

Phase UI-1 introduced `/e2e/ui-auth.html` (real `GatewayScreen` + `CompanyLoginScreen`, no auto-auth).

### Captures completed

| Screen | Viewports | Themes | States |
|--------|-----------|--------|--------|
| Login | 1440x900, 390x844 | light, dark | default, validation-error, password-visible |
| Company selector | 1440x900, 390x844 | light, dark | one-company, empty |

Artifacts: `artifacts/ui-baseline/current/login__*.png`, `company-selector__*.png`  
Manifest: `artifacts/ui-baseline/current/manifest.json`  
Fixture docs: `docs/ui-testing/UI_AUTH_VISUAL_FIXTURE.md`

### Skipped (component limitation)

- **multiple-company** — production `GatewayScreen` renders a single `companySettings` card only.

### Loading / locked states

- Loading requires a hanging `login()` — not forced in baseline (would risk session). Validation-error and failed-password paths covered instead.
- Locked state requires 5 failures — not automated in baseline captures.

## Verdict

**PHASE UI-0 AUTHENTICATION VISUAL BASELINE COMPLETED**

(The original UI-0 ENVIRONMENT-BLOCKED verdict is superseded for the auth gap by this addendum; other UI-0 findings remain valid.)
