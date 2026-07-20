import { create } from "zustand";

export type NavCrumb = {
  /** Page id for navigation (empty = non-navigable label) */
  page: string;
  label: string;
  entityId?: string;
};

type NavCrumbState = {
  stack: NavCrumb[];
  /** Replace the full stack (e.g. when switching primary page). */
  reset: (crumbs: NavCrumb[]) => void;
  /** Push a drill-down level (Party → Ledger). Dedupes identical tops. */
  push: (crumb: NavCrumb) => void;
  /** Pop back to index (inclusive) — used by breadcrumb clicks. */
  popTo: (index: number) => void;
  clear: () => void;
};

export const useNavCrumbStore = create<NavCrumbState>((set, get) => ({
  stack: [],
  reset: (crumbs) => set({ stack: crumbs }),
  push: (crumb) => {
    const stack = get().stack;
    const top = stack[stack.length - 1];
    if (
      top &&
      top.page === crumb.page &&
      top.entityId === crumb.entityId &&
      top.label === crumb.label
    ) {
      return;
    }
    set({ stack: [...stack, crumb] });
  },
  popTo: (index) => {
    const stack = get().stack;
    if (index < 0 || index >= stack.length) return;
    set({ stack: stack.slice(0, index + 1) });
  },
  clear: () => set({ stack: [] }),
}));

/** Convenience for pages that drill into an entity detail. */
export function pushDrillCrumb(crumb: NavCrumb) {
  useNavCrumbStore.getState().push(crumb);
}
