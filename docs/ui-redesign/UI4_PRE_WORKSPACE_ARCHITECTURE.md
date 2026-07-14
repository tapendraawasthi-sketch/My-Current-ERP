# UI-4 Pre-Workspace Architecture

**Phase:** UI-4  
**Authority:** `src/components/auth/PreWorkspaceShell.tsx`  
**Gate owner:** `src/App.tsx` → `renderAuthStage()` driven by `useStore().authStage`

## Purpose

Pre-workspace is the presentation layer for every screen shown **before** an authenticated company workspace is open. It provides a single, design-system-aligned shell for sign-in, company selection, onboarding, session restore, init failure, and access-state messaging — without introducing authenticated navigation, sidebar chrome, or sync authority.

## Runtime flow

```text
main.tsx
  ThemeProvider (data-theme)
  + design-system foundations CSS
  → App
      initializeApp() on mount
      authStage gate:
        checking     → SessionRestoringScreen
        error        → InitErrorScreen (PreWorkspaceShell)
        no-company   → SignUpWizard (PreWorkspaceShell, wide)
        gateway      → GatewayScreen (PreWorkspaceShell)
        company-login→ CompanyLoginScreen (PreWorkspaceShell)
        authenticated→ Layout → AppShell → feature pages (unchanged)
```

Session restore bypasses pre-workspace screens: when `initializeApp()` finds valid `sessionStorage` keys `sutra_user_id` and `sutra_company_id` with an active user and company row, `authStage` is set directly to `authenticated`.

## PreWorkspaceShell structure

| Region | Responsibility |
|--------|----------------|
| Skip link | `#pre-workspace-main` — visible on keyboard focus |
| Header (`role="banner"`) | Orbix mark, product name, env marker, theme toggle, Help anchor |
| Brand panel (`aside`, optional) | Product identity copy; hidden on `lg` breakpoint when `showBrandPanel={false}` |
| Main (`#pre-workspace-main`) | Centred content card; `tabIndex={-1}` for skip-target focus |
| Footer (`#pre-workspace-support`) | Compliance note; overridable via `footerNote` |

### Props

| Prop | Default | Use |
|------|---------|-----|
| `title` | — | Screen title rendered as `sr-only` `<h1>` inside main |
| `showBrandPanel` | `true` | Left identity panel on large viewports |
| `footerNote` | Standard compliance line | Gateway uses a shorter variant |
| `contentWidth` | `"default"` | `"default"` → `max-w-md`; `"wide"` → `max-w-3xl` (onboarding) |

### Environment marker

`environmentLabel()` derives display from Vite env:

| Condition | Label | Badge shown |
|-----------|-------|-------------|
| `import.meta.env.DEV` | Development | Yes (`nonprod`) |
| `MODE === "test"` | Test | Yes |
| `MODE === "training"` | Training | Yes |
| Otherwise | Production | No badge |

Non-production badges use warning-toned DS tokens. Gateway subtitle may append environment name when non-production.

### Shared exports

- **`OrbixMark`** — inline SVG product mark (`aria-hidden`).
- **`CompanyMonogram`** — first-letter avatar for company rows (`aria-hidden`); used on Gateway and Login.

### Design-system contract

- Root: `ds-root` with `--ds-canvas`, `--ds-text-*`, `--ds-surface-*` tokens.
- `data-component="pre-workspace-shell"` and `data-testid="pre-workspace-shell"` for harness targeting.
- Header actions use `ds-focus-ring`; print suppressed on header via `ds-no-print`.

## Screens using PreWorkspaceShell

| Screen | File | `showBrandPanel` | `contentWidth` | Store interaction |
|--------|------|------------------|----------------|-------------------|
| Gateway | `GatewayScreen.tsx` | `true` | default | `selectCompanyForLogin`, `setAuthStage` |
| Company login | `CompanyLoginScreen.tsx` | `true` | default | `login`, `backToGateway` |
| Onboarding | `SignUpWizard.tsx` | `false` | `wide` | `createCompanyAndAdmin` |
| Session restore | `AuthAccessSurfaces.tsx` → `SessionRestoringScreen` | `false` | default | none (display only) |
| Access states | `AuthAccessSurfaces.tsx` → `AuthAccessSurface` | `false` | default | caller supplies actions |
| Init failure | `InitErrorScreen.tsx` | `false` | default | `retryInitializeApp`, `clearDatabaseAndRetryInit` |

## Auth authority (unchanged)

UI-4 replaces presentation only. These concerns remain in `src/store/index.ts`:

| Concern | Mechanism |
|---------|-----------|
| Login | `login(username, password)` → `verifyPassword`, Dexie `users` |
| Session | `sessionStorage` `sutra_user_id` / `sutra_company_id` |
| Lockout | Store `loginFailedAttempts` (≥5 blocks in store) **and** UI localStorage `loginAttempts_{companyId}` with 30s countdown on login screen |
| Company open | `selectCompanyForLogin` → `authStage: "company-login"` |
| Onboarding commit | `createCompanyAndAdmin` only |
| Logout | Clears session keys; `authStage: "gateway"` |

Pre-workspace components must not bypass store methods or write session keys directly.

## Sync and backup on auth surfaces

Pre-workspace does **not** claim authoritative sync status. `TrustSyncHint` and `CompanyOpeningPanel` (in `AuthAccessSurfaces.tsx`) use honest stub copy until the authenticated shell's sync adapter reports state. See `UI4_TRUST_STATE_PRESENTATION_SPEC.md`.

## E2E fixture (dev / gated)

`/e2e/ui-auth.html` boots `src/e2e/uiAuthHarness.tsx`. Allowed when `import.meta.env.DEV` or `VITE_ALLOW_AUTH_FIXTURE=true`. Fixture mutates store presentation state only — it does not call `login()` or open Dexie posting paths (`bootstrapUiAuthHarness.ts`).

## Out of scope (Phase UI-4)

- Feature page migration (accounting, reports, masters).
- Multi-company Dexie selection beyond current single-company gateway model.
- `AuthAccessSurface` wiring for all runtime logout/expiry paths (component exists; not all reasons are routed from store yet).
- Deep research report `ORBIX_UI_DEEP_RESEARCH_AND_PREMIUM_REDESIGN_REPORT.txt` — still absent.

## Related documents

- `UI4_AUTH_AND_TRUST_CONTENT_POLICY.md` — approved user-facing language
- `UI4_ONBOARDING_ARCHITECTURE.md` — wizard and draft resume
- `UI4_TRUST_STATE_PRESENTATION_SPEC.md` — sync/opening presentation
- `UI4_AUTH_ACCESSIBILITY_AND_KEYBOARD_SPEC.md` — a11y contract
- `UI4_LEGACY_AUTH_CUTOVER_MAP.md` — legacy file disposition
