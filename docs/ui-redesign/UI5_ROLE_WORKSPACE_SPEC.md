# UI-5 — Role Workspace Spec

**Authority:** `src/features/home/roleWorkspace.ts`  
**Permissions:** `getDefaultPermissionsForRole` / `permissionsStore` via `resolvePermissionProfile`

## Workspace resolution

`resolveWorkspaces(roleRaw)` returns `{ primary, all, label }`.

| Role hint (normalized) | Primary workspace | Label |
|------------------------|-------------------|-------|
| owner / manager / business | `owner` | Business overview |
| account* | `accountant` | Accounting workspace |
| cashier / clerk | `cashier` | Cashier workspace |
| bank* | `banking` | Banking workspace |
| inventory / stock | `inventory` | Inventory workspace |
| audit* | `auditor` | Audit workspace |
| admin* | `administrator` | Administration workspace |
| viewer / unknown | `restricted` | Limited workspace |

`resolveWorkspaceIds` maps shell-normalized roles the same way (single id). Default unknown → `restricted`.

## Combined roles

When the raw role string matches **more than one** hint (e.g. `"accountant+cashier"`):

- `primary` = `combined`
- `all` = unique matched workspace ids
- `label` = `Combined workspace`

Metrics/actions use the combined shortlist and priority tables.

## Permission filtering

```text
stored UserPermission (permissionsStore)
  ?? getDefaultPermissionsForRole(role, userId)
```

- `canViewScreen` / `canCreateScreen` gate metrics, attention rows with `permission`, and quick actions.
- Admins (`admin` / `owner` / `super_admin` in adapter) bypass screen gates for view/create checks.
- Adapter additionally blocks cashier from `net_result`, `inventory_value`, and `sales_period` even if a misconfigured profile would allow them.

## Metric defaults (`WORKSPACE_METRICS`)

| Workspace | Metrics (order, max 7) |
|-----------|------------------------|
| owner | cash_and_bank, receivables, payables, sales_period, **net_result**, inventory_value |
| accountant | cash_and_bank, receivables, payables, trial_balance_health, sales_period, **net_result** |
| cashier | todays_sales, cash_and_bank, receivables — **no net_result / inventory** |
| banking | cash_and_bank, receivables, payables |
| inventory | inventory_value, items_count, parties_count |
| auditor | cash_and_bank, receivables, payables, net_result, trial_balance_health |
| administrator | parties_count, items_count, trial_balance_health |
| restricted | parties_count, items_count |
| combined | cash_and_bank, receivables, payables, sales_period, net_result, todays_sales, inventory_value |

## Quick actions & auditor

- Selection: `selectQuickActions(workspaces, profile, isAdmin)`.
- Adapter strips `requireCreate` actions when primary workspace is `auditor` (read-oriented Home).
- `ask_orbix` is eligible for all workspaces (navigate to Orbix; no posting).

## Cashier policy (summary)

- Hides **Net result** and inventory valuation / period sales metrics.
- Prefers operational metrics: today’s sales, cash & bank, receivables.
- Quick actions favour sale / receipt / payment when create permission exists.
