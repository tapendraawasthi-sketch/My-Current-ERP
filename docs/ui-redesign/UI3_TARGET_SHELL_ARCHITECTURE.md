# UI-3 Target Shell Architecture

**Phase:** UI-3.2

## Selected authority

**Production chrome:** `AppShell` (via `Layout`). Proven by `App.tsx` authenticated branch.

## Runtime hierarchy

```text
main.tsx
  ThemeProvider (data-theme)
  + design-system foundations CSS
  → App
      authStage gate (unchanged)
      authenticated →
        F12Provider
        → Layout (sync loops / backup — unchanged authority)
          → AppShell (Himalayan Precision chrome)
              skip link
              TopCommandBar
              shell banners (DataLoadWarningBanner)
              PrimarySideNav | mobile Drawer
              optional mobile bottom nav (≤5)
              PageContentFrame → feature page (unchanged internals)
              CommandPalette
              NotificationCentre portal
              Toast root (existing App Toaster)
              AI overlays (Falcon/NIOS/EKhata/SutraAi — internal; Orbix user-facing)
```

## Provider placement

| Concern | Placement |
|---------|-----------|
| Theme | Root ThemeProvider |
| Density | `data-density` on document via shell preference |
| Auth / company / FY / page | Existing Zustand |
| Permissions | `loadPermissions` on AppShell mount |
| Sync loops | Layout (unchanged) |
| Portal / overlays | document.body via Radix/DS |

## Layout diagrams

**Desktop:** sticky top bar (~56–64px) + sidebar 240–264 / collapsed 68–76 + main scroll.  
**Tablet:** Drawer nav + sticky top bar.  
**Mobile:** compact top bar + Drawer + optional bottom nav (Home / Orbix / Create / Notifications / More).

## Migration sequence

1. Document + harness  
2. Nav IA + role filter  
3. Restyle AppShell / TopCommandBar / SideNav with `--ds-*`  
4. Wire notifications + palette + sync presentation adapter  
5. PageContentFrame + a11y  
6. Route smoke + cutover (same AppShell path — no dual production shells)

## Rollback

Revert shell files under `src/components/shell/*` and remove DS CSS import from `main.tsx`. Routes/providers unchanged.

## Legacy deprecation

Do not remount Sidebar/Header/TopMenuBar. Delete only when consumers proven zero (later phase).
