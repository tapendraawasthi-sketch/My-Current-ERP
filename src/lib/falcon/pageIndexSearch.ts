/** Search the build-time page index (from App.tsx routes + page headers). */

import { GENERATED_PAGE_INDEX, type GeneratedPageEntry } from "./generatedPageIndex";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function scoreEntry(entry: GeneratedPageEntry, queryTokens: string[]): number {
  const haystack = [
    entry.route,
    ...entry.aliases,
    entry.component,
    entry.title,
    entry.subtitle,
    entry.menuPath,
    entry.file,
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 2;
  }

  // Boost exact phrase hits in title/menu
  const q = queryTokens.join(" ");
  if (entry.title.toLowerCase().includes(q)) score += 8;
  if (entry.menuPath.toLowerCase().includes(q)) score += 6;
  for (const alias of entry.aliases) {
    if (q.includes(alias.replace(/-/g, " ")) || alias.replace(/-/g, " ").includes(q)) {
      score += 5;
    }
  }

  return score;
}

export function findPagesByQuery(query: string, limit = 3): GeneratedPageEntry[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  return GENERATED_PAGE_INDEX.map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.entry);
}

export function findPageByRoute(route?: string): GeneratedPageEntry | undefined {
  if (!route) return undefined;
  const normalized = route.toLowerCase().replace(/\//g, "");
  return GENERATED_PAGE_INDEX.find(
    (e) =>
      e.route === normalized ||
      e.aliases.includes(normalized) ||
      e.route.includes(normalized) ||
      normalized.includes(e.route),
  );
}

export function formatPageAnswer(entry: GeneratedPageEntry): string {
  const nav = entry.menuPath || `Route: ${entry.route}`;
  const lines = [
    `**${entry.title}**`,
    entry.subtitle ? entry.subtitle.replace(/&amp;/g, "&") : "",
    "",
    `**Where to find it:** ${nav}`,
    `**Component:** \`${entry.component}\` in \`${entry.file}\``,
  ];
  return lines.filter(Boolean).join("\n");
}
