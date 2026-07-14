# UI-4 Trust State Presentation Spec

**Phase:** UI-4  
**Authority for real sync state:** Authenticated shell / `Layout` sync loops and `SyncStatusControl` (UI-3 adapter) — **not** pre-workspace components  
**Implementation:** `src/components/auth/AuthAccessSurfaces.tsx`

## Principle

Pre-workspace surfaces may **describe** continuity, opening progress, and deferred sync status. They must not assert that backup or synchronization is complete until the post-authentication sync authority confirms it.

## Components

### TrustSyncHint

**Location:** `GatewayScreen` (below company list).  
**Props:** `lastSyncedAt?: string | null`, `pending?: boolean` — both optional.

| Input state | Presentation | Copy |
|-------------|--------------|------|
| Default (no props) | `Banner` tone neutral | Synchronization status is shown after company open from the authoritative sync source. |
| `pending: true` | `Alert` tone warning | Pending local work may exist. Status is confirmed only from the sync authority after open. |
| `lastSyncedAt` set, not pending | `Alert` tone info | Last reported sync: {lastSyncedAt} |
| Props provided but no timestamp | `Alert` tone info | No authoritative sync timestamp is available yet. |

**Current production wiring:** Gateway renders `<TrustSyncHint />` with no props → always shows the neutral default stub. This is intentional: auth path does not read sync aggregate.

### CompanyOpeningPanel

**Location:** Gateway when `opening === true` after **Open company**.  
**Props:** `companyName`, `stage`.

| Stage key | User-visible label |
|-----------|-------------------|
| `verifying` | Verifying access |
| `loading-settings` | Loading company settings |
| `restoring-local` | Restoring local data |
| `checking-sync` | Checking synchronization |
| `opening` | Opening workspace |

**Current production wiring:** Gateway passes `stage="verifying"` only. Stage does not advance automatically in UI-4; `selectCompanyForLogin` transitions `authStage` to `company-login` synchronously. Panel is a short-lived honesty marker, not a full progress engine.

**Sub-note (always shown):**  
Local workspace opening is not labelled as fully synchronized until sync authority confirms it.

`role="status"` + `aria-live="polite"`.

### SessionRestoringScreen

**Trigger:** `authStage === "checking"` during `initializeApp()` / retry init.  
**Copy:** Restoring session — Checking company access and local continuity…  
**Behaviour:** Spinner + polite live region; no sync percentage or success claim.

### AuthAccessSurface

Parameterized full-screen access state using `AuthAccessReason` and approved `COPY` table (see `UI4_AUTH_AND_TRUST_CONTENT_POLICY.md`). Uses `RecoveryPanel` with static line:

> Local records are retained according to existing architecture. No client-side bypass is offered.

**Wiring status:** Component exported and copy-complete. Not all store transitions route through `AuthAccessSurface` yet — reserved for session expiry, device denial, permission change, etc.

## Sync / backup boundaries

| Surface | May show | Must not show |
|---------|----------|---------------|
| Gateway `TrustSyncHint` | Deferred-status stub; optional future timestamp | "All changes synced", green success without source |
| `CompanyOpeningPanel` | Opening stage label + honesty sub-note | Completed sync badge |
| Login screen | Offline warning (local DB availability) | Backup schedule or cloud sync completion |
| Onboarding | Draft saved on device | Cloud backup of draft |
| Authenticated shell | Authoritative sync via UI-3 `SyncStatusControl` | (UI-4 does not change shell authority) |

## Data sources (by phase)

| Concern | Pre-workspace (UI-4) | Post-open (existing) |
|---------|----------------------|----------------------|
| Sync timestamp | Not read; stub only | `syncStatusAggregate` / shell adapter |
| Pending outbound work | Not quantified | Shell sync presentation |
| Backup status | Not shown on auth | `BackupRestore` page / Layout hooks |
| Session validity | `initializeApp` + sessionStorage | Store `isAuthenticated` |

## Future wiring guidance

When connecting real sync hints to Gateway:

1. Read only from the same aggregate the shell uses after authentication — do not duplicate sync logic in auth components.
2. Pass `lastSyncedAt` / `pending` into `TrustSyncHint`; keep default stub when aggregate unavailable.
3. Advance `CompanyOpeningPanel` stages only if store exposes discrete open milestones; otherwise keep single-stage honesty panel.
4. Map store logout/expiry reasons to `AuthAccessReason` and render `AuthAccessSurface` instead of ad hoc screens.

## Test hooks

| `data-testid` | Component |
|---------------|-----------|
| `session-restoring` | SessionRestoringScreen |
| `company-opening-panel` | CompanyOpeningPanel |
| `auth-access-{reason}` | AuthAccessSurface |

## Related documents

- `UI4_AUTH_AND_TRUST_CONTENT_POLICY.md` — exact strings
- `UI4_PRE_WORKSPACE_ARCHITECTURE.md` — auth stage flow
- `UI3_SYNC_STATE_PRESENTATION_SPEC.md` — post-authentication sync authority
