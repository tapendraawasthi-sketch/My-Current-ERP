export interface RecentActivityItem {
  label: string;
  page: string;
  timestamp: string;
}

const KEY = "sutra_recent_activity";

const readRecentActivity = (): RecentActivityItem[] => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.label === "string" && typeof item.page === "string");
  } catch {
    return [];
  }
};

const writeRecentActivity = (items: RecentActivityItem[]) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, 20)));
  } catch {
    // localStorage may be unavailable in private/sandboxed contexts.
  }
};

export function useRecentActivity(): {
  recentActivity: RecentActivityItem[];
  pushActivity: (label: string, page: string) => void;
  clearActivity: () => void;
} {
  const recentActivity = readRecentActivity();

  const pushActivity = (label: string, page: string) => {
    try {
      const existing = readRecentActivity().filter((item) => item.page !== page);
      const next = [
        {
          label,
          page,
          timestamp: new Date().toISOString(),
        },
        ...existing,
      ].slice(0, 20);

      writeRecentActivity(next);
    } catch {
      // never crash navigation because recent activity failed
    }
  };

  const clearActivity = () => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  };

  return {
    recentActivity,
    pushActivity,
    clearActivity,
  };
}
