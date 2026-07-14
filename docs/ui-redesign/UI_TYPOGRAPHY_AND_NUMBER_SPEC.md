# Typography & Number Spec

## Font strategy

| Role | Stack |
|------|-------|
| Latin UI | Inter, Segoe UI, system-ui |
| Nepali | Noto Sans Devanagari (system/local fallback) |
| Technical IDs | IBM Plex Mono / SF Mono — **not** for general amounts |

**Limitation:** No new binary font assets added. External CDN Inter remains in legacy `styles.css` only; design-system declares robust fallbacks and does not add a new CDN dependency.

## Type tokens

See CSS classes `ds-text-*` and `ds-financial-*` in `typography.css`.

Non-negotiable: no essential text below 12px in design-system primitives.

## Financial numbers

- `font-variant-numeric: tabular-nums lining-nums`
- Right aligned
- Debit/Credit marked with text (`Dr`/`Cr`) plus optional colour
- Em dash `—` for N/A
- Negative format supported via `ds-financial-negative` parentheses
