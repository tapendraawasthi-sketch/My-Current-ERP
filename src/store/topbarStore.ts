import { create } from "zustand";

export type TopbarMenuKey =
  | "company"
  | "data"
  | "exchange"
  | "import"
  | "export"
  | "share"
  | "print"
  | "help";

export interface TopbarActiveCompany {
  id: string;
  name: string;
  fiscalYear: string;
  pan: string;
}

export interface TopbarCurrentUser {
  id: string;
  username: string;
  role: string;
  permissions: Record<string, string[]>;
}

interface TopbarState {
  openMenu: TopbarMenuKey | null;
  goToOpen: boolean;
  switchToOpen: boolean;
  activeCompany: TopbarActiveCompany | null;
  currentUser: TopbarCurrentUser | null;
  hasUnsavedChanges: boolean;

  setOpenMenu: (menu: TopbarMenuKey | null) => void;
  setGoToOpen: (open: boolean) => void;
  setSwitchToOpen: (open: boolean) => void;
  setActiveCompany: (company: TopbarActiveCompany | null) => void;
  setCurrentUser: (user: TopbarCurrentUser | null) => void;
  setHasUnsavedChanges: (value: boolean) => void;
}

export const useTopbarStore = create<TopbarState>((set) => ({
  openMenu: null,
  goToOpen: false,
  switchToOpen: false,
  activeCompany: null,
  currentUser: null,
  hasUnsavedChanges: false,

  setOpenMenu: (menu) => set({ openMenu: menu }),
  setGoToOpen: (open) => set({ goToOpen: open }),
  setSwitchToOpen: (open) => set({ switchToOpen: open }),
  setActiveCompany: (company) => set({ activeCompany: company }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setHasUnsavedChanges: (value) => set({ hasUnsavedChanges: value }),
}));
