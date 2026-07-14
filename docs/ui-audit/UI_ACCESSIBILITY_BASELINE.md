# UI Accessibility Baseline

Generated: 2026-07-13T11:54:20.809Z

## Tooling

Playwright + `@axe-core/playwright` with tags: wcag2a, wcag2aa, wcag21a, wcag21aa.

## Summary

| Metric | Value |
|--------|------:|
| Screens scanned | 7 |
| Axe violations (node groups) | 10 |
| Critical | 3 |
| Serious | 7 |
| Moderate | 0 |
| Minor | 0 |

## Keyboard smoke

| Screen | Result | Notes |
|--------|--------|-------|
| navigation | pass-partial | After Tab from dashboard, activeElement=BUTTON |
| command-palette | pass | Ctrl+K opened command palette dialog |
| orbix | pass | Orbix input focusable |
| transaction-form | smoke | Sales invoice form loaded for keyboard smoke; full form tab order not exhaustively verified |
| table | smoke | Party list loaded; table semantics deferred to axe findings |
| report-filters | smoke | Balance sheet loaded for filter/report keyboard smoke |
| login | blocked | Login outside harness; not keyboard-tested in UI QA path |

## Top violation IDs

- `color-contrast` (7)
- `select-name` (3)

## Policy

Do not treat this report as a completed accessibility remediation. Phase UI-0 records the baseline only.
