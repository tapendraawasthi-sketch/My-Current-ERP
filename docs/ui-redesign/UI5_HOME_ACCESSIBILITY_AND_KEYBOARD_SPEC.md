# UI-5 — Home Accessibility and Keyboard Spec

**Surface:** `HomePage` inside AppShell  
**Target:** zero **serious** / **critical** axe violations on the home fixture (`e2e/ui5-home.spec.ts`)

## Headings

- Page title via design-system `PageHeader` → accessible **Home** heading hierarchy.
- Section headings for financial overview (`h2#home-financial-heading`) and `SectionHeader` titles for Attention, Quick actions, Activity, Orbix, charts.
- Do not skip levels for decorative chrome.

## Focusable only when interactive

| Element | Focusable? |
|---------|------------|
| Metric with drill-down | Yes (`<button>`) |
| Metric unavailable / no route | No (`<div>`) |
| Attention row with route | Yes |
| Attention without route | Disabled button / non-action |
| Quick actions, activity rows, Orbix prompts, Refresh | Yes |
| Static trust copy, freshness text, bar tracks | No |

All interactive controls use visible focus (`focus-visible` / DS focus ring). Minimum touch target ≈ 44px on quick actions (`min-h-11`).

## Charts

Receivable ageing must expose:

1. Text **accessible summary** (`accessibleSummary`)
2. Visual bars marked `role="img"` with the same summary
3. A **data table** with caption for bucket / count / amount

Keyboard users reach “View report” and can tab through the table without needing the bars.

## Keyboard

- Tab order follows visual order: header actions → banners → main sections → aside.
- Enter/Space activate buttons (native).
- No positive `tabIndex` on non-interactive nodes.
- Shell skip link / command palette remain AppShell responsibilities (out of Home scope but must not be broken by Home markup).

## Axe target

- Tags: WCAG 2.0/2.1 A/AA as in prior UI phases.
- Scope: `[data-testid="home-page"]` on `/e2e/ui-home.html`.
- **Pass criterion:** `serious_or_critical.length === 0`.
