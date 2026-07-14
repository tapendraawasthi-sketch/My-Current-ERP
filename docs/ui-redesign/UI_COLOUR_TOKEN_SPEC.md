# UI Colour Token Spec

**Authority:** `docs/ui-redesign/ORBIX_UI_IMPLEMENT_NOW.md`  
**Source of truth:** `src/design-system/foundations/tokens.css`

Legacy `#9DC07A` / `#EBF5E2` greens are **not** default semantic tokens. Scoped under `.legacy-tally` only.

## Light palette (IMPLEMENT_NOW)

| Token | Value |
|-------|-------|
| `--ds-action-primary` | `#0F5C8C` |
| `--ds-action-primary-hover` | `#0C4A72` |
| `--ds-action-primary-pressed` | `#0A3A5A` |
| `--ds-canvas` | `#F3F5F7` |
| `--ds-surface` | `#FFFFFF` |
| `--ds-surface-muted` | `#EEF1F4` |
| `--ds-surface-inverse` | `#14212B` |
| `--ds-text-strong` | `#14212B` |
| `--ds-text-default` | `#2A3845` |
| `--ds-text-muted` | `#5C6B79` |
| `--ds-border-default` | `#D5DCE3` |
| `--ds-intelligence` | `#0A7A7A` (Orbix only) |
| `--ds-status-success` | `#0F6B56` |
| `--ds-status-warning` | `#8A5A12` |
| `--ds-status-danger` | `#B4232F` |
| `--ds-brand-50` | `#F0F7FC` |
| `--ds-focus-ring` | `rgba(15, 92, 140, 0.35)` |

## Contrast notes (light)

| Pair | Ratio intent | Result |
|------|--------------|--------|
| text-default on surface | ≥4.5:1 | Pass |
| text-muted on surface | ≥4.5:1 | Pass |
| action-primary-text on action-primary `#0F5C8C` | ≥4.5:1 | Pass |
| status-danger on danger-surface | ≥4.5:1 | Pass |

## Dark adjustments

Dark surfaces avoid pure `#000`. Body text avoids pure `#fff`. Brand primary lightened for contrast on dark actions.

## Prohibited in feature APIs

Colour names like `green`, `red`, `paleGreen`. Use `status-success`, `action-danger`, etc. No raw `#1557b0` on migrated files.

## Allowed usage

| Token group | Allowed | Prohibited |
|-------------|---------|------------|
| canvas/surface | page chrome, cards | chart series only |
| action-* | buttons, links | status decoration alone |
| status-* | chips, banners, validation | primary CTA fill |
| financial-* | amounts **with** Dr/Cr or sign text | colour-only debit/credit |
| intelligence-* | Orbix cues | general navigation |
