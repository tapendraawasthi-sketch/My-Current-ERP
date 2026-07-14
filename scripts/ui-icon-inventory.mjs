/**
 * UI-0.6 — Lucide (and other) icon registry from source imports.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "docs/ui-audit/UI_ICON_REGISTRY.json");

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", "dist"].includes(ent.name)) continue;
      walk(p, files);
    } else if (/\.(tsx|ts|jsx|js)$/.test(ent.name)) files.push(p);
  }
  return files;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

const icons = new Map(); // name -> { import_source, files: Set, count }

const IMPORT_BLOCK =
  /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/gs;
const SINGLE =
  /import\s+(\w+)\s+from\s*["']lucide-react\/(?:dist\/esm\/icons\/)?([^"']+)["']/g;

for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, "utf8");
  let m;
  const blockRe = new RegExp(IMPORT_BLOCK.source, "gs");
  while ((m = blockRe.exec(text))) {
    const names = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\s+as\s+\w+$/, "").trim())
      .filter((s) => /^[A-Z]/.test(s));
    for (const name of names) {
      if (!icons.has(name)) {
        icons.set(name, { icon: name, import_source: "lucide-react", files: new Set(), occurrence_count: 0 });
      }
      const rec = icons.get(name);
      rec.files.add(rel(file));
      rec.occurrence_count++;
    }
  }
}

// Usage count: JSX <IconName
for (const [name, rec] of icons) {
  let usage = 0;
  const usageFiles = new Set();
  for (const file of walk(SRC)) {
    const text = fs.readFileSync(file, "utf8");
    const re = new RegExp(`<${name}\\b`, "g");
    const hits = text.match(re);
    if (hits) {
      usage += hits.length;
      usageFiles.add(rel(file));
    }
  }
  rec.jsx_usage_count = usage;
  rec.jsx_usage_files = [...usageFiles].sort();
  rec.files = [...rec.files].sort();
  rec.import_file_count = rec.files.length;
  // heuristic purpose
  const n = name.toLowerCase();
  if (/trash|delete|x|close|remove/.test(n)) rec.semantic_purpose = "destructive/close";
  else if (/edit|pencil|pen/.test(n)) rec.semantic_purpose = "edit";
  else if (/plus|add/.test(n)) rec.semantic_purpose = "create";
  else if (/search|magnifier/.test(n)) rec.semantic_purpose = "search";
  else if (/settings|cog|gear/.test(n)) rec.semantic_purpose = "settings";
  else if (/check|circle-check/.test(n)) rec.semantic_purpose = "success/confirm";
  else if (/alert|warn|triangle/.test(n)) rec.semantic_purpose = "warning";
  else if (/info|help/.test(n)) rec.semantic_purpose = "info";
  else if (/chevron|arrow|caret/.test(n)) rec.semantic_purpose = "navigation/disclosure";
  else if (/printer|download|upload|share/.test(n)) rec.semantic_purpose = "export/action";
  else rec.semantic_purpose = "general/decorative-candidate";
}

// Duplicate purpose groups
const byPurpose = new Map();
for (const rec of icons.values()) {
  if (!byPurpose.has(rec.semantic_purpose)) byPurpose.set(rec.semantic_purpose, []);
  byPurpose.get(rec.semantic_purpose).push(rec.icon);
}

const registry = {
  generated_at: new Date().toISOString(),
  import_source: "lucide-react",
  distinct_imported_icons: icons.size,
  total_import_statements_items: [...icons.values()].reduce((a, r) => a + r.occurrence_count, 0),
  total_jsx_usages: [...icons.values()].reduce((a, r) => a + (r.jsx_usage_count || 0), 0),
  duplicate_purpose_groups: Object.fromEntries(
    [...byPurpose.entries()].filter(([, arr]) => arr.length > 1),
  ),
  icons: [...icons.values()].sort((a, b) => b.jsx_usage_count - a.jsx_usage_count || a.icon.localeCompare(b.icon)),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(registry, null, 2));
console.log(`Icon registry: ${registry.distinct_imported_icons} distinct lucide icons`);
