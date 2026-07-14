# UI Auth Visual Fixture

**Phase:** UI-1.2  
**Entry:** `/e2e/ui-auth.html` → `src/e2e/uiAuthHarness.tsx`

## Purpose

Capture Login (`CompanyLoginScreen`) and Company Selector (`GatewayScreen`) without the UI-QA harness auto-authentication path.

## Production isolation

| Guard | Behavior |
|-------|----------|
| Path | Only under `/e2e/ui-auth.html` (separate Vite MPA entry) |
| Runtime | `assertAuthFixtureAllowed()` — allowed in `import.meta.env.DEV` **or** when `VITE_ALLOW_AUTH_FIXTURE=true` |
| Production deploy | Without the Vite env flag, harness renders `ui-auth-fixture-blocked` |
| Playwright | Sets `VITE_ALLOW_AUTH_FIXTURE=true` in `playwright.config.ts` webServer env (needed for CI preview builds) |
| Main app | `/` does not mount this harness |

## What it does

1. Seeds **in-memory** Zustand `companySettings` with E2E-tagged id `orbix-e2e-auth-fixture-company`
2. Forces `isAuthenticated: false`
3. Sets `authStage` to `gateway` or `company-login`
4. Renders the **real** production components

## What it does not do

- Call successful `login()` in baseline captures
- Open Dexie accounting seed / voucher posting
- Use production credentials
- Bypass auth in normal `App.tsx` runtime
- Mutate accounting stores beyond fixture company metadata in Zustand

## API (`window.__authFixture`)

```ts
setScreen("gateway" | "login")
setCompanyMode("one" | "empty")
setTheme("light" | "dark")
getState() // { screen, authStage, isAuthenticated, companyId }
```

## Tests

```bash
npx playwright test e2e/ui-auth-baseline.spec.ts
```

## Multi-company note

`GatewayScreen` currently shows a single `companySettings` card. Multi-company capture is documented as **not applicable** until the production component supports multiple companies.
