/**
 * UI-0.2 — Extract route inventory from App.tsx switch + navConfig.
 * Writes docs/ui-audit/UI_ROUTE_INVENTORY.json and .md
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = fs.readFileSync(path.join(ROOT, "src/App.tsx"), "utf8");
const NAV = fs.readFileSync(path.join(ROOT, "src/components/shell/navConfig.ts"), "utf8");
const OUT_DIR = path.join(ROOT, "docs/ui-audit");

const QA_PAGES = new Set([
  "orbix",
  "parties",
  "party-master",
  "journal",
  "billing",
  "purchase-invoice",
  "sales-invoice",
  "sales-return",
  "purchase-return",
  "purchase",
  "receipt",
  "payment",
  "day-book",
  "ledger",
  "ledger-report",
  "trial-balance",
  "profit-loss",
  "balance-sheet",
  "bank-reconciliation",
  "bank-statement-import",
  "items",
  "item-master",
  "stock-book",
  "stock-summary",
  "inventory-summary",
  "stock-journal",
  "accounts",
  "chart-of-accounts",
  "audit-log",
  "users",
  "users-management",
  "settings",
  "company-settings",
  "backup",
  "backup-restore",
  "dashboard",
  "financial-dashboard",
]);

const CRITICAL = new Set([
  "dashboard",
  "orbix",
  "billing",
  "purchase",
  "receipt",
  "payment",
  "journal",
  "accounts",
  "parties",
  "items",
  "day-book",
  "ledger",
  "trial-balance",
  "profit-loss",
  "balance-sheet",
  "bank-reconciliation",
  "bank-statement-import",
  "stock-summary",
  "audit-log",
  "users",
  "settings",
  "backup-restore",
]);

function moduleFor(page) {
  if (/dashboard|orbix|home/.test(page)) return "home";
  if (/sales|billing|purchase|receipt|payment|journal|contra|debit|credit|voucher|order|quotation|challan|grn|goods/.test(page))
    return "transactions";
  if (/account|party|item|unit|warehouse|ledger-master|price|cost|budget|narration|bill-sundry|fiscal|master|employee/.test(page))
    return "masters";
  if (/bank|cheque|pdc|recon/.test(page)) return "banking";
  if (/stock|inventory|physical|batch|production|material|warehouse/.test(page)) return "inventory";
  if (/balance-sheet|profit|trial|day-book|ledger|cash-flow|aging|outstanding|vat|ratio|register|report/.test(page))
    return "reports";
  if (/audit|tds|compliance|period-lock/.test(page)) return "compliance";
  if (/user|setting|backup|config|import|export|communication/.test(page)) return "settings";
  return "other";
}

function priorityFor(page) {
  if (CRITICAL.has(page)) return 1;
  const mod = moduleFor(page);
  if (mod === "transactions" || mod === "home") return 2;
  if (mod === "reports" || mod === "banking") return 3;
  if (mod === "masters" || mod === "inventory") return 4;
  return 5;
}

/** Parse App.tsx case clusters → component */
function extractRoutesFromApp(src) {
  const switchIdx = src.indexOf("const renderPage");
  const body = switchIdx >= 0 ? src.slice(switchIdx) : src;
  const routes = [];
  const caseBlocks = [];
  let currentCases = [];
  const lines = body.split("\n");

  for (const line of lines) {
    const caseMatch = line.match(/case\s+"([^"]+)":/);
    if (caseMatch) {
      currentCases.push(caseMatch[1]);
      continue;
    }
    const retMatch = line.match(/return\s+<([A-Za-z0-9_]+)/);
    if (retMatch && currentCases.length) {
      caseBlocks.push({ pages: [...currentCases], component: retMatch[1] });
      currentCases = [];
      continue;
    }
    if (/^\s*default\s*:/.test(line)) {
      currentCases = ["__default__"];
    }
    if (line.includes("switch") && routes.length === 0 && caseBlocks.length > 50) break;
  }

  // Also capture default
  const def = body.match(/default:\s*\n\s*return\s+<([A-Za-z0-9_]+)/);
  if (def) {
    caseBlocks.push({ pages: ["__default__"], component: def[1] });
  }

  const pageToComponent = new Map();
  for (const block of caseBlocks) {
    for (const p of block.pages) {
      if (p === "__default__") continue;
      pageToComponent.set(p, block.component);
    }
  }

  // Alias groups: pages sharing a component
  const byComp = new Map();
  for (const [page, comp] of pageToComponent) {
    if (!byComp.has(comp)) byComp.set(comp, []);
    byComp.get(comp).push(page);
  }

  for (const [page, component] of pageToComponent) {
    const aliases = byComp.get(component).filter((p) => p !== page);
    routes.push({
      route_path: `app://${page}`,
      route_name: page,
      page_component: component,
      layout_or_shell: "Layout → AppShell",
      module: moduleFor(page),
      user_role: "authenticated",
      permission_requirement: "unknown-runtime",
      authenticated: true,
      active: true,
      duplicated: aliases.length > 0,
      duplicate_aliases: aliases,
      legacy: false,
      mobile_compatible: "partial",
      dark_mode_compatible: "partial",
      visually_covered_by_tests: QA_PAGES.has(page),
      estimated_redesign_priority: priorityFor(page),
      navigation_entry: null,
    });
  }

  return { routes, pageToComponent, defaultComponent: def?.[1] ?? "FinancialDashboard" };
}

function extractNavPages(src) {
  const pages = [];
  const re = /page:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) pages.push(m[1]);
  const labels = [];
  const labelRe = /label:\s*"([^"]+)"[\s\S]*?page:\s*"([^"]+)"/g;
  while ((m = labelRe.exec(src))) {
    labels.push({ label: m[1], page: m[2] });
  }
  // Simpler: item lines
  const items = [];
  const itemRe = /\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*page:\s*"([^"]+)"/g;
  while ((m = itemRe.exec(src))) {
    items.push({ id: m[1], label: m[2], page: m[3] });
  }
  const groups = [];
  const groupRe = /id:\s*"([^"]+)",\s*label:\s*"([^"]+)",[\s\S]*?(?:page:\s*"([^"]+)",)?/g;
  // Use SHELL_NAV group tops
  const topRe = /\{\s*id:\s*"(home|orbix|transactions|masters|banking|inventory|reports|analytics|compliance|automations|settings)",\s*label:\s*"([^"]+)"/g;
  while ((m = topRe.exec(src))) {
    groups.push({ id: m[1], label: m[2] });
  }
  return { pages: [...new Set(pages)], items, groups };
}

function classifyAuthRoutes() {
  return [
    {
      route_path: "app://auth/checking",
      route_name: "auth-checking",
      page_component: "inline-spinner",
      layout_or_shell: "none",
      module: "auth",
      user_role: "anonymous",
      permission_requirement: "none",
      authenticated: false,
      active: true,
      duplicated: false,
      duplicate_aliases: [],
      legacy: false,
      mobile_compatible: "yes",
      dark_mode_compatible: "partial",
      visually_covered_by_tests: false,
      estimated_redesign_priority: 3,
      navigation_entry: null,
    },
    {
      route_path: "app://auth/gateway",
      route_name: "gateway",
      page_component: "GatewayScreen",
      layout_or_shell: "auth",
      module: "auth",
      user_role: "anonymous",
      permission_requirement: "none",
      authenticated: false,
      active: true,
      duplicated: false,
      duplicate_aliases: [],
      legacy: false,
      mobile_compatible: "yes",
      dark_mode_compatible: "partial",
      visually_covered_by_tests: false,
      estimated_redesign_priority: 3,
      navigation_entry: null,
    },
    {
      route_path: "app://auth/company-login",
      route_name: "company-login",
      page_component: "CompanyLoginScreen",
      layout_or_shell: "auth",
      module: "auth",
      user_role: "anonymous",
      permission_requirement: "none",
      authenticated: false,
      active: true,
      duplicated: false,
      duplicate_aliases: [],
      legacy: false,
      mobile_compatible: "yes",
      dark_mode_compatible: "partial",
      visually_covered_by_tests: false,
      estimated_redesign_priority: 3,
      navigation_entry: null,
    },
    {
      route_path: "app://auth/sign-up",
      route_name: "no-company",
      page_component: "SignUpWizard",
      layout_or_shell: "auth",
      module: "auth",
      user_role: "anonymous",
      permission_requirement: "none",
      authenticated: false,
      active: true,
      duplicated: false,
      duplicate_aliases: [],
      legacy: false,
      mobile_compatible: "yes",
      dark_mode_compatible: "partial",
      visually_covered_by_tests: false,
      estimated_redesign_priority: 3,
      navigation_entry: null,
    },
  ];
}

const { routes, pageToComponent, defaultComponent } = extractRoutesFromApp(APP);
const nav = extractNavPages(NAV);
const navSet = new Set(nav.pages);

for (const r of routes) {
  r.navigation_entry = navSet.has(r.route_name);
}

const authRoutes = classifyAuthRoutes();
const allRoutes = [...authRoutes, ...routes].sort((a, b) =>
  a.route_name.localeCompare(b.route_name),
);

const pagesWithoutNav = routes.filter((r) => !r.navigation_entry).map((r) => r.route_name);
const navWithoutRoute = nav.pages.filter((p) => !pageToComponent.has(p));

const inventory = {
  generated_at: new Date().toISOString(),
  source: {
    router: "Zustand currentPage switch in src/App.tsx (no React Router)",
    navigation: "src/components/shell/navConfig.ts SHELL_NAV",
    shell: "Layout → AppShell",
  },
  summary: {
    total_routes: allRoutes.length,
    authenticated_routes: routes.length,
    auth_routes: authRoutes.length,
    unique_page_components: new Set(routes.map((r) => r.page_component)).size,
    routes_with_nav_entry: routes.filter((r) => r.navigation_entry).length,
    routes_without_nav_entry: pagesWithoutNav.length,
    nav_destinations_without_route: navWithoutRoute.length,
    visually_covered: routes.filter((r) => r.visually_covered_by_tests).length,
    duplicated_alias_groups: routes.filter((r) => r.duplicated).length,
  },
  default_component: defaultComponent,
  nav_groups: nav.groups,
  nav_items: nav.items,
  pages_without_nav: pagesWithoutNav,
  nav_without_route: navWithoutRoute,
  routes: allRoutes,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "UI_ROUTE_INVENTORY.json"), JSON.stringify(inventory, null, 2));

const md = `# UI Route Inventory

Generated: ${inventory.generated_at}

## Summary

| Metric | Value |
|--------|------:|
| Total routes (incl. auth) | ${inventory.summary.total_routes} |
| Authenticated page IDs | ${inventory.summary.authenticated_routes} |
| Unique page components | ${inventory.summary.unique_page_components} |
| With nav entry | ${inventory.summary.routes_with_nav_entry} |
| Without nav entry | ${inventory.summary.routes_without_nav_entry} |
| Nav destinations missing App route | ${inventory.summary.nav_destinations_without_route} |
| Visually covered (UI QA harness) | ${inventory.summary.visually_covered} |

## Router model

Navigation is **not** URL-path based. The app uses Zustand \`currentPage\` and a large \`switch\` in \`src/App.tsx\`. Authenticated pages render inside \`Layout\` → \`AppShell\`.

## Auth stages

| Stage | Component |
|-------|-----------|
| checking | inline spinner |
| error | InitErrorScreen |
| no-company | SignUpWizard |
| gateway | GatewayScreen |
| company-login | CompanyLoginScreen |
| authenticated | Layout → AppShell → page |

## Routes without navigation entry

${pagesWithoutNav.map((p) => `- \`${p}\``).join("\n") || "_None_"}

## Nav destinations without App.tsx route

${navWithoutRoute.map((p) => `- \`${p}\``).join("\n") || "_None_"}

## Full route table

| Page ID | Component | Module | Nav | Visual QA | Priority |
|---------|-----------|--------|-----|-----------|----------|
${routes
  .map(
    (r) =>
      `| ${r.route_name} | ${r.page_component} | ${r.module} | ${r.navigation_entry ? "yes" : "no"} | ${r.visually_covered_by_tests ? "yes" : "no"} | P${r.estimated_redesign_priority} |`,
  )
  .join("\n")}
`;

fs.writeFileSync(path.join(OUT_DIR, "UI_ROUTE_INVENTORY.md"), md);
console.log(
  `Wrote UI_ROUTE_INVENTORY: ${inventory.summary.authenticated_routes} authenticated routes, ${inventory.summary.unique_page_components} components`,
);
