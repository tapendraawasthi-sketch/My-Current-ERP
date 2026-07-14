# ORBIX UI Phase 0 — Baseline and Governance Report

**Date:** 2026-07-13  
**Phase:** UI-0 — Complete UI baseline audit, visual evidence, design-system governance, safe migration preparation

---

## 1. Executive verdict

Phase UI-0 established a measured UI architecture baseline, baseline-aware governance, migration trackers, and harness-authenticated visual/a11y captures for critical ERP screens. No production visual redesign and no accounting-domain behavior changes were performed.

**Auth screens (login, company selector) remain capture-blocked** outside the auto-authenticated UI QA harness; all other required critical screens were captured.

**Research report note:** `ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt` was **not present** in the repository or common user folders. Execution followed the Phase UI-0 brief in the task prompt, plus `docs/PREMIUM_UI_REDESIGN_SPEC.md` and `AGENTS.md`.

---

## 2. Environment readiness

| Item | Status |
|------|--------|
| Frontend start | `npm run dev` → `http://127.0.0.1:3000` |
| UI QA harness | `http://127.0.0.1:3000/e2e/ui-qa.html` |
| E2E account | `user-e2e-accountant` / harness bootstrap |
| E2E company | `orbix-e2e-company` |
| Visual tests safe | **Yes** (IndexedDB E2E seed; `assertSafeCompany`) |
| Production URL risk | Playwright defaults avoid production; connected suites gated |
| `npm run build` | **Blocked on this Windows host** (`python3` missing for pre-step) |
| Direct `vite build` | **Passes** |

**Verdict:** **environment ready** for harness-based visual capture; **partially ready** for full `npm run build` (Python toolchain); auth-stage screens **blocked** without a dedicated auth fixture.

Artifact: `docs/ui-audit/UI_ENV_READINESS.json`

---

## 3. UI file count

**427** files under `src/` matching `*.tsx` / `*.jsx` / `*.css`

## 4. UI line count

**191,789** lines (same set)

## 5. Route count

**160** total (156 authenticated page IDs + 4 auth stages)

## 6. Page count

**215** files in `src/pages/`; **102** unique page components wired in `App.tsx`

## 7. Shells found

Layout, AppShell, BusyShell, NiosShell, TallyVoucherShell, ReportShell×2, ColumnReportShell, auth screens, unused Sidebar

## 8. Active shell authority

**Layout → AppShell** (evidenced primary authenticated chrome)

## 9. Legacy shells

BusyShell primitives, TallyVoucherShell + `tally-green.css`, duplicate ReportShells, unused Sidebar, legacy menu bars

## 10. Styling systems found

Tailwind v4, `design-tokens.css` (`--ox-*`), global `styles.css`, legacy `tally-green.css`, inline styles, arbitrary Tailwind values

## 11. Raw colour count

**7,200** hex literals

## 12. Distinct colour count

**202**

## 13. Most common colours

| Colour | Count |
|--------|------:|
| `#1557b0` | 2879 |
| `#000000` | 762 |
| `#f5f6fa` | 617 |
| `#0f4a96` | 276 |
| `#9dc07a` | 270 |
| `#ebf5e2` | 165 |

## 14. `!important` count

**324**

## 15. Inline-style file count

**127** TSX/JSX files

## 16. Arbitrary-value count

| Kind | Count |
|------|------:|
| Arbitrary colours | 5048 |
| Arbitrary font sizes | 8134 |
| Arbitrary spacing | 316 |

## 17. Font-size distribution

| Size | Count |
|------|------:|
| &lt;12px | 4183 |
| 9px | 82 |
| 10px | 2009 |
| 11px | 2072 |
| 12px | 3130 |
| 13px | 271 |
| 14px | 237 |

## 18. Controls below 36 px

**1,735** `h-*` / `h-[px]` occurrences below 36px

## 19. Touch targets below 44 px

**1,824** occurrences below 44px

## 20. Icon count

**187** distinct Lucide icons imported; **1,961** JSX usages

## 21. Icon-only accessibility issues

**68** heuristic baseline issues (governance baselined, not fixed)

## 22. Shared-component implementations

`src/components/ui/` barrel + 33 UI files; 40 primitives scanned

## 23. Component duplication

**10** primitives with multiple implementations (see duplication map)

## 24. Navigation destination count

**64** routes with nav entry; full `SHELL_NAV` in `navConfig.ts`

## 25. Duplicate destinations

receipt, payment, contra, day-book, ratio-analysis, vat-reports, fiscal-year (multi-entry); banking missing recon/import entries

## 26. Role-navigation findings

Feature-oriented single tree; no role filtering; 92 orphan routes; banking nav gap for recon/import — see `UI_ROLE_ROUTE_MATRIX.json`

## 27. Responsive findings

Matrix captured; overflow classifications written to `artifacts/ui-baseline/current/responsive-findings.json`. Dense tables/forms expected desktop-limited below ~1024px.

## 28. Dark-mode findings

Shell token path partial–good; feature pages with raw hex/inline styles weak/broken; Tally green incompatible — see `UI_DARK_MODE_BASELINE.md`

## 29. Accessibility findings

Axe on 7 screens: **10** violation groups (**3** critical, **7** serious), primarily colour-contrast and related. Keyboard smoke: palette OK; login blocked.

## 30. Visual screenshots captured

**58** captured / **52** PNG files under `artifacts/ui-baseline/current/`

## 31. Screens blocked

| Screen | Blocker |
|--------|---------|
| login | Harness auto-authenticates; no isolated auth fixture |
| company-selector | Pre-auth gateway outside harness |

## 32. Governance rules added

A–H baseline-aware rules via `scripts/ui-governance-check.mjs` + `tools/ui-governance/baselines/`

## 33. Baseline-aware lint strategy

Existing debt recorded in SHA1 baselines; **new** violations fail. Commands: `ui:governance`, `ui:governance:baseline`

## 34. Migration tracker created

`docs/ui-redesign/UI_MIGRATION_TRACKER.md` + `.json` + `UI_DEPENDENCY_MAP.md` — **nothing marked migrated**

## 35. Files created

- `scripts/ui-audit.mjs`, `ui-route-inventory.mjs`, `ui-style-metrics.mjs`, `ui-icon-inventory.mjs`, `ui-component-inventory.mjs`, `ui-governance-check.mjs`
- `e2e/ui-baseline.spec.ts`, `e2e/ui-a11y-baseline.spec.ts`
- `docs/ui-audit/*`, `docs/ui-redesign/*`
- `tools/ui-governance/baselines/*`
- `artifacts/ui-baseline/current/*`, `artifacts/ui-0/*`

## 36. Files changed

- `package.json` — scripts + `@axe-core/playwright` / `axe-core` devDependencies
- `src/e2e/uiQaHarness.tsx` — extended page router for critical-screen capture (**non-visual production redesign**; harness-only)

## 37. Tests run

| Suite | Result |
|-------|--------|
| `ui:audit` | pass |
| `ui:governance` | pass |
| Playwright `ui-baseline` + `ui-a11y` | 3/3 pass |
| `npx tsc --noEmit` | red (pre-existing), delta 0 |
| `npx vite build` | pass |
| `npm run build` | fail (python3 missing on host) |
| `vitest` orbix | 99/99 pass |
| `vitest` accounting | 17 pass / 3 fail (pre-existing `localStorage` in Node) |

## 38. Tests passed

Governance, UI audit, 3 Playwright UI-0 tests, Orbix 99, Vite build (direct), TS difference gate

## 39. Tests failed

Accounting periodLock ×3 (`localStorage is not defined`) — **pre-existing**, not introduced by UI-0  
`npm run build` wrapper — environment Python missing

## 40. Tests skipped

Connected Orbix E2E / mutation suites (not required; safety)

## 41. Environment-blocked tests

Login + company-selector visual capture; full `npm run build` preflight on this Windows host

## 42. TypeScript baseline before

**151** `error TS` diagnostics (`artifacts/ui-0/tsc-before.txt`)

## 43. TypeScript baseline after

**151** (`artifacts/ui-0/tsc-after.txt`)

## 44. New UI-0 diagnostics

**0**

```
PHASE UI-0 TYPESCRIPT DIFFERENCE GATE PASSED
FULL-PROJECT TYPESCRIPT BASELINE REMAINS RED DUE TO PRE-EXISTING DEBT
```

## 45. Vite build result

**PASS** (`npx vite build`, ~16s). Wrapper `npm run build` blocked by missing `python3`.

## 46. Functional regression result

No accounting/posting/sync code modified. Orbix contract tests green. Accounting periodLock failures pre-exist (environment). Harness extension is QA-only.

## 47. Known risks

1. Named research report file missing from disk — blueprint taken from task + existing premium/AGENTS docs  
2. Auth visual baselines incomplete  
3. Large legacy style debt remains (intentional)  
4. AGENTS.md still documents 10–11px labels vs redesign ≥12px goal — conflict deferred to Phase 1  
5. UI QA harness page set ≠ full App.tsx surface  
6. Governance scanners are heuristic (not full AST) for some rules  

## 48. Recommended UI Phase 1

Design foundations and core primitives only:

1. Resolve token/`styles.css` conflicts; freeze AGENTS vs redesign typography decision  
2. Ship Button, IconButton, Input, Select, Dialog, Drawer, Popover, StatusChip, DataTable, PageHeader, Loading/Empty/Error from `@/components/ui`  
3. Keep AppShell; do not redesign dashboard/Orbix yet  
4. Add isolated auth visual fixture for login/company selector  
5. Keep governance baselines updating only when intentional debt is retired  

**Do not begin Phase 1 in this task.**

## 49. Exact final verdict

Harness-authenticated visual baseline for ERP shells/pages is complete with **2 auth screens honestly blocked**. All inventory, metrics, governance, migration tracking, TS difference, Vite build, and Orbix functional gates passed.

Because two **required critical screens** (login, company selector) could not be captured in a safe isolated auth path on this environment:

### PHASE UI-0 ENVIRONMENT-BLOCKED — AUTHENTICATED VISUAL BASELINE INCOMPLETE

Ready to start UI Phase 1 **foundations/primitives work**, but **complete the auth visual fixture** before claiming a full authenticated visual baseline.
