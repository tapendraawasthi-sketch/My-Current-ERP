# UI-3 Shell and Global State Audit

**Phase:** UI-3.1  
**Generated:** 2026-07-13  
**Deep research report:** still **absent**

## Before-state

| Check | Result |
|-------|--------|
| Full-project TypeScript | **151** `error TS` |
| `ui:governance` | PASS (net new debt 0) |
| Production shell | `Layout` → `AppShell` (proven) |
| Deep research file | Absent |

## Authority owners (proven)

| Concern | Owner | Path |
|---------|-------|------|
| Production shell | `Layout` → `AppShell` | `src/components/Layout.tsx` → `src/components/shell/AppShell.tsx` |
| Route definitions | Zustand `currentPage` + `App.renderPage()` switch | `src/store/index.ts`, `src/App.tsx` |
| Permission decisions | `permissionsStore` + `lib/permissions.ts` + `usePermissions` (nav **was not filtered**) | `src/store/permissionsStore.ts` |
| Sync status truth | Dual: `syncEngine` outbox + platform `syncQueue`; UI via `getAggregatedSyncStatus` | `src/lib/syncEngine.ts`, `src/platform/sync/syncStatusAggregate.ts` |
| Notification data | Zustand `notifications` + Dexie `db.notifications` | `settingsSlice` / `store/index.ts` |
| Company context | Zustand `companySettings` | store |
| Fiscal context | Zustand `currentFiscalYear` / `fiscalYears` | store |
| Theme | `ThemeContext` (`data-theme`) | `src/context/ThemeContext.tsx` |

## Shell inventory

| Shell | Classification | UI-3 disposition |
|-------|----------------|------------------|
| Layout | Active thin wrapper | Retain |
| AppShell | **Active primary** | **Migrate / converge** |
| BusyShell | Form primitives only | Retain (not chrome) |
| NiosShell / Falcon / EKhata / SutraAi | Overlays | Retain internally; one user-facing **Orbix** identity |
| ReportShells / TallyVoucherShell | Page-level | Out of scope |
| Sidebar / TopMenuBar / Header / BusyMenuBar | Unused chrome | Deprecate (do not remount) |

## Gaps addressed in UI-3

1. Nav not role-filtered; duplicates in SHELL_NAV  
2. Banking missing recon / statement import  
3. Notification bell unwired  
4. Density not production-wired  
5. Competing assistant names in overlays (internal retain; shell exposes Orbix)  
6. Design-system tokens not loaded in production CSS path  
7. `loadPermissions` not called at shell mount  

## Competing authority — forbidden

Do **not** create a second route system, permission engine, sync truth source, or notification DB.
