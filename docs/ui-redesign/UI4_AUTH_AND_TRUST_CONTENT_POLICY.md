# UI-4 Auth and Trust Content Policy

**Phase:** UI-4  
**Scope:** User-facing copy on pre-workspace auth surfaces  
**Principle:** Describe what the system actually does. Do not invent security capabilities, sync guarantees, or account-enumeration hints.

## Policy rules

1. **No username enumeration** — Failed sign-in must not confirm whether a username exists. Use neutral wording.
2. **No false sync claims** — Pre-workspace must not state "all synced", "fully backed up", or similar unless the authoritative sync source has confirmed it post-open.
3. **No unsupported security claims** — Do not promise encryption standards, compliance certifications, or bypass resistance beyond what store/session architecture implements.
4. **Honest offline wording** — Offline affects remote features; local Dexie may still be available. Do not imply cloud-only sign-in.
5. **Administrator escalation** — Password recovery and account lock resolution defer to administrator contact (no self-service reset in UI-4).
6. **Local data retention** — Access revocation and session expiry copy may state local records are retained per existing architecture; never imply automatic cloud deletion or client-side bypass.

## Approved copy — sign-in (`CompanyLoginScreen.tsx`)

### Field validation

| Key | Message |
|-----|---------|
| `username` empty | Username is required |
| `password` empty | Password is required |

### Errors and alerts

| Situation | Approved text |
|-----------|---------------|
| Lockout active (submit) | Sign-in temporarily locked. Wait {N} seconds, then try again. |
| Lockout banner | Too many failed attempts. Try again in **{N}s**. |
| Lockout triggered (5 failures) | Too many failed attempts. Sign-in is locked for 30 seconds. |
| Failed login (&lt; 5 attempts) | Unable to sign in. Check your details and try again. {remaining} attempt(s) remaining. |
| Offline (submit block) | You appear to be offline. Sign-in requires an available local company database on this device. Check your connection and retry. |
| Offline banner | Network appears unavailable. Sign-in uses the local company database on this device when available. |
| Unexpected exception | Sign-in could not be completed. Please try again. If this continues, contact your administrator. |
| Error summary title | Unable to sign in |

### Secondary copy

| Element | Text |
|---------|------|
| Forgot password | Forgot your password? Contact your system administrator. |
| Last sign-in | Last successful sign-in: {formatted date} [by {username}] |
| Back link | Back to companies |
| Submit (idle) | Sign in |
| Submit (loading) | Signing in… |

### Forbidden sign-in phrases

- "Invalid username or password" (reveals which field failed semantics)
- "User not found" / "Unknown username"
- "Account locked permanently"
- "Your data is fully synced"

## Approved copy — gateway (`GatewayScreen.tsx`)

| Element | Text |
|---------|------|
| Title | Choose a company |
| Subtitle | Open an organisation you are authorised to access. |
| Non-prod suffix | Environment: {label}. |
| Search placeholder | Search companies |
| Empty (no company) title | No company available |
| Empty (no company) body | No company is ready on this device. Create a company to continue, or contact an administrator. |
| Empty (no company) action | Create company |
| Empty (search) title | No matching companies |
| Empty (search) body | Try a different search. |
| Open button | Open company |
| Footer override | Orbix ERP · Choose which organisation to open |
| Create link | Create new company |
| Loading | Loading company data… |

## Approved copy — onboarding (`SignUpWizard.tsx`)

| Element | Text |
|---------|------|
| Title | Set up your company |
| Intro | Required steps create company identity, fiscal and tax context, accounting foundations, and the first administrator. Progress is saved on this device until setup finishes. Passwords are never stored in drafts. |
| Resumed alert | Continuing from a saved draft on this device. |
| Error summary (step) | Please fix the following |
| Error summary (submit) title | Setup could not finish |
| Submit fallback | Company setup could not be completed. Check your inputs and try again. |
| Back | Back |
| Next | Save and continue |
| Finish (idle) | Review complete — activate company |
| Finish (loading) | Activating… |
| Step counter | Step {n} of 4 |

### Step validation messages (approved)

**Step 1:** Company name (English) is required; Business type is required; Address is required; City is required; Phone number is required; Email is required; Enter a valid email address.

**Step 2:** PAN number is required; PAN must be exactly 9 digits; IRD Province is required; Fiscal year is required.

**Step 3:** Date format is required.

**Step 4:** Full name is required; Username is required; Username must be alphanumeric, min 4 characters; Password is required; Password must be at least 6 characters; Password must contain both letters and numbers; Please confirm your password; Passwords do not match.

## Approved copy — init failure (`InitErrorScreen.tsx`)

| Element | Text |
|---------|------|
| Title | Unable to start Orbix ERP |
| Subtitle | Local database initialization failed. Posting and reports stay unavailable until recovery succeeds. |
| Alert title | Initialization failed |
| Default body | The application could not initialize its local database. Financial data may be unavailable until this is resolved. |
| Reference line | Reference: {code} |
| Retry (idle) | Retry initialization |
| Retry (loading) | Retrying… |
| Clear data | Clear local data & retry |
| Reload | Reload page |
| Clear confirm dialog | This will delete all local ERP data on this device and recreate an empty database. Continue? |

## Approved copy — brand panel (`PreWorkspaceShell.tsx`)

| Element | Text |
|---------|------|
| Headline | Intelligent accounting and business control, built for Nepal. |
| Bullets | Company-based access with audit trail; Local continuity with authoritative synchronization; Fiscal-period and permission controls |
| Disclaimer | No unsupported security claims. Work remains under your company's access rules. |
| Default footer | Orbix ERP · Activity is logged for compliance · Contact your administrator for access help |

## Approved copy — access surfaces (`AuthAccessSurfaces.tsx`)

`AuthAccessSurface` uses `COPY` keyed by `AuthAccessReason`. Titles and bodies below are authoritative:

| Reason | Title | Body |
|--------|-------|------|
| `session-expired` | Session expired | Your session ended for security. Sign in again to continue. Unsent local work remains on this device according to existing sync rules. |
| `signed-out` | Signed out | You have been signed out of this company workspace. |
| `account-disabled` | Account unavailable | This account cannot sign in. Contact your administrator. |
| `password-change-required` | Password change required | Your administrator requires a new password before you can continue. |
| `device-pending` | Device registration pending | This device is waiting for authorisation. Ask an administrator to approve it. |
| `device-not-authorised` | Device not authorised | This device is not authorised for company access. No client-side bypass is available. |
| `company-access-revoked` | Company access removed | You no longer have access to this company. Local records are not deleted. Return to the company list or contact an administrator. |
| `no-company` | No company assigned | No company is available for your account on this device. |
| `permission-changed` | Permissions updated | Your access changed. Privileged screens were closed. Continue from an allowed area. |
| `fiscal-unavailable` | Fiscal year unavailable | The selected fiscal context is not available. Choose another period or contact an administrator. |
| `setup-incomplete` | Setup incomplete | Required company setup is not finished. Continue setup before posting. |
| `maintenance` | Maintenance | The service is temporarily unavailable for maintenance. Try again later. |
| `backend-unavailable` | Service unavailable | The remote service could not be reached. Local company data may still be available on this device. |
| `offline` | Offline | Network appears unavailable. Sign-in uses the local company database when present. Full remote features remain limited. |
| `local-session-available` | Local session available | A previously authorised local session can continue on this device. Synchronization may be pending. |
| `reauthentication-required` | Sign in again | Reauthentication is required before continuing. |

### RecoveryPanel static line

> Local records are retained according to existing architecture. No client-side bypass is offered.

Default primary action label: **Return to sign in**.

## Approved copy — session restore

| Element | Text |
|---------|------|
| Title | Restoring session |
| Body | Checking company access and local continuity… |

## Approved copy — company opening panel

| Stage label | Verifying access / Loading company settings / Restoring local data / Checking synchronization / Opening workspace |
| Sub-note | Local workspace opening is not labelled as fully synchronized until sync authority confirms it. |

## Approved copy — trust sync hint

| State | Text |
|-------|------|
| Default (no timestamp) | Synchronization status is shown after company open from the authoritative sync source. |
| Pending | Pending local work may exist. Status is confirmed only from the sync authority after open. |
| With timestamp | Last reported sync: {lastSyncedAt} |
| No timestamp after props | No authoritative sync timestamp is available yet. |

## Review checklist for new auth copy

- [ ] Does it avoid confirming username validity on failure?
- [ ] Does it avoid claiming sync/backup completeness pre-open?
- [ ] Does it route account recovery to administrator?
- [ ] Does it distinguish local vs remote availability honestly?
- [ ] Does it avoid marketing security language not backed by implementation?
