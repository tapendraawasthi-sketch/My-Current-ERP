# UI Dark Mode Baseline

Generated: Phase UI-0.9

## Current mechanism

- Theme attribute: `document.documentElement[data-theme]` = `light` | `dark`
- Tokens: `src/styles/design-tokens.css` (`[data-theme="dark"]` overrides `--ox-*`)
- Persistence keys observed in tests: `orbix_theme_pref`, `sutra_theme`
- Shell chrome (`AppShell`) generally consumes `--ox-*` and therefore responds to theme

## Support claim vs reality

| Area | Dark-mode status |
|------|------------------|
| AppShell / sidenav / top bar | **Partial–good** (token-driven) |
| Orbix workspace | **Partial** |
| Feature pages with arbitrary hex / inline styles | **Weak / broken** — light hex baked in |
| Tally green shell | **Incompatible** (legacy green theme) |
| BusyShell primitives | **Weak** |
| Charts | **Unverified / palette-literal risk** |
| Print CSS | **N/A / print-only** |

## Baseline capture

`e2e/ui-baseline.spec.ts` captures light and dark for key surfaces. Manifest entries include `theme`.

## Failure classes to expect

- dark-mode colour failure (white/light panels forced via `#fff` / `#f5f6fa`)
- unreadable text (gray-500 on dark surfaces without token)
- border/contrast failures from pure `#000000` borders on dark backgrounds
- mixed theme islands (shell dark, page light)

## Policy

No production visual redesign in UI-0. Dark-mode debt is inventoried for Phase 1+ token enforcement.
