# UI-4 Onboarding Architecture

**Phase:** UI-4  
**Entry:** `authStage === "no-company"` → `SignUpWizard`  
**Commit authority:** `useStore().createCompanyAndAdmin` only  
**Resume key:** `localStorage` → `orbix_onboarding_draft_v1`

## Purpose

First-time company setup collects Nepal-specific company identity, tax registration, accounting foundations, and the initial administrator account. UI-4 migrates the wizard to design-system primitives inside `PreWorkspaceShell` with device-local draft resume. No alternate API or direct Dexie writes from step components.

## When onboarding appears

`initializeApp()` counts `db.companySettings`. The current bootstrap path seeds a placeholder row when count is zero, then returns `action: "no-company"`. In practice the wizard is also reachable from Gateway via **Create company** / **Create new company** (`setAuthStage("no-company")`).

Successful `createCompanyAndAdmin` sets `authStage: "gateway"` with persisted company settings — user proceeds to company open and sign-in.

## Wizard structure

```text
SignUpWizard (PreWorkspaceShell, contentWidth="wide", showBrandPanel=false)
  StepProgress (4 steps)
  Step1CompanyProfile
  Step2TaxRegistration
  Step3AccountingSetup
  Step4AdminAccount
  Navigation: Back | Save and continue | Review complete — activate company
```

| Step | Component | Name in progress UI | Primary fields |
|------|-----------|---------------------|----------------|
| 1 | `Step1CompanyProfile.tsx` | Company identity | `companyNameEn`, `companyNameNe`, `businessType`, address, city, district, province, phone, email, website |
| 2 | `Step2TaxRegistration.tsx` | Fiscal & tax | `panNumber`, `hasVAT`, `vatNumber`, `irdProvince`, `irdOfficeName`, `fiscalYear` |
| 3 | `Step3AccountingSetup.tsx` | Accounting | `dateFormat`, `enableStock`, `enableCostCenter`, `enableBillWise` |
| 4 | `Step4AdminAccount.tsx` | Admin & security | `fullName`, `username`, `password`, `confirmPassword` |

Shared types: `src/components/auth/wizard/wizardTypes.ts` (`WizardForm`, `WizardStepProps`).

## Draft resume

### Storage format

```json
{
  "step": 1,
  "form": { "...WizardForm fields..." },
  "savedAt": "ISO-8601"
}
```

Key: `orbix_onboarding_draft_v1`.

### Security rules

- **Passwords are never persisted.** On save and load, `password` and `confirmPassword` are forced to `""`.
- Draft is device-local only; not encrypted beyond browser storage semantics.
- Successful activation calls `localStorage.removeItem(RESUME_KEY)`.

### Resume behaviour

- On mount, `loadDraft()` restores step (clamped 1–4) and merged form.
- `resumed` flag shows dismissible info alert: "Continuing from a saved draft on this device."
- `useEffect` writes draft on every `currentStep` / `formData` change.

## Validation (client-side)

Validation runs in `validateStep(step)` before advance or finish. Errors map to field ids for `ErrorSummary` and per-field `FieldError` in step components.

| Step | Rules |
|------|-------|
| 1 | English company name, business type, address, city, phone, email (format) required |
| 2 | PAN exactly 9 digits; IRD province; fiscal year required |
| 3 | Date format required |
| 4 | Full name; username alphanumeric ≥4; password ≥6 with letter+digit; confirm match |

Step components clear field errors on change when the step had errors.

## Commit path (`createCompanyAndAdmin`)

Only `handleFinish` invokes the store. Payload mapping:

**Company** (representative fields):

- `name` / `companyNameEn` / `companyNameNe`, `panNumber`, `address`, `phone`, `email`, `vatNumber`
- `defaultDateFormat` from `dateFormat` (`"BS"` \| `"AD"`)
- `enableCostCenter`, `enableBillWiseTracking` from wizard toggles
- Defaults: `defaultCurrency: "NPR"`, `currencySymbol: "Rs."`, `fiscalYearStartMonth: 4`, `stockValuationMethod: "weighted_average"`, `enableMultiCurrency: false`, `enableBatchTracking: false`

**Admin user:**

- `name`, `username`, `password`, `role: "admin"`, `isActive: true`

Store behaviour (unchanged):

1. Opens Dexie; on `UpgradeError` may delete and `resetDB()` for first-time recovery.
2. `db.companySettings.put({ id: "main", ...company })`
3. `hashPassword` → `db.users.put` with `passwordHash`
4. Updates `companySettings` in Zustand; `authStage: "gateway"`

Step components and wizard state do **not** write to Dexie directly.

## UI primitives

- `StepProgress`, `Button`, `ErrorSummary`, `Alert`, `Input`, `Label`, `FieldError`, `Select`, `Checkbox`, `Switch` from `@/design-system`
- `data-testid="signup-wizard"`; finish button `data-testid="wizard-activate"`

## Post-onboarding flow

```text
createCompanyAndAdmin success
  → authStage: gateway
  → GatewayScreen
  → Open company
  → company-login
  → login()
  → authenticated → Layout / AppShell
```

Administrator credentials exist only after step 4 commit; there is no sign-in before activation completes.

## Not in scope

- Invited-user onboarding or multi-tenant provisioning
- Server-side draft sync
- VAT/PAN live validation against government APIs
- Replacing `createCompanyAndAdmin` with a separate registration service

## Related documents

- `UI4_PRE_WORKSPACE_ARCHITECTURE.md` — shell and auth stage gate
- `UI4_AUTH_AND_TRUST_CONTENT_POLICY.md` — wizard copy
- `UI4_LEGACY_AUTH_CUTOVER_MAP.md` — deprecated auth entry points
