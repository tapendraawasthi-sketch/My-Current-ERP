import { useCallback, useEffect, useState } from "react";

export interface RecentActivityItem {
  label: string;
  page: string;
  timestamp: string;
}

const STORAGE_KEY = "sutra_recent_activity";

const safeRead = (): RecentActivityItem[] => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.label === "string" &&
          typeof item.page === "string" &&
          typeof item.timestamp === "string",
      )
      .slice(0, 20);
  } catch {
    return [];
  }
};

const safeWrite = (items: RecentActivityItem[]) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 20)));
  } catch {
    // localStorage can be unavailable in private/sandboxed contexts.
  }
};

export function useRecentActivity(): {
  recentActivity: RecentActivityItem[];
  pushActivity: (label: string, page: string) => void;
  clearActivity: () => void;
} {
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>(() => safeRead());

  useEffect(() => {
    setRecentActivity(safeRead());
  }, []);

  const pushActivity = useCallback((label: string, page: string) => {
    setRecentActivity(() => {
      const existing = safeRead().filter((item) => item.page !== page);
      const next = [
        {
          label,
          page,
          timestamp: new Date().toISOString(),
        },
        ...existing,
      ].slice(0, 20);

      safeWrite(next);
      return next;
    });
  }, []);

  const clearActivity = useCallback(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    setRecentActivity([]);
  }, []);

  return {
    recentActivity,
    pushActivity,
    clearActivity,
  };
}
