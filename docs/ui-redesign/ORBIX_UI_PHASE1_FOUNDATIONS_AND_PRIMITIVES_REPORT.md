# ORBIX UI Phase 1 — Foundations and Primitives Report

**Date:** 2026-07-13  
**Design direction:** Himalayan Precision  
**Public API:** `import { … } from "@/design-system"`

---

## 1. Executive verdict

Phase UI-1 completed the missing auth visual baselines, introduced a single design-system foundation (`src/design-system`) with semantic tokens / typography / density / focus / dark / print, shipped core primitives, a component lab, and zero net new legacy visual debt. No accounting-domain behavior was changed by this phase.

## 2. Design authority files found

AGENTS.md, PREMIUM_UI_REDESIGN_SPEC.md, Phase UI-0 report + inventories, UI migration/dependency/governance docs, design-tokens.css, auth components.

## 3. Missing authority files

`ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt` — **absent**. Recorded in `UI_DESIGN_AUTHORITY_MANIFEST.md`. No invented quotations.

## 4. Phase UI-0 auth baseline completion

**PHASE UI-0 AUTHENTICATION VISUAL BASELINE COMPLETED** — see `ORBIX_UI_PHASE0_AUTH_BASELINE_ADDENDUM.md`.

## 5. Auth fixture architecture

MPA entry `/e2e/ui-auth.html` → `uiAuthHarness.tsx` + `bootstrapUiAuthHarness.ts`. Renders real GatewayScreen / CompanyLoginScreen with in-memory E2E company metadata. No auto-login.

## 6. Production isolation proof

- Allowed only in `import.meta.env.DEV` or `VITE_ALLOW_AUTH_FIXTURE=true`
- Playwright sets the flag for CI preview builds
- Without flag: `ui-auth-fixture-blocked`
- Main `/` does not mount fixture (tested)

## 7. Login captures

12 PNGs: 1440/390 × light/dark × default/validation-error/password-visible

## 8. Company Selector captures

8 PNGs: 1440/390 × light/dark × one-company/empty  
Multi-company: skipped (component limitation)

## 9. Foundation directory

`src/design-system/foundations/` — tokens, typography, focus, print, types, index.css

## 10. Public design-system API

`src/design-system/index.ts` (+ tsconfig/vite aliases)

## 11. Colour tokens

Semantic `--ds-*` groups (canvas, text, border, action, status, intelligence, financial). Spec: `UI_COLOUR_TOKEN_SPEC.md`

## 12. Contrast validation

Warning chip text darkened to `#7A4E0A` (was `#A7660B`, 4.22:1 → AA). Lab axe serious/critical = **0**.

## 13. Dark-mode tokens

Full dark semantic set in tokens.css. Claim: **NEW DESIGN-SYSTEM FOUNDATIONS AND PRIMITIVES SUPPORT DARK MODE** (not full-app).

## 14. Typography tokens

`ds-text-*` + financial classes. Essential ≥12px in DS path.

## 15. Nepali typography

Lab EN/नेपाली toggle; fallback stack includes Noto Sans Devanagari. No new font binaries; no new CDN in DS.

## 16. Financial-number behavior

Tabular/lining nums, right align, Dr/Cr text + colour, em dash N/A.

## 17. Spacing system

4px grid tokens `--ds-space-*` + semantic layout tokens.

## 18. Density modes

`data-density=comfortable|productive|compact` via `applyDensity()`. Default productive. Mobile hit-target floor 44px.

## 19–22. Radius / elevation / motion / z-index

Documented in `UI_ELEVATION_MOTION_ZINDEX_SPEC.md` and tokens.css.

## 23–24. Focus / reduced-motion

`.ds-focus-ring`, `.ds-transition`, prefers-reduced-motion in foundations + Spinner/Skeleton.

## 25. Print foundation

`print.css` — light print, no-print/print-only, page breaks, repeatable thead utility.

## 26–27. Icon governance / custom icons

Policy + Lucide coexistence. Custom: Orbix, NPR, DualDate, Ledger, Reconciliation, SyncConflict.

## 28–42. Primitives

Button, IconButton (aria-label required), Input, Textarea, Label/FormField/FieldDescription/FieldError, Checkbox, Radio/RadioGroup, Switch, Select foundation (Radix), Tooltip, Divider, Badge, StatusChip, Spinner, Skeleton, VisuallyHidden, Surface, Stack, Inline, Container — all under `src/design-system/primitives/`.

## 43. Compatibility strategy

Coexistence; no global migration; no legacy deletions. Map: `UI_PRIMITIVE_COMPATIBILITY_MAP.md`

## 44. Legacy components changed

None delegated. Only harness/vite/playwright/tsconfig/package scripts + governance script updates.

## 45. Legacy components unchanged

`src/components/ui/*`, BusyShell, AppShell pages — unchanged API.

## 46. Component laboratory

`/e2e/ds-lab.html` — see `UI_COMPONENT_LAB.md`

## 47. Screenshots captured

Auth: 20 PNG files (12 login + 8 company-selector)  
Lab: 10 PNGs under `artifacts/ui-redesign/phase-ui-1/`

## 48–52. Light / dark / density / mobile / Nepali

Lab matrices covered; auth captured light+dark mobile/desktop.

## 53. Accessibility result

Lab axe: **0 serious/critical**. App-wide a11y backlog unchanged.

## 54. Governance changes

Approved DS foundation CSS for hex/`!important`; e2e harness excluded from some heuristics; token files listed. Baselines **not** regenerated to hide debt — net new debt **0**.

## 55–59. Net new debt

| Metric | Net new |
|--------|--------:|
| Raw colours in features | 0 |
| !important | 0 |
| Sub-12px essential text | 0 |
| Static inline styles | 0 |
| Legacy-green imports | 0 |

## 60. Files created

`src/design-system/**`, `e2e/ui-auth.html`, `e2e/ds-lab.html`, harnesses, specs, docs under `docs/ui-redesign/` + `docs/ui-testing/`, artifacts.

## 61. Files changed

`vite.config.ts`, `playwright.config.ts`, `package.json`, `tsconfig.json`, `scripts/ui-governance-check.mjs`

## 62. Files deleted

`src/design-system/icons/index.ts` (replaced by `.tsx`)

## 63. Accounting-domain files changed

**None by UI-1.** Pre-existing dirty `orbixPostingService.ts` / erp_bot files were not edited in this phase.

## 64–68. Tests

| Suite | Result |
|-------|--------|
| ui:governance | PASS |
| ui-auth-baseline (5) | PASS |
| ui-ds-lab (3) | PASS |
| vitest orbix | 99/99 PASS |
| npx vite build | PASS |
| npm run build | env-blocked (python3) — not app failure |

## 69–71. TypeScript

Before UI-1: **151**  
After: **151** (delta **0**)  
Design-system diagnostics: **0**

```
PHASE UI-1 TYPESCRIPT DIFFERENCE GATE PASSED
FULL-PROJECT TYPESCRIPT BASELINE REMAINS RED DUE TO PRE-EXISTING DEBT
```

## 72. Vite build

PASS (`npx vite build`)

## 73. Orbix regression

99/99 passed

## 74. Route/shell smoke

Auth fixture isolation + main app without fixture marker; AppShell path unchanged.

## 75. Known limitations

- Deep research report still missing
- Multi-company gateway UI not in production component
- Fonts: system fallbacks; legacy Google Fonts CDN remains in `styles.css` only
- Design-system not yet wired into production pages (intentional)
- AGENTS.md dense 10–11px rules still apply to unmigrated pages

## 76. Deferred (UI Phase 2)

Dialog, Drawer, Popover composites, Toast, Banner, Empty/Loading patterns, PageHeader, DataTable, shell migration

## 77. Recommended UI Phase 2

Interaction primitives, feedback patterns, page header, enterprise DataTable foundation — consuming `@/design-system` tokens/primitives without broad page redesign.

## 78. Exact final verdict

### PHASE UI-1 FINAL GATE PASSED — READY FOR UI PHASE 2 INTERACTION PRIMITIVES, FEEDBACK PATTERNS, PAGE HEADER, AND ENTERPRISE DATA TABLE FOUNDATION

UI Phase 2 was not started in this task.
