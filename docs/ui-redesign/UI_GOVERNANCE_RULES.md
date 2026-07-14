# UI Governance Rules

Phase UI-0.11 — baseline-aware safeguards. Extended in Phase UI-2.16.

## Commands

```bash
npm run ui:audit
npm run ui:governance:baseline   # regenerate baselines (intentional only)
npm run ui:governance            # fail on NEW debt only
npm run ui:baseline
npm run ui:a11y
npm run ui:ds-lab
npm run ui:phase2
```

## Rules

| ID | Rule | Baseline file | Behavior |
|----|------|---------------|----------|
| A | No new raw hex in feature TSX/JSX | `raw-hex.json` | Token files + chart paths exempt |
| B | No new `!important` outside approved CSS | `important.json` | `styles.css`, tokens, tally-green allowed |
| C | No new essential text below 12px (`text-[9\|10\|11px]`) | `min-font.json` | Existing debt baselined |
| D | No new static visual `style={{...}}` with colour/font/spacing | `inline-style.json` | Dynamic measured values still need review |
| E | Icon-only buttons need accessible names | `icon-button-a11y.json` | Heuristic scanner |
| F | Approved UI import path | `approved-ui-import-path.json` | Prefer `@/components/ui` during coexistence; new foundations via `@/design-system` |
| G | No new `@ts-nocheck` in UI TS | `ts-nocheck.json` | Existing baselined |
| H | No new `tally-green.css` consumers | `legacy-green.json` | One existing consumer baselined |
| I | No new arbitrary numeric z-index (`z-[NNN]`, literal `zIndex`) | `arbitrary-z-index.json` | Use `--ds-z-*`; UI-2 |
| J | Dialog accessible title (lab + review) | documented | Automated axe + lab tests |
| K | Toast not sole serious-error channel in lab patterns | documented | Spec + lab review |

## Strategy

Enforcement is **baseline-aware**: the repository may remain red with legacy debt, but **new** violations fail CI/local checks. Do not regenerate baselines blindly.

## Phase UI-2 permitted new files

All under `src/design-system/primitives/{Dialog,Drawer,Popover,Menu,Feedback,Page,Filters,DataTable}/` plus lab harness `src/e2e/designSystemLabUi2.tsx` and `e2e/ui2-lab.spec.ts`.

## Architecture import direction

- New interaction foundations: `import { … } from "@/design-system"`
- Legacy production pages: continue `@/components/ui` until controlled migration
- Do not introduce a second component framework (MUI/Ant/Chakra/AG Grid Enterprise)
