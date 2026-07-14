# ORBIX UI PHASE 4 — AUTH, GATEWAY, ONBOARDING REPORT

**Phase:** UI-4  
**Date:** 2026-07-13  
**Exact final verdict:** PHASE UI-4 FINAL GATE PASSED — READY FOR UI PHASE 5 HOME, EXECUTIVE DASHBOARD, ROLE WORKSPACES, ATTENTION QUEUES, FINANCIAL OVERVIEW, AND DATA-TRUST REDESIGN

---

## 1. Executive verdict

Production pre-workspace surfaces (Login, Company Gateway, first-run onboarding, session restoring, init error) now use the Himalayan Precision design system via `PreWorkspaceShell`. Authentication authority (`store.login`, password verify, lockout, sessionStorage, company membership, `createCompanyAndAdmin`) is unchanged. Net new visual debt is zero. UI-4 Playwright **9/9**. Orbix Vitest **103**. TypeScript **151 → 151**. Vite build **PASS**.

## 2–3. Authority files / missing

**Read / used:** AGENTS.md, PREMIUM_UI_REDESIGN_SPEC.md, UI-0–UI-3 reports/specs, colour/typography/density/a11y/page/feedback/overlay/UI3 specs, auth fixture docs, `src/design-system`, store auth paths.

**Missing (continued):** `ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt` — absent; not reconstructed; authority chain preserved.

## 4. Before-state diagnostics

| Check | Before |
|-------|--------|
| TypeScript | 151 |
| Governance | PASS |
| Auth fixture | DEV / `VITE_ALLOW_AUTH_FIXTURE` gated |

## 5–12. Paths & trust sources

| Area | Authority |
|------|-----------|
| Login | `useStore.login` → `verifyPassword` / Dexie users |
| Session | `sessionStorage` `sutra_user_id` / `sutra_company_id` |
| Lockout | UI `localStorage` attempts **and** store `loginFailedAttempts` (both preserved) |
| Gateway | Dexie `companySettings` + `selectCompanyForLogin` |
| Onboarding commit | `createCompanyAndAdmin` only |
| Onboarding draft | `localStorage` `orbix_onboarding_draft_v1` (passwords never restored) |
| Environment | `import.meta.env` via `environmentLabel()` |
| Sync / backup on auth | Honest stubs only — no false “all synced”; post-open shell remains authority |

## 13–15. Authoritative states

- **Login:** `CompanyLoginScreen` → `login(username, password)`  
- **Company:** `companySettings` + `selectedCompanyId`  
- **Onboarding:** Wizard UI → `createCompanyAndAdmin`; activation only after step validation  

## 16–19. Architecture & content

- **Pre-shell:** `PreWorkspaceShell` (identity, env marker, theme, help, brand panel, footer, skip link)  
- **Product identity:** Orbix ERP / Intelligent ERP (UI-3 policy)  
- **Trust language:** `UI4_AUTH_AND_TRUST_CONTENT_POLICY.md` — no bank/military-grade claims  
- **Unsupported claims avoided:** encryption guarantees, perfect sync/backup, full offline auth  

## 20–34. Login redesign

DS `Input` / `Button` / `ErrorSummary` / `Alert`; labels above; autocomplete username/current-password; password visibility with accessible name; Enter submits; safe invalid-credential copy; lockout countdown; offline warning; last login from `loginAt`/`loggedInAt`; loading on Sign in.

## 35–50. Gateway & opening

“Choose a company”; monogram; PAN/VAT; last access; Open company; Create company; search when applicable; `TrustSyncHint` (honest); `CompanyOpeningPanel` (no fake %); hand-off via `selectCompanyForLogin` → login → AppShell.

## 51–65. Onboarding

Four production steps (identity, fiscal/tax, accounting, admin). Autosave/resume draft. Required validation blocks continue/activate. Passwords never in draft. Commits only through existing store.

## 66–77. Session / env / sync / backup

`SessionRestoringScreen`; `AuthAccessSurface` copy for expiry/device/revoked/etc.; Production/Test/Training/Development markers; sync/backup truthfulness — no inference on auth screens.

## 78–84. Nepal-first

NPR fixed; BS/AD date format; PAN/VAT; Devanagari company name field; province hierarchy; monogram fallback (no random gradients).

## 85–94. Responsive / a11y

Desktop split brand+form; mobile one column; dark theme toggle; axe on Login+Gateway fixture: **0 serious / 0 critical** (after avoiding legacy `aside { background: #d4eabd !important }` via complementary region).

## 95–101. E2E & gating

| Suite | Result |
|-------|--------|
| `npm run ui:phase4` | **9/9** |
| Production Login / Gateway / logout | Pass (seed via `createCompanyAndAdmin` when wizard) |
| Fixture gating | DEV allowed; production requires flag |
| UI-3 shell | **5/5** (re-run with auth baseline) |
| Auth baseline | Updated for Orbix copy / labels |

Artifacts: `artifacts/ui-redesign/phase-ui-4/` (+ `auth-e2e-results.json`, `manifest.json`, a11y JSON, screenshots).

## 102–112. Visual / legacy cutover

Screenshots captured (light/dark/mobile). Brand panel no longer uses legacy green `aside` rule. `@ts-nocheck` removed from migrated auth/wizard files (governance nocheck 191→186). Raw hex removed from App toast options. Wizard steps migrated off inline hex.

## 113–119. Governance

PASS — net new raw colours / `!important` / sub-12 / inline visual styles / legacy-green = **0**. Unsupported trust claims = **0**.

## 120–125. Files

**Created:** `PreWorkspaceShell`, `AuthAccessSurfaces`, wizard types, UI-4 docs, `e2e/ui4-auth.spec.ts`, phase-ui-4 artifacts.

**Changed:** Gateway, CompanyLogin, SignUpWizard, Step1–4, InitErrorScreen, App (checking + toast tokens), FiscalYear page rename (pre-existing Babel collision unblocking `/`), ui-auth-baseline, package.json `ui:phase4`.

**Deleted:** none required.

**Accounting / sync / auth authority files:** not semantically changed (store login/hash/lockout untouched). FiscalYear rename only avoids `FiscalYear` type/component collision.

## 126–130. Tests

- UI-4: 9 passed  
- Orbix Vitest: 103 passed  
- Governance: PASS  
- Vite: PASS  
- Auth baseline + UI-3: updated and re-run  

## 131–134. TypeScript / build

- Before: **151**  
- After: **151**  
- New UI-4-owned diagnostics: **0**  
- Vite production build: **PASS** (~15.5s)

## 135–137. Regressions

Orbix / permission / security: pass within scoped suites; no client auth bypass; no credential logging; fixture not production-exposed without flag.

## 138–140. Limitations / Phase 5

- Multi-company listing still single `companySettings` record (documented).  
- Device registration UI is presentation-ready; backend device flows unchanged.  
- Nepali: partial content / Devanagari rendering — not claimed complete.  
- **UI Phase 5:** Home / executive dashboard / role workspaces / attention queues / financial overview / data-trust — **do not start in this task.**

## 141. Exact final verdict

**PHASE UI-4 FINAL GATE PASSED — READY FOR UI PHASE 5 HOME, EXECUTIVE DASHBOARD, ROLE WORKSPACES, ATTENTION QUEUES, FINANCIAL OVERVIEW, AND DATA-TRUST REDESIGN**
