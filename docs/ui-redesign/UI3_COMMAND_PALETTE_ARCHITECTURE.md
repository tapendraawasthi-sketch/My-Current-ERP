# UI-3 Command Palette Architecture

**Open:** Ctrl/Cmd+K, Ctrl/Cmd+/, `/` when not typing; top-bar trigger.

**Sources:** role-filtered `SHELL_NAV` pages + action shortcuts + `useGlobalSearch` (parties/accounts/items/pages).

**Categories:** Orbix, Actions, Pages, Reports, Parties, Accounts, Items (when search hits).

**Safety:** Actions only `setCurrentPage` / open Orbix — never post or mutate accounting from the palette.

**Identity:** User-facing assistant entry is **Ask Orbix** only.
