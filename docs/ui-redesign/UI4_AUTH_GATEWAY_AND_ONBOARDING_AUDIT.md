# UI-4 Auth, Gateway and Onboarding Audit

**Phase:** UI-4.1  
**Generated:** 2026-07-13  
**Deep research report:** still **absent**

## Before-state

| Check | Result |
|-------|--------|
| TypeScript | **151** |
| Governance | PASS |
| Auth fixture | `/e2e/ui-auth.html` DEV / `VITE_ALLOW_AUTH_FIXTURE` gated |

## Runtime flow

```text
App mount → initializeApp()
  checking → spinner
  error → InitErrorScreen
  no-company → SignUpWizard → createCompanyAndAdmin → gateway
  gateway → GatewayScreen → selectCompanyForLogin → company-login
  company-login → CompanyLoginScreen → login() → authenticated → Layout → AppShell
  session restore (sutra_user_id + sutra_company_id) → authenticated
  logout → clear session → gateway
```

## Authority owners

| Concern | Owner | Path |
|---------|-------|------|
| Login success | `useStore.login` | `src/store/index.ts` |
| Password verify | `verifyPassword` / hash | `store.types.ts` |
| Company context | Dexie `companySettings` + store | store |
| Session | `sessionStorage` `sutra_user_id` / `sutra_company_id` | store login/logout/init |
| Lockout | UI localStorage attempts + store `loginFailedAttempts` | dual (preserve both) |
| Onboarding commit | `createCompanyAndAdmin` | store |
| Onboarding progress | React state only (UI-4 adds local resume) | SignUpWizard |
| Sync/backup on auth | **absent** — shell only | UI-4 trust presentation |
| Fixture gate | `isFixtureAllowed` | `bootstrapUiAuthHarness.ts` |

## Live files to migrate

| File | `@ts-nocheck` |
|------|---------------|
| GatewayScreen.tsx | YES → remove |
| CompanyLoginScreen.tsx | YES → remove |
| SignUpWizard.tsx | YES → remove |
| Step1CompanyProfile.tsx | YES → remove |
| Step2TaxRegistration.tsx | YES → remove |
| Step3/4 | no |
| InitErrorScreen.tsx | no |

## Orphans (do not migrate as primary)

SignInForm, AuthBrandingPanel, ChangePasswordModal, AuthGateway page, Layout fallback login.
