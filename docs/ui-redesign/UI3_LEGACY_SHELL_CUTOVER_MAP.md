# UI-3 Legacy Shell Cutover Map

| Path | Consumers | Replacement | Disposition |
|------|-----------|-------------|-------------|
| Layout.tsx | App authenticated | Retain thin wrapper | Active |
| shell/AppShell.tsx | Layout, QA harness | **Migrated UI-3** | Active authority |
| shell/* chrome | AppShell | DS-tokenised | Active |
| Sidebar.tsx | none | — | Deprecated unused |
| Header.tsx | none | — | Deprecated unused |
| BusyMenuBar / TopMenuBar | residual | — | Deprecated unused |
| BusyShell | forms | Form primitives | Retain (not chrome) |
| NotificationPanel.tsx | none | NotificationCentre | Deprecated unused |
| SyncStatusIndicator | TopMenuBar only | SyncStatusControl | Legacy |

**Cutover:** Same AppShell path — production already used AppShell; UI-3 evolved it in place. No dual production shells.
