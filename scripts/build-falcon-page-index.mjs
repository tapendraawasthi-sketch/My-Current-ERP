/**
 * Build-time index of ERP screens from App.tsx routing + page component headers.
 * Also parses BusyMenuBar.tsx (MENU_TREE + PAGE_SHORTCUTS) and Sidebar.tsx menus.
 * Output is bundled into the app so Falcon can answer from actual code structure
 * without requiring the erp_bot / Ollama stack.
 */

import { readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const APP_TSX = join(ROOT, "src/App.tsx");
const SIDEBAR_TSX = join(ROOT, "src/components/Sidebar.tsx");
const BUSY_MENU_TSX = join(ROOT, "src/components/BusyMenuBar.tsx");
const OUT_FILE = join(ROOT, "src/lib/falcon/generatedPageIndex.ts");

/** @typedef {{ route: string; aliases: string[]; component: string; file: string; title: string; subtitle: string; menuPath: string; menuPaths: string[]; shortcut: string }} PageEntry */

function parseAppRoutes(appSource) {
  /** @type {Map<string, { aliases: string[], component: string }>} */
  const byComponent = new Map();

  const caseBlock = appSource.match(/switch\s*\(\s*currentPage\s*\)\s*\{([\s\S]*?)\n\s*default:/);
  if (!caseBlock) {
    console.warn("[falcon-index] Could not parse App.tsx switch block");
    return [];
  }

  const lines = caseBlock[1].split("\n");
  let pendingCases = [];

  for (const line of lines) {
    const caseMatch = line.match(/case\s+["']([^"']+)["']\s*:/);
    if (caseMatch) {
      pendingCases.push(caseMatch[1]);
      continue;
    }
    const returnMatch = line.match(/return\s+<(\w+)/);
    if (returnMatch && pendingCases.length > 0) {
      const component = returnMatch[1];
      if (!byComponent.has(component)) {
        byComponent.set(component, { aliases: [], component });
      }
      byComponent.get(component).aliases.push(...pendingCases);
      pendingCases = [];
    }
  }

  return [...byComponent.values()];
}

function parseSidebarMenu(sidebarSource) {
  /** @type {Map<string, string[]>} */
  const routeToMenus = new Map();
  const groupRegex = /title:\s*"([^"]+)"[\s\S]*?items:\s*\[([\s\S]*?)\]/g;
  let groupMatch;
  while ((groupMatch = groupRegex.exec(sidebarSource)) !== null) {
    const groupTitle = groupMatch[1];
    const itemsBlock = groupMatch[2];
    const itemRegex = /label:\s*"([^"]+)"[\s\S]*?page:\s*"([^"]+)"/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(itemsBlock)) !== null) {
      const path = `${groupTitle} → ${itemMatch[1]}`;
      const route = itemMatch[2];
      if (!routeToMenus.has(route)) routeToMenus.set(route, []);
      const paths = routeToMenus.get(route);
      if (!paths.includes(path)) paths.push(path);
    }
  }
  return routeToMenus;
}

/** Parse PAGE_SHORTCUTS and MENU_TREE from BusyMenuBar.tsx */
function parseBusyMenuBar(busySource) {
  /** @type {Record<string, string>} */
  const shortcuts = {};
  const scStart = busySource.indexOf("PAGE_SHORTCUTS");
  if (scStart !== -1) {
    const braceStart = busySource.indexOf("{", scStart);
    let depth = 0;
    let end = braceStart;
    for (let i = braceStart; i < busySource.length; i++) {
      if (busySource[i] === "{") depth++;
      if (busySource[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const block = busySource.slice(braceStart + 1, end);
    for (const [, route, key] of block.matchAll(/["']?([\w-]+)["']?\s*:\s*"([^"]+)"/g)) {
      shortcuts[route] = key;
    }
  }

  /** @type {Map<string, string[]>} */
  const routeToMenus = new Map();

  const treeIdx = busySource.indexOf("const MENU_TREE");
  if (treeIdx === -1) return { shortcuts, routeToMenus };

  const treeSlice = busySource.slice(treeIdx);
  const lines = treeSlice.split("\n");

  let inTree = false;
  let section = "";
  let subgroup = "";

  for (const line of lines) {
    if (line.includes("const MENU_TREE")) {
      inTree = true;
      continue;
    }
    if (!inTree) continue;
    if (/^\];/.test(line.trim()) && !line.includes("children")) break;

    const titleMatch = line.match(/^\s*title:\s*"([^"]+)"/);
    if (titleMatch) {
      section = titleMatch[1];
      subgroup = "";
      continue;
    }

    const subgroupMatch = line.match(/label:\s*"([^"]+)".*children:\s*\[/);
    if (subgroupMatch) {
      subgroup = subgroupMatch[1];
      continue;
    }

    const pageMatch = line.match(/label:\s*"([^"]+)".*page:\s*"([^"]+)"/);
    if (pageMatch) {
      const [, label, page] = pageMatch;
      const parts = [section, subgroup, label].filter(Boolean);
      const path = parts.join(" → ");
      if (!routeToMenus.has(page)) routeToMenus.set(page, []);
      const paths = routeToMenus.get(page);
      if (!paths.includes(path)) paths.push(path);
    }
  }

  return { shortcuts, routeToMenus };
}

function resolveShortcut(route, aliases, shortcuts) {
  if (shortcuts[route]) return shortcuts[route];
  for (const alias of aliases) {
    if (shortcuts[alias]) return shortcuts[alias];
  }
  return "";
}

function mergeMenuPaths(route, aliases, sidebarMenus, busyMenus) {
  /** @type {string[]} */
  const paths = [];
  const add = (p) => {
    if (p && !paths.includes(p)) paths.push(p);
  };

  for (const key of [route, ...aliases]) {
    for (const p of busyMenus.get(key) || []) add(p);
    for (const p of sidebarMenus.get(key) || []) add(p);
  }

  return paths;
}

async function findComponentFile(componentName) {
  const candidates = [
    join(ROOT, `src/pages/${componentName}.tsx`),
    join(ROOT, `src/components/${componentName}.tsx`),
  ];
  for (const path of candidates) {
    try {
      await readFile(path, "utf8");
      return path.replace(ROOT + "/", "");
    } catch {
      /* try next */
    }
  }
  return `src/pages/${componentName}.tsx`;
}

function extractPageHeader(source) {
  const titleMatch = source.match(
    /<h1[^>]*className="[^"]*text-\[15px\][^"]*font-semibold[^"]*"[^>]*>([^<]+)<\/h1>/,
  );
  const subtitleMatch = source.match(
    /<p[^>]*className="[^"]*text-\[11px\][^"]*text-gray-500[^"]*"[^>]*>([^<]+)<\/p>/,
  );
  return {
    title: titleMatch?.[1]?.trim() ?? "",
    subtitle: subtitleMatch?.[1]?.trim() ?? "",
  };
}

async function main() {
  const [appSource, sidebarSource, busySource] = await Promise.all([
    readFile(APP_TSX, "utf8"),
    readFile(SIDEBAR_TSX, "utf8"),
    readFile(BUSY_MENU_TSX, "utf8").catch(() => ""),
  ]);

  const routes = parseAppRoutes(appSource);
  const sidebarMenus = parseSidebarMenu(sidebarSource);
  const { shortcuts, routeToMenus: busyMenus } = parseBusyMenuBar(busySource);

  /** @type {PageEntry[]} */
  const entries = [];

  for (const { aliases, component } of routes) {
    const primaryRoute = aliases[0];
    const file = await findComponentFile(component);
    let title = "";
    let subtitle = "";
    try {
      const pageSource = await readFile(join(ROOT, file), "utf8");
      ({ title, subtitle } = extractPageHeader(pageSource));
    } catch {
      /* page file may not exist or use non-standard header */
    }

    const menuPaths = mergeMenuPaths(primaryRoute, aliases, sidebarMenus, busyMenus);
    const menuPath = menuPaths[0] ?? "";

    entries.push({
      route: primaryRoute,
      aliases: [...new Set(aliases)],
      component,
      file,
      title: title || component.replace(/([A-Z])/g, " $1").trim(),
      subtitle,
      menuPath,
      menuPaths,
      shortcut: resolveShortcut(primaryRoute, aliases, shortcuts),
    });
  }

  entries.sort((a, b) => a.route.localeCompare(b.route));

  const withShortcut = entries.filter((e) => e.shortcut).length;
  const withMenu = entries.filter((e) => e.menuPath).length;

  const output = `// AUTO-GENERATED by scripts/build-falcon-page-index.mjs — do not edit manually.
// Rebuilt on every \`npm run build\`. ${entries.length} screens indexed from App.tsx + menus + shortcuts.

export interface GeneratedPageEntry {
  route: string;
  aliases: string[];
  component: string;
  file: string;
  title: string;
  subtitle: string;
  menuPath: string;
  menuPaths: string[];
  shortcut: string;
}

export const GENERATED_PAGE_INDEX: GeneratedPageEntry[] = ${JSON.stringify(entries, null, 2)};

export const GENERATED_PAGE_INDEX_BUILT_AT = ${JSON.stringify(new Date().toISOString())};
`;

  await writeFile(OUT_FILE, output, "utf8");
  console.log(
    `[falcon-index] Wrote ${entries.length} screens (${withMenu} with menu paths, ${withShortcut} with shortcuts)`,
  );
}

main().catch((err) => {
  console.error("[falcon-index] Failed:", err);
  process.exit(1);
});
