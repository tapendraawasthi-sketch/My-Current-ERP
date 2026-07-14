# UI Shell Authority Audit

Generated: 2026-07-13 (Phase UI-0.3)

## Executive finding

**Active authenticated shell authority is `Layout` → `AppShell`.** Evidence: `src/App.tsx` mounts authenticated content inside `<Layout>`, and `Layout` renders `<AppShell>` when `isDbReady && isAuthenticated`. UI QA harness mounts `AppShell` directly (same chrome).

Final shell consolidation is **not** declared complete in this phase — AppShell is the **evidenced primary** candidate to retain, with legacy shells to consolidate or deprecate after migration.

## Runtime layout flow

```text
Application entry (src/main.tsx)
  → ThemeProvider
  → App (src/App.tsx)
      → authentication gateway (authStage)
          checking → inline spinner
          error → InitErrorScreen
          no-company → SignUpWizard
          gateway → GatewayScreen
          company-login → CompanyLoginScreen
          authenticated →
              F12Provider
                → Layout (src/components/Layout.tsx)
                    → sync loop / auto-backup schedulers
                    → AppShell (src/components/shell/AppShell.tsx)
                        providers: FalconProvider, NiosProvider, EKhataProvider,
                                   SutraAiProvider (mobile)
                        chrome: TopCommandBar, PrimarySideNav, CommandPalette
                        → route page (Zustand currentPage switch)
                            → page template / feature components
                            → shared UI (src/components/ui/*)
                            → style sources: styles.css → design-tokens.css + Tailwind
```

UI QA path:

```text
/e2e/ui-qa.html → uiQaHarness.tsx → bootstrapUiQaHarness (E2E auth+seed)
  → AppShell → QaPageRouter (subset of pages)
```

## Shell inventory

| Shell | Filename | Component | Entry | Routes | Classification | Disposition |
|-------|----------|-----------|-------|--------|----------------|-------------|
| Layout | `src/components/Layout.tsx` | `Layout` | App authenticated | All authenticated pages | **Active** | **retain** (thin auth/sync wrapper) |
| AppShell | `src/components/shell/AppShell.tsx` | `AppShell` | Layout + UI QA | All authenticated + QA | **Active primary** | **retain / evolve** |
| BusyShell | `src/components/BusyShell.tsx` | primitives (`BusyInput`, `FlatBtn`, `FormPanel`, …) | Page imports | Form pages (settings, invoices, etc.) | **Active legacy primitives** | **migrate → deprecate** |
| NiosShell | `src/components/nios/NiosShell.tsx` | `NiosShell` | via `NiosProvider` in AppShell | Overlay panel | **Active experimental/overlay** | **retain as overlay** (not app chrome) |
| TallyVoucherShell | `src/components/tally/TallyVoucherShell.tsx` | default | Tally voucher pages | Optional Tally UI | **Legacy / partial** | **deprecate after migration** |
| ReportShell (reports) | `src/components/reports/ReportShell.tsx` | ReportShell | Report pages | Reports | **Active partial** | **consolidate** |
| ReportShell (reporting) | `src/components/reporting/ReportShell.tsx` | ReportShell | Reporting | Reports | **Duplicate** | **merge** |
| ColumnReportShell | `src/components/reporting/ColumnReportShell.tsx` | ColumnReportShell | Column reports | Reports | **Active partial** | **consolidate** |
| Auth shells | `GatewayScreen`, `CompanyLoginScreen`, `SignUpWizard` | various | App authStage | Pre-auth only | **Active** | **retain / redesign later (P3)** |
| Legacy Sidebar | `src/components/Sidebar.tsx` | Sidebar | **No imports found** | — | **Unused** | **remove after confirmation** |
| BusyMenuBar / TopMenuBar | `BusyMenuBar.tsx`, `topbar/TopMenuBar.tsx` | legacy menus | Residual | — | **Legacy** | **deprecate** |

## AppShell details

| Aspect | Evidence |
|--------|----------|
| Providers | Falcon, NIOS, EKhata, SutraAi (mobile) |
| Navigation | `PrimarySideNav` ← `navConfig.ts` `SHELL_NAV` |
| Header | `TopCommandBar` |
| Responsive | Collapses sidenav `<1280`; mobile drawer via `useIsMobile` |
| Dark mode | `data-theme` + `--ox-*` tokens |
| Visual tokens | `design-tokens.css` via `styles.css` |
| Legacy CSS | Does not import `tally-green.css` |
| A11y | Command palette dialog; nav toggle labels present in visual QA |

## Visible multi-era UX (user-detectable)

Users can still see phase seams:

1. **AppShell modern chrome** (dark sidebar, `--ox-*`) vs **BusyShell/Tally green form interiors**.
2. **Report shells duplicated** (`reports/` vs `reporting/`).
3. **Multiple assistant identities** (Falcon / NIOS / EKhata/Orbix / SutraAi) mounted from AppShell.
4. **Dense 9–11px AGENTS/legacy page styling** coexisting with tokenized shell.
5. **Auth screens** outside AppShell with different visual language.

## Recommendation (evidence-based, not final mandate)

- **Retain** AppShell + Layout as the single authenticated chrome path.
- **Do not** replace production shell blindly in UI-0.
- **Consolidate** report shells and BusyShell primitives into `@/components/ui` in later phases.
- **Deprecate** Tally green shell after consumer migration.
- **Remove** unused `Sidebar.tsx` only after import-graph confirmation in a later cleanup phase.
