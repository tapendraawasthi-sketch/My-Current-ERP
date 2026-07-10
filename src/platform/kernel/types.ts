/** Shared kernel value types — no store or Dexie imports. */

export type EntityId = string;

export type JsonObject = Record<string, unknown>;

export type DomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code?: string };

export interface PaginationQuery {
  offset?: number;
  limit?: number;
}

export interface DateRangeQuery {
  fromDate?: string;
  toDate?: string;
}
