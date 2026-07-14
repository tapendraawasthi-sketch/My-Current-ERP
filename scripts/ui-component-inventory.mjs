/**
 * UI-0.5 — Shared component duplication map (heuristic scan).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const OUT_DIR = path.join(ROOT, "docs/ui-audit");

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", "dist"].includes(ent.name)) continue;
      walk(p, files);
    } else if (/\.(tsx|ts)$/.test(ent.name)) files.push(p);
  }
  return files;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

const TARGETS = [
  { id: "Button", patterns: [/Button\.tsx$/, /export\s+(?:function|const)\s+Button\b/, /FlatBtn/, /BusyBtn/] },
  { id: "IconButton", patterns: [/IconButton/, /icon-only|iconOnly/] },
  { id: "Input", patterns: [/ui\/Input\.tsx$/, /BusyInput/, /export\s+(?:function|const)\s+Input\b/] },
  { id: "Textarea", patterns: [/Textarea\.tsx$/, /export\s+(?:function|const)\s+Textarea\b/] },
  { id: "Select", patterns: [/ui\/Select\.tsx$/, /export\s+(?:function|const)\s+Select\b/] },
  { id: "Combobox", patterns: [/Combobox/, /SearchableSelect|cmdk/] },
  { id: "Checkbox", patterns: [/Checkbox\.tsx$/, /@radix-ui\/react-checkbox/] },
  { id: "Radio", patterns: [/RadioGroup|Radio\.tsx/] },
  { id: "Switch", patterns: [/Switch\.tsx$/, /@radix-ui\/react-switch/] },
  { id: "DatePicker", patterns: [/DatePicker|DayPicker|react-day-picker/] },
  { id: "NepaliDatePicker", patterns: [/NepaliDatePicker/] },
  { id: "AmountInput", patterns: [/AmountInput/] },
  { id: "SearchField", patterns: [/SearchField|GlobalSearch|type="search"/] },
  { id: "Card", patterns: [/ui\/Card\.tsx$/, /export\s+(?:function|const)\s+Card\b/] },
  { id: "Badge", patterns: [/ui\/Badge\.tsx$/, /StatusChip|status-pill/] },
  { id: "StatusChip", patterns: [/StatusChip|status-pill|badge-/] },
  { id: "Table", patterns: [/ui\/Table\.tsx$/, /DataTable|SearchableTable|\.data-table/] },
  { id: "DataTable", patterns: [/DataTable\.tsx$/] },
  { id: "Pagination", patterns: [/Pagination\.tsx$/] },
  { id: "Modal", patterns: [/ui\/Modal\.tsx$/, /ConfirmDialog|LanguageModal/] },
  { id: "ConfirmDialog", patterns: [/ConfirmDialog/] },
  { id: "Drawer", patterns: [/Drawer|vaul|Sheet/] },
  { id: "Popover", patterns: [/Popover|@radix-ui\/react-popover/] },
  { id: "Tooltip", patterns: [/ui\/Tooltip\.tsx$/, /@radix-ui\/react-tooltip/] },
  { id: "Toast", patterns: [/react-hot-toast|sonner|Toaster/] },
  { id: "Banner", patterns: [/Banner|DataLoadWarningBanner/] },
  { id: "EmptyState", patterns: [/EmptyState|ReportEmptyState|empty-state/] },
  { id: "LoadingState", patterns: [/PageLoader|Spinner|Skeleton/] },
  { id: "Skeleton", patterns: [/Skeleton/] },
  { id: "PageHeader", patterns: [/PageHeader|page-header/] },
  { id: "Toolbar", patterns: [/ActionToolbar|ReportToolbar|PLToolbar/] },
  { id: "Tabs", patterns: [/Tabs\.tsx|@radix-ui\/react-tabs/] },
  { id: "Breadcrumbs", patterns: [/Breadcrumb/] },
  { id: "FormField", patterns: [/FormField|FieldRow|FormPanel/] },
  { id: "ErrorMessage", patterns: [/ErrorMessage|FormError|field-error/] },
  { id: "ErrorSummary", patterns: [/ErrorSummary|InitErrorScreen/] },
  { id: "FileUpload", patterns: [/AttachmentUploader|FileUpload|type="file"/] },
  { id: "DocumentPreview", patterns: [/DocumentPreview|InvoicePrint|VoucherPrint/] },
  { id: "AuditTimeline", patterns: [/AuditHistoryPanel|AuditLog|AuditTrail/] },
  { id: "SyncIndicator", patterns: [/SyncStatusControl|sync-popover|Sync status/] },
];

const UI_CANONICAL = {
  Button: "src/components/ui/Button.tsx",
  Input: "src/components/ui/Input.tsx",
  Select: "src/components/ui/Select.tsx",
  Card: "src/components/ui/Card.tsx",
  Badge: "src/components/ui/Badge.tsx",
  Table: "src/components/ui/Table.tsx",
  DataTable: "src/components/ui/DataTable.tsx",
  Modal: "src/components/ui/Modal.tsx",
  ConfirmDialog: "src/components/ui/ConfirmDialog.tsx",
  Tooltip: "src/components/ui/Tooltip.tsx",
  EmptyState: "src/components/ui/EmptyState.tsx",
  Pagination: "src/components/ui/Pagination.tsx",
  NepaliDatePicker: "src/components/ui/NepaliDatePicker.tsx",
  AmountInput: "src/components/ui/AmountInput.tsx",
  ActionToolbar: "src/components/ui/ActionToolbar.tsx",
  Spinner: "src/components/ui/Spinner.tsx",
  PageLoader: "src/components/ui/PageLoader.tsx",
  NotificationPanel: "src/components/ui/NotificationPanel.tsx",
  AttachmentUploader: "src/components/ui/AttachmentUploader.tsx",
};

const allFiles = walk(SRC);

function countImportConsumers(exportPath) {
  const base = path.basename(exportPath, path.extname(exportPath));
  const needleVariants = [
    `components/ui/${base}`,
    `components/ui/${base}.tsx`,
    `@/components/ui/${base}`,
    `../ui/${base}`,
    `./${base}`,
  ];
  let count = 0;
  const consumers = [];
  for (const f of allFiles) {
    if (rel(f) === exportPath) continue;
    const t = fs.readFileSync(f, "utf8");
    if (needleVariants.some((n) => t.includes(n)) || (t.includes(`from "@/components/ui"`) && t.includes(base))) {
      // loose: if importing from barrel and file mentions component — skip barrel precision
      if (t.includes(base)) {
        count++;
        consumers.push(rel(f));
      }
    }
  }
  return { count, consumers: consumers.slice(0, 40) };
}

const components = [];

for (const target of TARGETS) {
  const implementations = [];
  for (const f of allFiles) {
    const r = rel(f);
    const name = path.basename(f);
    const matched = target.patterns.some((p) => p.test(r) || p.test(name));
    if (!matched) continue;
    // Prefer definition files
    const text = fs.readFileSync(f, "utf8");
    const isDef =
      /export\s+(default\s+)?(function|const)\s+\w+/.test(text) ||
      name.includes(target.id) ||
      /ui\//.test(r);
    if (!isDef && !target.patterns.some((p) => p.test(r))) continue;
    implementations.push(r);
  }

  // Deduplicate and score
  const unique = [...new Set(implementations)].sort();
  const entries = unique.map((filename) => {
    const canonical = UI_CANONICAL[target.id] === filename;
    const consumers = canonical || filename.includes("/ui/") ? countImportConsumers(filename) : { count: 0, consumers: [] };
    let recommendation = "merge";
    if (canonical || filename.startsWith("src/components/ui/")) recommendation = "canonical candidate";
    else if (/BusyShell|tally|legacy|Sidebar\.tsx|TopMenuBar|BusyMenuBar/.test(filename))
      recommendation = "deprecate";
    else if (/radix|vaul|cmdk|sonner|react-hot-toast/.test(filename)) recommendation = "adapter";
    else recommendation = "merge";

    return {
      filename,
      export: path.basename(filename, path.extname(filename)),
      active_consumers_sample: consumers.consumers,
      active_consumer_count_estimate: consumers.count,
      visual_style: filename.includes("/ui/")
        ? "design-system-candidate"
        : filename.includes("Busy")
          ? "legacy-busy"
          : filename.includes("tally")
            ? "legacy-tally"
            : "page-local-or-feature",
      accessibility: "unverified",
      size_variants: "unknown",
      semantic_variants: "unknown",
      dependency: filename.includes("/ui/") ? "@/components/ui" : "direct",
      test_coverage: "unknown",
      recommendation,
    };
  });

  components.push({
    primitive: target.id,
    implementation_count: entries.length,
    implementations: entries,
  });
}

const duplication = {
  generated_at: new Date().toISOString(),
  approved_import_path: "@/components/ui",
  barrel: "src/components/ui/index.ts",
  note: "Consumer counts are heuristic (string match). Use for migration planning, not exact dependency graphs.",
  components,
  summary: {
    primitives_scanned: components.length,
    primitives_with_multiple_impls: components.filter((c) => c.implementation_count > 1).length,
    ui_canonical_files: Object.keys(UI_CANONICAL).length,
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "UI_COMPONENT_DUPLICATION_MAP.json"), JSON.stringify(duplication, null, 2));

const md = `# UI Component Duplication Map

Generated: ${duplication.generated_at}

## Policy (Phase UI-0)

- **Approved future import path**: \`@/components/ui\` (barrel \`src/components/ui/index.ts\`)
- Do **not** replace components in this phase — inventory only
- Recommendation legend: \`canonical candidate\` | \`merge\` | \`adapter\` | \`deprecate\` | \`remove after migration\`

## Summary

| Metric | Value |
|--------|------:|
| Primitives scanned | ${duplication.summary.primitives_scanned} |
| With multiple implementations | ${duplication.summary.primitives_with_multiple_impls} |
| Known ui/ canonical files | ${duplication.summary.ui_canonical_files} |

## By primitive

${components
  .map((c) => {
    const rows = c.implementations
      .map(
        (i) =>
          `| \`${i.filename}\` | ${i.recommendation} | ${i.visual_style} | ~${i.active_consumer_count_estimate} |`,
      )
      .join("\n");
    return `### ${c.primitive} (${c.implementation_count})\n\n| File | Recommendation | Style | Consumers (est.) |\n|------|----------------|-------|-----------------:|\n${rows || "| _none found_ | | | |"}`;
  })
  .join("\n\n")}
`;

fs.writeFileSync(path.join(OUT_DIR, "UI_COMPONENT_DUPLICATION_MAP.md"), md);
console.log(
  `Component map: ${duplication.summary.primitives_scanned} primitives, ${duplication.summary.primitives_with_multiple_impls} duplicated`,
);
