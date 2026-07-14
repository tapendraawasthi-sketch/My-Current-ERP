# UI Responsive Baseline

Generated: Phase UI-0.9

## Viewport matrix

| Viewport | Used for |
|----------|----------|
| 1920x1080 | Desktop wide |
| 1600x900 | Desktop |
| 1440x900 | Primary baseline |
| 1366x768 | Common laptop |
| 1280x720 | Compact laptop |
| 1024x768 | Small desktop / large tablet |
| 768x1024 | Tablet |
| 430x932 | Large phone |
| 390x844 | iPhone-class |
| 360x800 | Small phone |

Surfaces scanned in `e2e/ui-baseline.spec.ts`: dashboard, Orbix, sales invoice, party list (table), balance sheet (report), bank reconciliation.

Screenshots (subset): light+dark at 1440x900, 1024x768, 390x844 under `artifacts/ui-baseline/current/`.

Full overflow matrix: `artifacts/ui-baseline/current/responsive-findings.json` (written by the baseline test).

## Classification guide used

- horizontal overflow
- clipped content
- inaccessible action
- unreadable text
- broken modal
- overlapping fixed elements
- unusable table
- touch-target issue
- dark-mode colour failure
- print-only problem
- expected desktop-only limitation

## Known structural risks (pre-redesign)

1. **Dense tables** (parties, day book, reports) become horizontally constrained below ~1024px — often expected desktop-only for accounting grids.
2. **AppShell sidenav** collapses and uses a drawer on mobile; long nav groups still require scrolling.
3. **Transaction forms** (billing/purchase) are desktop-oriented; mobile may clip side panels.
4. **Bank reconciliation** multi-pane layouts are high risk for overlap/overflow on &lt;1280 widths.
5. **Touch targets** below 44px are systemic (see typography/density metrics) — classify as touch-target issues on phone viewports.

## Policy

UI-0 records failures; it does **not** redesign screens to make tests pass.
