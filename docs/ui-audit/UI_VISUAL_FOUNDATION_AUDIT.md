# UI Visual Foundation Audit

Generated from repository metrics (Phase UI-0.6).

Source artifacts:

- `UI_STYLE_METRICS.json`
- `UI_TYPOGRAPHY_DENSITY_METRICS.json`
- `UI_ICON_REGISTRY.json`

## Typography (measured)

| Pattern | Count |
|---------|------:|
| `text-[Npx]` below 12px | 4183 |
| 9px | 82 |
| 10px | 2009 |
| 11px | 2072 |
| 12px | 3130 |
| 13px | 271 |
| 14px | 237 |
| `uppercase` class hits | 2125 |
| `font-mono` / tabular hits | 885 |
| `tabular-nums` | 32 |

Interpretation: the product still leans on **sub-12px essential UI text**, conflicting with the Phase UI redesign goal of ≥12px for essential text. AGENTS.md currently documents 10–11px labels — this is recorded as legacy density debt, not changed in UI-0.

## Spacing & controls (measured)

| Pattern | Count |
|---------|------:|
| `h-*` / `h-[px]` below 32px | 335 |
| below 36px | 1735 |
| below 44px (touch) | 1824 |

Dense toolbars and `h-8` (32px) controls dominate; touch targets under 44px are systemic.

## Colour (measured)

| Metric | Value |
|--------|------:|
| Raw hex total | 7200 |
| Distinct hex | 202 |
| Most common | `#1557b0` (2879), `#000000` (762), `#f5f6fa` (617) |
| Legacy green hits | see style metrics |
| Pure black / black border hits | see style metrics |
| Arbitrary Tailwind colours | 5048 |

Semantic token usage (`--ox-*`) exists in shell paths but is routinely overridden by arbitrary hex utilities and inline styles on feature pages.

## Icons (measured)

| Metric | Value |
|--------|------:|
| Distinct Lucide icons imported | 187 |
| JSX usages | 1961 |

See `UI_ICON_REGISTRY.json` for per-icon files, purposes, and duplicate-purpose groups.

Icon-only accessibility: governance baseline recorded **68** heuristic icon-button name issues (`tools/ui-governance/baselines/icon-button-a11y.json`).

## Design implication for Phase 1

Phase 1 must establish tokens + typography + primitive components **before** page redesigns, or feature pages will continue to reintroduce raw hex and sub-12px text.
