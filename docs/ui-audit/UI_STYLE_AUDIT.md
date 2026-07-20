# UI Style Audit

Generated: 2026-07-20T11:09:17.231Z

## Styling systems found

| System | Path | Classification |
|--------|------|----------------|
| Tailwind v4 (CSS-first) | `@import "tailwindcss"` in styles.css + `@tailwindcss/vite` | **Active modern** |
| Design tokens | `src/styles/design-tokens.css` (`--ox-*`) | **Active modern** |
| Global ERP styles | `src/styles.css` | **Active** (tokens + legacy overrides) |
| Legacy Tally green | `src/styles/tally-green.css` | **Legacy / partial** — consumers: src/pages/TallyVoucherPage.tsx |
| Inline React styles | 100 TSX/JSX files | **Active debt** |
| Arbitrary Tailwind colours | 828 occurrences | **Active debt** |
| Page-local style objects | see inline list | **Active debt** |

## Quantitative metrics

| Metric | Count |
|--------|------:|
| CSS files under src/ | 8 |
| TSX/JSX files | 504 |
| Raw hex literals (total) | 2138 |
| Distinct hex colours | 237 |
| rgb/rgba literals | 117 |
| hsl/hsla literals | 0 |
| `!important` declarations | 242 |
| Files with inline styles | 100 |
| Arbitrary Tailwind colour values | 828 |
| Arbitrary font sizes | 7756 |
| Arbitrary spacing values | 340 |
| Unique border-radius tokens/values | 24 |
| Unique box-shadow tokens/values | 14 |
| Unique z-index values | 16 |
| Legacy green pattern hits | 15 |
| Black border / pure black hits | 207 |

## Most common hex colours

| Colour | Occurrences |
|--------|------------:|
| `#374151` | 191 |
| `#1557b0` | 188 |
| `#000000` | 162 |
| `#1f2937` | 116 |
| `#f5f6fa` | 98 |
| `#059669` | 97 |
| `#dc2626` | 82 |
| `#e5e7eb` | 76 |
| `#ffffff` | 73 |
| `#fff` | 73 |
| `#d1d5db` | 67 |
| `#c7d2fe` | 50 |
| `#eef2ff` | 46 |
| `#f9fafb` | 43 |
| `#d97706` | 35 |
| `#666` | 27 |
| `#6b7280` | 26 |
| `#9ca3af` | 23 |
| `#f8fafc` | 22 |
| `#111827` | 17 |
| `#1e2433` | 17 |
| `#888` | 15 |
| `#cbd5e1` | 14 |
| `#555` | 14 |
| `#64748b` | 13 |
| `#e0e0e0` | 13 |
| `#e2e8f0` | 12 |
| `#94a3b8` | 12 |
| `#2d3748` | 12 |
| `#f1f5f9` | 11 |

## Modern vs legacy token conflict

- **Modern tokens**: `--ox-*` in `design-tokens.css` (primary `#1557b0`, sidebar dark, light/dark `[data-theme]`).
- **AGENTS.md tokens**: documented as CSS vars in `styles.css` / Tailwind arbitrary values matching brand colours.
- **Legacy**: `tally-green.css` pale-green accounting aesthetic; black borders; dense 9–11px type.
- **Global override risk**: `styles.css` still contains large global selectors and `!important` that can override token-based components on feature pages.
- **Dark mode blockers**: raw hex / light-only backgrounds in inline styles and arbitrary Tailwind classes that ignore `[data-theme]`.
- **Dummy-accounting appearance drivers**: small typography (`<12px` = 2624), pale greens, black borders, dense tables, BusyShell flat controls.
- **Cannot safely delete yet**: `styles.css` global rules, `tally-green.css` (still imported), BusyShell primitives used by forms, legacy page-local style objects — consumers must be migrated first.

## Typography snapshot

See `UI_TYPOGRAPHY_DENSITY_METRICS.json`.

| Size | Occurrences (`text-[Npx]`) |
|------|----------------------------:|
| <12px | 2624 |
| 9px | 55 |
| 10px | 1210 |
| 11px | 1349 |
| 12px | 4222 |
| 13px | 410 |
| 14px | 238 |

## Control density

| Pattern | Count |
|---------|------:|
| h-* / h-[px] below 32px | 264 |
| below 36px | 1633 |
| below 44px (touch) | 1735 |

## Do not delete

Legacy styling is inventoried only. No CSS files were removed in Phase UI-0.
