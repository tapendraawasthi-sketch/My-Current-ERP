# UI Style Audit

Generated: 2026-07-13T12:34:17.030Z

## Styling systems found

| System | Path | Classification |
|--------|------|----------------|
| Tailwind v4 (CSS-first) | `@import "tailwindcss"` in styles.css + `@tailwindcss/vite` | **Active modern** |
| Design tokens | `src/styles/design-tokens.css` (`--ox-*`) | **Active modern** |
| Global ERP styles | `src/styles.css` | **Active** (tokens + legacy overrides) |
| Legacy Tally green | `src/styles/tally-green.css` | **Legacy / partial** — consumers: src/pages/TallyVoucherPage.tsx |
| Inline React styles | 128 TSX/JSX files | **Active debt** |
| Arbitrary Tailwind colours | 5048 occurrences | **Active debt** |
| Page-local style objects | see inline list | **Active debt** |

## Quantitative metrics

| Metric | Count |
|--------|------:|
| CSS files under src/ | 8 |
| TSX/JSX files | 449 |
| Raw hex literals (total) | 7304 |
| Distinct hex colours | 258 |
| rgb/rgba literals | 105 |
| hsl/hsla literals | 0 |
| `!important` declarations | 332 |
| Files with inline styles | 128 |
| Arbitrary Tailwind colour values | 5048 |
| Arbitrary font sizes | 8189 |
| Arbitrary spacing values | 331 |
| Unique border-radius tokens/values | 24 |
| Unique box-shadow tokens/values | 18 |
| Unique z-index values | 18 |
| Legacy green pattern hits | 22 |
| Black border / pure black hits | 896 |

## Most common hex colours

| Colour | Occurrences |
|--------|------------:|
| `#1557b0` | 2879 |
| `#000000` | 762 |
| `#f5f6fa` | 617 |
| `#0f4a96` | 276 |
| `#9dc07a` | 270 |
| `#ebf5e2` | 165 |
| `#1f2937` | 135 |
| `#059669` | 131 |
| `#dc2626` | 131 |
| `#ffffff` | 112 |
| `#e5e7eb` | 96 |
| `#c7d2fe` | 95 |
| `#eef2ff` | 92 |
| `#000` | 87 |
| `#fff` | 83 |
| `#d1d5db` | 73 |
| `#d97706` | 70 |
| `#f9fafb` | 56 |
| `#d4eabd` | 52 |
| `#374151` | 51 |
| `#6b7280` | 49 |
| `#9ca3af` | 47 |
| `#c9deb5` | 45 |
| `#111827` | 34 |
| `#1e2433` | 31 |
| `#3d6b25` | 31 |
| `#666` | 28 |
| `#2d3748` | 25 |
| `#4a7a30` | 24 |
| `#ccc` | 19 |

## Modern vs legacy token conflict

- **Modern tokens**: `--ox-*` in `design-tokens.css` (primary `#1557b0`, sidebar dark, light/dark `[data-theme]`).
- **AGENTS.md tokens**: documented as CSS vars in `styles.css` / Tailwind arbitrary values matching brand colours.
- **Legacy**: `tally-green.css` pale-green accounting aesthetic; black borders; dense 9–11px type.
- **Global override risk**: `styles.css` still contains large global selectors and `!important` that can override token-based components on feature pages.
- **Dark mode blockers**: raw hex / light-only backgrounds in inline styles and arbitrary Tailwind classes that ignore `[data-theme]`.
- **Dummy-accounting appearance drivers**: small typography (`<12px` = 4183), pale greens, black borders, dense tables, BusyShell flat controls.
- **Cannot safely delete yet**: `styles.css` global rules, `tally-green.css` (still imported), BusyShell primitives used by forms, legacy page-local style objects — consumers must be migrated first.

## Typography snapshot

See `UI_TYPOGRAPHY_DENSITY_METRICS.json`.

| Size | Occurrences (`text-[Npx]`) |
|------|----------------------------:|
| <12px | 4183 |
| 9px | 82 |
| 10px | 2009 |
| 11px | 2072 |
| 12px | 3135 |
| 13px | 300 |
| 14px | 258 |

## Control density

| Pattern | Count |
|---------|------:|
| h-* / h-[px] below 32px | 337 |
| below 36px | 1740 |
| below 44px (touch) | 1832 |

## Do not delete

Legacy styling is inventoried only. No CSS files were removed in Phase UI-0.
