# UI-3 Target Information Architecture

**Phase:** UI-3.4–3.5

## Primary modules (≤11)

1. Home  
2. Orbix  
3. Sales  
4. Purchases  
5. Banking (+ reconciliation & statement import)  
6. Inventory  
7. Accounting  
8. Reports  
9. Compliance  
10. Administration  

## Duplicates resolved

| Concept | Canonical | Removed from |
|---------|-----------|--------------|
| Receipt / Payment / Contra | Banking | Transactions mega-group |
| Day Book | Accounting | Banking + Reports duplicates |
| VAT | Compliance | Reports duplicate |
| Ratio Analysis | Reports | Analytics duplicate |
| Fiscal Year | Accounting | Settings duplicate |
| Analytics group | Merged into Reports | Standalone Analytics |

## Role defaults

Role filtering uses `shellNavVisibility.filterNavForRole` mapped from `currentUser.role`. Admin/owner/manager see full tree. Visibility does **not** grant permission; soft deep-link gate for `users` / `backup-restore` / config pages.

## Aliases

All App.tsx page IDs remain valid deep links. Orphan routes stay reachable via palette/search/default switch.
