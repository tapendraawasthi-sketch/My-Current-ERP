import { ReportPolicies } from "./reportPolicies";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function cacheKey(reportType: string, params: Record<string, unknown>): string {
  return `${reportType}:${JSON.stringify(params)}`;
}

export function getCachedReport<T>(reportType: string, params: Record<string, unknown>): T | null {
  const key = cacheKey(reportType, params);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCachedReport<T>(
  reportType: string,
  params: Record<string, unknown>,
  data: T,
): void {
  const key = cacheKey(reportType, params);
  cache.set(key, {
    data,
    expiresAt: Date.now() + ReportPolicies.cacheTtlMs,
  });
}

export function clearReportCache(): void {
  cache.clear();
}

export function invalidateReportCache(reportType?: string): void {
  if (!reportType) {
    clearReportCache();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${reportType}:`)) cache.delete(key);
  }
}
