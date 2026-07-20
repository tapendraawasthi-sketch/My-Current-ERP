/**
 * Incremental URL routing — page-id (+ optional entity) ↔ path helpers.
 *
 * Paths:
 *   /app/:pageId
 *   /app/:pageId/:entityId   (e.g. /app/billing/inv-123, /app/parties/p-1, /app/billing/new)
 */

export const APP_BASE = "/app";

export type AppRouteParts = {
  pageId: string;
  entityId?: string;
};

/** Known aliases (optional nicer URLs). */
const ALIASES: Record<string, string> = {
  dashboard: "/app/dashboard",
  "financial-dashboard": "/app/dashboard",
  gateway: "/app/dashboard",
};

const ALIAS_PATH_TO_PAGE: Record<string, string> = {
  "/app": "dashboard",
  "/app/": "dashboard",
  "/app/dashboard": "dashboard",
  "/": "dashboard",
};

export function pageIdToPath(pageId: string, entityId?: string | null): string {
  const id = (pageId || "dashboard").trim();
  if (!entityId && ALIASES[id]) return ALIASES[id];
  const base = `${APP_BASE}/${encodeURIComponent(id)}`;
  if (!entityId) return base;
  return `${base}/${encodeURIComponent(entityId)}`;
}

export function pathToPageId(pathname: string): string | null {
  return parseAppPath(pathname)?.pageId ?? null;
}

export function parseAppPath(pathname: string): AppRouteParts | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (ALIAS_PATH_TO_PAGE[path] || ALIAS_PATH_TO_PAGE[pathname]) {
    return { pageId: ALIAS_PATH_TO_PAGE[path] ?? ALIAS_PATH_TO_PAGE[pathname] };
  }
  if (!path.startsWith(`${APP_BASE}/`)) return null;
  const rest = path.slice(APP_BASE.length + 1);
  if (!rest) return { pageId: "dashboard" };
  const [rawPage, rawEntity, ...extra] = rest.split("/");
  if (!rawPage) return { pageId: "dashboard" };
  let pageId: string;
  try {
    pageId = decodeURIComponent(rawPage);
  } catch {
    pageId = rawPage;
  }
  if (!rawEntity) return { pageId };
  let entityId: string;
  try {
    entityId = decodeURIComponent(rawEntity);
  } catch {
    entityId = rawEntity;
  }
  // Ignore deeper segments for now (reserved for nested routes)
  void extra;
  return { pageId, entityId };
}
