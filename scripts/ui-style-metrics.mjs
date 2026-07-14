/**
 * UI-0.4 / UI-0.6 — Style, typography, colour, spacing metrics from repository source.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const OUT_DIR = path.join(ROOT, "docs/ui-audit");

function walk(dir, exts, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", "dist", ".git"].includes(ent.name)) continue;
      walk(p, exts, files);
    } else if (exts.some((e) => ent.name.endsWith(e))) {
      files.push(p);
    }
  }
  return files;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

const cssFiles = walk(SRC, [".css"]);
const tsxFiles = walk(SRC, [".tsx", ".jsx"]);
const allCode = [...cssFiles, ...tsxFiles];

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const RGB_RE = /\brgba?\([^)]+\)/gi;
const HSL_RE = /\bhsla?\([^)]+\)/gi;
const IMPORTANT_RE = /!important/g;
const INLINE_STYLE_ATTR = /\bstyle=\{\{/g;
const STYLE_OBJECT = /\bstyle=\{\s*[a-zA-Z_$]/g;
const ARBITRARY_COLOR = /(?:bg|text|border|ring|fill|stroke|from|to|via)-\[#[0-9a-fA-F]{3,8}\]/g;
const ARBITRARY_TEXT = /text-\[[0-9.]+(?:px|rem|em)\]/g;
const ARBITRARY_SPACE =
  /(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy]|h|w|min-h|min-w|max-h|max-w)-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g;
const RADIUS_RE = /rounded-(?:none|sm|md|lg|xl|2xl|3xl|full)|\bborderRadius\s*:\s*['"]?([^,'"}\s]+)/g;
const SHADOW_RE = /shadow-(?:sm|md|lg|xl|2xl|inner|none)|boxShadow\s*:\s*['"]([^'"]+)['"]/g;
const Z_RE = /z-\[(\d+)\]|z-index\s*:\s*(-?\d+)/gi;
const FONT_SIZE_CLASS = /text-\[(\d+(?:\.\d+)?)px\]/g;
const H_CLASS = /\bh-(\d+)\b/g;
const H_PX = /\bh-\[(\d+)px\]/g;
const UPPERCASE = /\buppercase\b/g;
const FONT_MONO = /\bfont-mono\b|tabular-nums/g;
const TABULAR = /\btabular-nums\b/g;
const BLACK_BORDER = /border-(?:\[#000(?:000)?\]|black)\b|#000(?:000)?(?=[^0-9a-fA-F]|$)/gi;
const LEGACY_GREEN = /#(?:e8f5e9|c8e6c9|a5d6a7|81c784|66bb6a|4caf50|43a047|388e3c|2e7d32|1b5e20|f1f8e9|dcedc8)|tally-green|busy-green/gi;

const hexCounts = new Map();
let hexTotal = 0;
let rgbTotal = 0;
let hslTotal = 0;
let importantTotal = 0;
let arbitraryColor = 0;
let arbitraryFont = 0;
let arbitrarySpace = 0;
const fontSizeDist = {};
const radiusSet = new Set();
const shadowSet = new Set();
const zSet = new Set();
let inlineStyleFiles = 0;
const inlineStyleFileList = [];
let uppercaseCount = 0;
let monoCount = 0;
let tabularCount = 0;
let blackBorderHits = 0;
let legacyGreenHits = 0;
let controlsBelow32 = 0;
let controlsBelow36 = 0;
let touchBelow44 = 0;
const hClassToPx = { 6: 24, 7: 28, 8: 32, 9: 36, 10: 40, 11: 44, 12: 48 };

let textBelow12 = 0;
const textExact = { 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0 };

for (const file of allCode) {
  const text = fs.readFileSync(file, "utf8");
  const isTsx = file.endsWith(".tsx") || file.endsWith(".jsx");

  const hexes = text.match(HEX_RE) || [];
  for (const h of hexes) {
    const norm = h.toLowerCase();
    hexTotal++;
    hexCounts.set(norm, (hexCounts.get(norm) || 0) + 1);
  }
  rgbTotal += (text.match(RGB_RE) || []).length;
  hslTotal += (text.match(HSL_RE) || []).length;
  importantTotal += (text.match(IMPORTANT_RE) || []).length;
  arbitraryColor += (text.match(ARBITRARY_COLOR) || []).length;
  arbitraryFont += (text.match(ARBITRARY_TEXT) || []).length;
  arbitrarySpace += (text.match(ARBITRARY_SPACE) || []).length;
  uppercaseCount += (text.match(UPPERCASE) || []).length;
  monoCount += (text.match(FONT_MONO) || []).length;
  tabularCount += (text.match(TABULAR) || []).length;
  blackBorderHits += (text.match(BLACK_BORDER) || []).length;
  legacyGreenHits += (text.match(LEGACY_GREEN) || []).length;

  let m;
  const fsRe = new RegExp(FONT_SIZE_CLASS.source, "g");
  while ((m = fsRe.exec(text))) {
    const px = parseFloat(m[1]);
    fontSizeDist[px] = (fontSizeDist[px] || 0) + 1;
    if (px < 12) textBelow12++;
    if (textExact[px] !== undefined) textExact[px]++;
  }

  const rRe = /rounded-(?:none|sm|md|lg|xl|2xl|3xl|full)/g;
  while ((m = rRe.exec(text))) radiusSet.add(m[0]);
  const brRe = /borderRadius\s*:\s*['"]?([^,'"}\s]+)/g;
  while ((m = brRe.exec(text))) radiusSet.add(m[1]);

  const shRe = /shadow-(?:sm|md|lg|xl|2xl|inner|none)/g;
  while ((m = shRe.exec(text))) shadowSet.add(m[0]);
  const bsRe = /boxShadow\s*:\s*['"]([^'"]+)['"]/g;
  while ((m = bsRe.exec(text))) shadowSet.add(m[1]);

  const zRe = /z-\[(\d+)\]|z-index\s*:\s*(-?\d+)/gi;
  while ((m = zRe.exec(text))) zSet.add(m[1] || m[2]);

  if (isTsx) {
    const hasInline =
      INLINE_STYLE_ATTR.test(text) ||
      /\bstyle=\{\s*\{/.test(text) ||
      /\bstyle:\s*\{/.test(text) ||
      /React\.CSSProperties/.test(text);
    // reset lastIndex
    INLINE_STYLE_ATTR.lastIndex = 0;
    if (/\bstyle=\{\{/.test(text) || /\bstyle=\{\s*[a-zA-Z_$]/.test(text)) {
      inlineStyleFiles++;
      inlineStyleFileList.push(rel(file));
    }

    const hRe = /\bh-(\d+)\b/g;
    while ((m = hRe.exec(text))) {
      const px = hClassToPx[m[1]];
      if (px !== undefined) {
        if (px < 32) controlsBelow32++;
        if (px < 36) controlsBelow36++;
        if (px < 44) touchBelow44++;
      }
    }
    const hpRe = /\bh-\[(\d+)px\]/g;
    while ((m = hpRe.exec(text))) {
      const px = parseInt(m[1], 10);
      if (px < 32) controlsBelow32++;
      if (px < 36) controlsBelow36++;
      if (px < 44) touchBelow44++;
    }
  }
}

const mostCommon = [...hexCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .map(([color, count]) => ({ color, count }));

const tallyGreenConsumers = [];
for (const file of tsxFiles) {
  const text = fs.readFileSync(file, "utf8");
  if (/tally-green\.css/.test(text) || /styles\/tally-green/.test(text)) {
    tallyGreenConsumers.push(rel(file));
  }
}

const metrics = {
  generated_at: new Date().toISOString(),
  scope: "src/**/*.{css,tsx,jsx}",
  css_file_count: cssFiles.length,
  css_files: cssFiles.map(rel),
  tsx_jsx_file_count: tsxFiles.length,
  raw_hex_total: hexTotal,
  distinct_hex_count: hexCounts.size,
  most_common_hex: mostCommon,
  rgb_literal_count: rgbTotal,
  hsl_literal_count: hslTotal,
  important_count: importantTotal,
  inline_style_file_count: inlineStyleFiles,
  inline_style_files: inlineStyleFileList,
  arbitrary_tailwind_color_count: arbitraryColor,
  arbitrary_font_size_count: arbitraryFont,
  arbitrary_spacing_count: arbitrarySpace,
  unique_border_radii: [...radiusSet].sort(),
  unique_border_radii_count: radiusSet.size,
  unique_box_shadows: [...shadowSet].sort(),
  unique_box_shadows_count: shadowSet.size,
  unique_z_index_values: [...zSet].map(Number).sort((a, b) => a - b),
  unique_z_index_count: zSet.size,
  legacy_green_pattern_hits: legacyGreenHits,
  tally_green_css_consumers: tallyGreenConsumers,
  black_border_or_pure_black_hits: blackBorderHits,
  typography: {
    text_below_12px: textBelow12,
    text_9px: textExact[9],
    text_10px: textExact[10],
    text_11px: textExact[11],
    text_12px: textExact[12],
    text_13px: textExact[13],
    text_14px: textExact[14],
    font_size_distribution_px: Object.fromEntries(
      Object.entries(fontSizeDist)
        .map(([k, v]) => [k, v])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ),
    uppercase_class_count: uppercaseCount,
    font_mono_or_tabular_hits: monoCount,
    tabular_nums_count: tabularCount,
  },
  controls: {
    h_class_below_32px: controlsBelow32,
    h_class_below_36px: controlsBelow36,
    h_class_below_44px_touch: touchBelow44,
    note: "Counts Tailwind h-* / h-[Npx] utility occurrences, not unique components",
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "UI_STYLE_METRICS.json"), JSON.stringify(metrics, null, 2));
fs.writeFileSync(
  path.join(OUT_DIR, "UI_TYPOGRAPHY_DENSITY_METRICS.json"),
  JSON.stringify(
    {
      generated_at: metrics.generated_at,
      typography: metrics.typography,
      controls: metrics.controls,
      black_border_or_pure_black_hits: metrics.black_border_or_pure_black_hits,
      legacy_green_pattern_hits: metrics.legacy_green_pattern_hits,
    },
    null,
    2,
  ),
);

const styleAuditMd = `# UI Style Audit

Generated: ${metrics.generated_at}

## Styling systems found

| System | Path | Classification |
|--------|------|----------------|
| Tailwind v4 (CSS-first) | \`@import "tailwindcss"\` in styles.css + \`@tailwindcss/vite\` | **Active modern** |
| Design tokens | \`src/styles/design-tokens.css\` (\`--ox-*\`) | **Active modern** |
| Global ERP styles | \`src/styles.css\` | **Active** (tokens + legacy overrides) |
| Legacy Tally green | \`src/styles/tally-green.css\` | **Legacy / partial** — consumers: ${tallyGreenConsumers.join(", ") || "none found via import"} |
| Inline React styles | ${inlineStyleFiles} TSX/JSX files | **Active debt** |
| Arbitrary Tailwind colours | ${arbitraryColor} occurrences | **Active debt** |
| Page-local style objects | see inline list | **Active debt** |

## Quantitative metrics

| Metric | Count |
|--------|------:|
| CSS files under src/ | ${metrics.css_file_count} |
| TSX/JSX files | ${metrics.tsx_jsx_file_count} |
| Raw hex literals (total) | ${metrics.raw_hex_total} |
| Distinct hex colours | ${metrics.distinct_hex_count} |
| rgb/rgba literals | ${metrics.rgb_literal_count} |
| hsl/hsla literals | ${metrics.hsl_literal_count} |
| \`!important\` declarations | ${metrics.important_count} |
| Files with inline styles | ${metrics.inline_style_file_count} |
| Arbitrary Tailwind colour values | ${metrics.arbitrary_tailwind_color_count} |
| Arbitrary font sizes | ${metrics.arbitrary_font_size_count} |
| Arbitrary spacing values | ${metrics.arbitrary_spacing_count} |
| Unique border-radius tokens/values | ${metrics.unique_border_radii_count} |
| Unique box-shadow tokens/values | ${metrics.unique_box_shadows_count} |
| Unique z-index values | ${metrics.unique_z_index_count} |
| Legacy green pattern hits | ${metrics.legacy_green_pattern_hits} |
| Black border / pure black hits | ${metrics.black_border_or_pure_black_hits} |

## Most common hex colours

| Colour | Occurrences |
|--------|------------:|
${mostCommon.map((c) => `| \`${c.color}\` | ${c.count} |`).join("\n")}

## Modern vs legacy token conflict

- **Modern tokens**: \`--ox-*\` in \`design-tokens.css\` (primary \`#1557b0\`, sidebar dark, light/dark \`[data-theme]\`).
- **AGENTS.md tokens**: documented as CSS vars in \`styles.css\` / Tailwind arbitrary values matching brand colours.
- **Legacy**: \`tally-green.css\` pale-green accounting aesthetic; black borders; dense 9–11px type.
- **Global override risk**: \`styles.css\` still contains large global selectors and \`!important\` that can override token-based components on feature pages.
- **Dark mode blockers**: raw hex / light-only backgrounds in inline styles and arbitrary Tailwind classes that ignore \`[data-theme]\`.
- **Dummy-accounting appearance drivers**: small typography (\`<12px\` = ${textBelow12}), pale greens, black borders, dense tables, BusyShell flat controls.
- **Cannot safely delete yet**: \`styles.css\` global rules, \`tally-green.css\` (still imported), BusyShell primitives used by forms, legacy page-local style objects — consumers must be migrated first.

## Typography snapshot

See \`UI_TYPOGRAPHY_DENSITY_METRICS.json\`.

| Size | Occurrences (\`text-[Npx]\`) |
|------|----------------------------:|
| <12px | ${textBelow12} |
| 9px | ${textExact[9]} |
| 10px | ${textExact[10]} |
| 11px | ${textExact[11]} |
| 12px | ${textExact[12]} |
| 13px | ${textExact[13]} |
| 14px | ${textExact[14]} |

## Control density

| Pattern | Count |
|---------|------:|
| h-* / h-[px] below 32px | ${controlsBelow32} |
| below 36px | ${controlsBelow36} |
| below 44px (touch) | ${touchBelow44} |

## Do not delete

Legacy styling is inventoried only. No CSS files were removed in Phase UI-0.
`;

fs.writeFileSync(path.join(OUT_DIR, "UI_STYLE_AUDIT.md"), styleAuditMd);
console.log(
  `Style metrics: hex=${hexTotal} distinct=${hexCounts.size} important=${importantTotal} inlineFiles=${inlineStyleFiles}`,
);
