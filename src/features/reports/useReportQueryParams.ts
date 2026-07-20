/**
 * STEP 4.2 — Shareable report state via ?fy=&from=&to=&branch=
 */
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BRANCH_CHANGED_EVENT,
  readBranchViewFilter,
  writeBranchViewFilter,
} from "../../lib/activeBranch";

export type ReportQueryState = {
  fy?: string;
  from?: string;
  to?: string;
  branch?: string;
};

function readParam(sp: URLSearchParams, key: string): string {
  return (sp.get(key) || "").trim();
}

/** Apply branch query to shell view filter (lists/reports). */
export function applyBranchQueryParam(branch: string | undefined) {
  if (!branch) return;
  writeBranchViewFilter(branch);
  window.dispatchEvent(new Event(BRANCH_CHANGED_EVENT));
}

export function useReportQueryParams(defaults?: ReportQueryState) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<ReportQueryState>(() => {
    const fromUrl: ReportQueryState = {
      fy: readParam(searchParams, "fy") || undefined,
      from: readParam(searchParams, "from") || undefined,
      to: readParam(searchParams, "to") || undefined,
      branch: readParam(searchParams, "branch") || undefined,
    };
    return {
      fy: fromUrl.fy || defaults?.fy,
      from: fromUrl.from || defaults?.from,
      to: fromUrl.to || defaults?.to,
      branch: fromUrl.branch || defaults?.branch || readBranchViewFilter() || undefined,
    };
  }, [searchParams, defaults?.fy, defaults?.from, defaults?.to, defaults?.branch]);

  const writeParams = useCallback(
    (next: ReportQueryState) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          const entries: Array<[keyof ReportQueryState, string | undefined]> = [
            ["fy", next.fy],
            ["from", next.from],
            ["to", next.to],
            ["branch", next.branch],
          ];
          for (const [key, value] of entries) {
            if (value) p.set(key, value);
            else p.delete(key);
          }
          return p;
        },
        { replace: true },
      );
      if (next.branch) applyBranchQueryParam(next.branch);
    },
    [setSearchParams],
  );

  return { params, writeParams, searchParams };
}
