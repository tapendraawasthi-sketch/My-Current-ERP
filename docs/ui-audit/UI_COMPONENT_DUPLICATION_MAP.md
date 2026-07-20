# UI Component Duplication Map

Generated: 2026-07-20T11:09:47.550Z

## Policy (Phase UI-0)

- **Approved future import path**: `@/components/ui` (barrel `src/components/ui/index.ts`)
- Do **not** replace components in this phase — inventory only
- Recommendation legend: `canonical candidate` | `merge` | `adapter` | `deprecate` | `remove after migration`

## Summary

| Metric | Value |
|--------|------:|
| Primitives scanned | 40 |
| With multiple implementations | 11 |
| Known ui/ canonical files | 19 |

## By primitive

### Button (5)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/ai/interface/MessageShareButton.tsx` | merge | page-local-or-feature | ~0 |
| `src/components/ekhata/OrbixDocumentCameraButton.tsx` | merge | page-local-or-feature | ~0 |
| `src/components/ui/Button.tsx` | canonical candidate | design-system-candidate | ~10 |
| `src/design-system/primitives/Button/Button.tsx` | merge | page-local-or-feature | ~0 |
| `src/design-system/primitives/IconButton/IconButton.tsx` | merge | page-local-or-feature | ~0 |

### IconButton (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/design-system/primitives/IconButton/IconButton.tsx` | merge | page-local-or-feature | ~0 |

### Input (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/Input.tsx` | canonical candidate | design-system-candidate | ~8 |

### Textarea (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/design-system/primitives/Textarea/Textarea.tsx` | merge | page-local-or-feature | ~0 |

### Select (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/Select.tsx` | canonical candidate | design-system-candidate | ~5 |

### Combobox (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/design-system/composites/Combobox.tsx` | merge | page-local-or-feature | ~0 |

### Checkbox (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/design-system/primitives/Checkbox/Checkbox.tsx` | merge | page-local-or-feature | ~0 |

### Radio (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/design-system/primitives/Radio/Radio.tsx` | merge | page-local-or-feature | ~0 |

### Switch (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/design-system/primitives/Switch/Switch.tsx` | merge | page-local-or-feature | ~0 |

### DatePicker (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/NepaliDatePicker.tsx` | canonical candidate | design-system-candidate | ~10 |

### NepaliDatePicker (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/NepaliDatePicker.tsx` | canonical candidate | design-system-candidate | ~10 |

### AmountInput (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/AmountInput.tsx` | canonical candidate | design-system-candidate | ~1 |

### SearchField (3)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/ai/rag/GlobalSearchHandler.ts` | merge | page-local-or-feature | ~0 |
| `src/components/GlobalSearch.tsx` | merge | page-local-or-feature | ~0 |
| `src/hooks/useGlobalSearch.ts` | merge | page-local-or-feature | ~0 |

### Card (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/Card.tsx` | canonical candidate | design-system-candidate | ~3 |

### Badge (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/Badge.tsx` | canonical candidate | design-system-candidate | ~4 |

### StatusChip (0)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| _none found_ | | | |

### Table (4)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/DataTable.tsx` | canonical candidate | design-system-candidate | ~1 |
| `src/components/ui/SearchableTable.tsx` | canonical candidate | design-system-candidate | ~7 |
| `src/components/ui/Table.tsx` | canonical candidate | design-system-candidate | ~3 |
| `src/design-system/primitives/DataTable/EnterpriseDataTable.tsx` | merge | page-local-or-feature | ~0 |

### DataTable (2)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/DataTable.tsx` | canonical candidate | design-system-candidate | ~1 |
| `src/design-system/primitives/DataTable/EnterpriseDataTable.tsx` | merge | page-local-or-feature | ~0 |

### Pagination (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/Pagination.tsx` | canonical candidate | design-system-candidate | ~3 |

### Modal (3)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/ConfirmDialog.tsx` | canonical candidate | design-system-candidate | ~1 |
| `src/components/ui/LanguageModal.tsx` | canonical candidate | design-system-candidate | ~1 |
| `src/components/ui/Modal.tsx` | canonical candidate | design-system-candidate | ~3 |

### ConfirmDialog (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/ConfirmDialog.tsx` | canonical candidate | design-system-candidate | ~1 |

### Drawer (5)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/design-system/primitives/Drawer/Drawer.tsx` | merge | page-local-or-feature | ~0 |
| `src/domains/report-engine/balanceSheetBuilder.ts` | merge | page-local-or-feature | ~0 |
| `src/lib/balanceSheetEngine.ts` | merge | page-local-or-feature | ~0 |
| `src/lib/balanceSheetTypes.ts` | merge | page-local-or-feature | ~0 |
| `src/pages/BalanceSheet.tsx` | merge | page-local-or-feature | ~0 |

### Popover (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/design-system/primitives/Popover/Popover.tsx` | merge | page-local-or-feature | ~0 |

### Tooltip (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/Tooltip.tsx` | canonical candidate | design-system-candidate | ~1 |

### Toast (0)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| _none found_ | | | |

### Banner (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/DataLoadWarningBanner.tsx` | merge | page-local-or-feature | ~0 |

### EmptyState (2)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ReportEmptyState.tsx` | merge | page-local-or-feature | ~0 |
| `src/components/ui/EmptyState.tsx` | canonical candidate | design-system-candidate | ~1 |

### LoadingState (3)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/PageLoader.tsx` | canonical candidate | design-system-candidate | ~1 |
| `src/components/ui/Spinner.tsx` | canonical candidate | design-system-candidate | ~1 |
| `src/design-system/composites/Skeletons.tsx` | merge | page-local-or-feature | ~0 |

### Skeleton (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/design-system/composites/Skeletons.tsx` | merge | page-local-or-feature | ~0 |

### PageHeader (0)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| _none found_ | | | |

### Toolbar (3)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/pl/PLToolbar.tsx` | merge | page-local-or-feature | ~0 |
| `src/components/reports/ReportToolbar.tsx` | merge | page-local-or-feature | ~0 |
| `src/components/ui/ActionToolbar.tsx` | canonical candidate | design-system-candidate | ~1 |

### Tabs (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/pages/billing/BillingTabs.tsx` | merge | page-local-or-feature | ~0 |

### Breadcrumbs (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/Breadcrumb.tsx` | merge | page-local-or-feature | ~0 |

### FormField (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/design-system/primitives/FormField/FormField.tsx` | merge | page-local-or-feature | ~0 |

### ErrorMessage (0)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| _none found_ | | | |

### ErrorSummary (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/InitErrorScreen.tsx` | merge | page-local-or-feature | ~0 |

### FileUpload (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/ui/AttachmentUploader.tsx` | canonical candidate | design-system-candidate | ~2 |

### DocumentPreview (3)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/invoice/InvoicePrint.tsx` | merge | page-local-or-feature | ~0 |
| `src/components/print/VoucherPrint.tsx` | merge | page-local-or-feature | ~0 |
| `src/components/tally/TallyVoucherPrint.tsx` | deprecate | legacy-tally | ~0 |

### AuditTimeline (5)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/AuditLogs.tsx` | merge | page-local-or-feature | ~0 |
| `src/components/ui/AuditHistoryPanel.tsx` | canonical candidate | design-system-candidate | ~0 |
| `src/pages/AuditLog.tsx` | merge | page-local-or-feature | ~0 |
| `src/pages/AuditLogs.tsx` | merge | page-local-or-feature | ~0 |
| `src/pages/AuditTrailLog.tsx` | merge | page-local-or-feature | ~0 |

### SyncIndicator (1)

| File | Recommendation | Style | Consumers (est.) |
|------|----------------|-------|-----------------:|
| `src/components/shell/SyncStatusControl.tsx` | merge | page-local-or-feature | ~0 |
