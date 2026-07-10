import { create } from "zustand";

export type NiosShellTab = "chat" | "state" | "tasks" | "ocr" | "bench";

export interface NiosMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  confidence?: number;
  engine?: string;
  timestamp: Date;
}

interface NiosStore {
  isOpen: boolean;
  activeTab: NiosShellTab;
  messages: NiosMessage[];
  loading: boolean;
  worldStateSummary: Record<string, unknown> | null;
  tasks: Array<{ id: string; title: string; status: string }>;
  benchmarkResult: Record<string, unknown> | null;
  ocrDraft: Record<string, unknown> | null;
  togglePanel: () => void;
  setTab: (tab: NiosShellTab) => void;
  addMessage: (msg: NiosMessage) => void;
  setLoading: (v: boolean) => void;
  setWorldStateSummary: (s: Record<string, unknown> | null) => void;
  setTasks: (tasks: Array<{ id: string; title: string; status: string }>) => void;
  setBenchmarkResult: (r: Record<string, unknown> | null) => void;
  setOcrDraft: (d: Record<string, unknown> | null) => void;
  clearMessages: () => void;
}

export const useNiosStore = create<NiosStore>((set) => ({
  isOpen: false,
  activeTab: "chat",
  messages: [],
  loading: false,
  worldStateSummary: null,
  tasks: [],
  benchmarkResult: null,
  ocrDraft: null,
  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  setTab: (tab) => set({ activeTab: tab }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setLoading: (loading) => set({ loading }),
  setWorldStateSummary: (worldStateSummary) => set({ worldStateSummary }),
  setTasks: (tasks) => set({ tasks }),
  setBenchmarkResult: (benchmarkResult) => set({ benchmarkResult }),
  setOcrDraft: (ocrDraft) => set({ ocrDraft }),
  clearMessages: () => set({ messages: [] }),
}));
