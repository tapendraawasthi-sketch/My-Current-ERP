# UI-4 Legacy Auth Cutover Map

**Phase:** UI-4  
**Production gate:** `src/App.tsx` → `renderAuthStage()`  
**Rule:** Pre-workspace production path uses UI-4 components only. Legacy files remain in repo for reference or indirect use until explicitly removed.

## Production routing (after UI-4)

| `authStage` | Production component | File |
|-------------|---------------------|------|
| `checking` | `SessionRestoringScreen` | `auth/AuthAccessSurfaces.tsx` |
| `error` | `InitErrorScreen` | `components/InitErrorScreen.tsx` (migrated to PreWorkspaceShell) |
| `no-company` | `SignUpWizard` | `auth/SignUpWizard.tsx` |
| `gateway` | `GatewayScreen` | `auth/GatewayScreen.tsx` |
| `company-login` | `CompanyLoginScreen` | `auth/CompanyLoginScreen.tsx` |
| `authenticated` | `Layout` → `AppShell` | unchanged |

`App.tsx` imports: `SignUpWizard`, `InitErrorScreen`, `GatewayScreen`, `CompanyLoginScreen`, `SessionRestoringScreen`. It does **not** import `AuthGateway`, `SignInForm`, or `AuthBrandingPanel`.

## Migrated files (UI-4 primary)

| File | Change summary | `@ts-nocheck` |
|------|----------------|---------------|
| `PreWorkspaceShell.tsx` | **New** shared layout | never |
| `GatewayScreen.tsx` | DS primitives, TrustSyncHint, CompanyOpeningPanel | **removed** |
| `CompanyLoginScreen.tsx` | DS form, lockout UI, offline honesty | **removed** |
| `SignUpWizard.tsx` | DS wizard, draft resume | **removed** |
| `Step1CompanyProfile.tsx` | DS fields | **removed** |
| `Step2TaxRegistration.tsx` | DS fields | **removed** |
| `Step3AccountingSetup.tsx` | DS toggles | unchanged |
| `Step4AdminAccount.tsx` | DS admin fields | unchanged |
| `AuthAccessSurfaces.tsx` | **New** trust/access presentation | never |
| `InitErrorScreen.tsx` | Wrapped in PreWorkspaceShell + DS buttons | unchanged |

## Legacy / orphan files (do not use as primary)

| File | Former role | UI-4 status |
|------|-------------|-------------|
| `SignInForm.tsx` | Inline login form with branding column | **Orphan** — superseded by `CompanyLoginScreen`; still calls `store.login` but not routed from `App.tsx` |
| `AuthBrandingPanel.tsx` | Marketing column for old sign-in | **Orphan** — replaced by `PreWorkspaceShell` brand panel |
| `pages/AuthGateway.tsx` | Wrapper: `SignInForm` if not authenticated | **Orphan** — replaced by `authStage` gate in `App.tsx` |
| `ChangePasswordModal.tsx` | Post-login password change | **Retained** — not part of pre-workspace cutover; may still be used inside workspace |

## Store API (unchanged)

| API | Used by UI-4 |
|-----|--------------|
| `initializeApp` | App mount |
| `login` | `CompanyLoginScreen` |
| `logout` | Shell (unchanged) |
| `createCompanyAndAdmin` | `SignUpWizard` finish |
| `selectCompanyForLogin` | `GatewayScreen` open |
| `backToGateway` | `CompanyLoginScreen` back / Escape |
| `setAuthStage` | Gateway create-company paths |
| `retryInitializeApp` / `clearDatabaseAndRetryInit` | `InitErrorScreen` |

Session keys unchanged: `sessionStorage` `sutra_user_id`, `sutra_company_id`.

Lockout unchanged dual layer:

- Store: `loginFailedAttempts` (≥5 throws in `login`)
- UI: `localStorage` `loginAttempts_{companyId}` + 30s countdown on login screen

## Visual / behaviour deltas (intentional)

| Area | Legacy | UI-4 |
|------|--------|------|
| Layout shell | Mixed Tailwind / ad hoc cards | `PreWorkspaceShell` + DS tokens |
| Login error | "Invalid username or password" | Neutral "Unable to sign in…" (no enumeration) |
| Gateway | Single form aesthetic | Company row + monogram + open CTA |
| Onboarding progress | React state only | + `orbix_onboarding_draft_v1` resume (no passwords) |
| Init error | Standalone page styling | PreWorkspaceShell + DS recovery |
| Sync on auth | Often absent or implied | Explicit honest stubs (`TrustSyncHint`) |
| TypeScript | `@ts-nocheck` on several auth files | Removed from migrated auth components |

## E2E fixture cutover

| Item | Path | Notes |
|------|------|-------|
| HTML entry | `e2e/ui-auth.html` | DEV or `VITE_ALLOW_AUTH_FIXTURE` |
| Bootstrap | `src/e2e/bootstrapUiAuthHarness.ts` | `isFixtureAllowed()`, no real `login()` |
| Harness | `src/e2e/uiAuthHarness.tsx` | Renders production auth components via store stage mutation |
| Spec | `e2e/ui-auth-baseline.spec.ts` | Visual/a11y baseline |

Fixture sets `authStage` to `gateway` or `company-login` and seeds mock `companySettings` — does not replace production `App.tsx` routing in main app entry.

## Deprecation guidance

1. **Do not** add new imports of `SignInForm`, `AuthBrandingPanel`, or `AuthGateway` in production paths.
2. **Do** use `PreWorkspaceShell` for any new pre-workspace screen.
3. **Do** route access-denied states through `AuthAccessSurface` when store integration is added.
4. Safe deletion candidates (future phase, after grep confirms zero imports): `SignInForm.tsx`, `AuthBrandingPanel.tsx`, `pages/AuthGateway.tsx`.

## Not migrated (explicit)

- All authenticated feature pages (Priority 4–5 in migration tracker)
- `ChangePasswordModal` integration paths
- Multi-company Dexie selector (gateway still lists single `companySettings` row)
- Deep research deliverable `ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt`

## Related documents

- `UI4_PRE_WORKSPACE_ARCHITECTURE.md`
- `UI4_AUTH_GATEWAY_AND_ONBOARDING_AUDIT.md` (UI-4.1 audit snapshot)
- `UI_MIGRATION_TRACKER.md` — Phase UI-4 status
