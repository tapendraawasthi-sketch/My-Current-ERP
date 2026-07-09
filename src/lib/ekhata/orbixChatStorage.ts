import type { EKhataChatMessage } from "./types";

export const ORBIX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSIONS_KEY = "orbix-chat-sessions-v1";
const ACTIVE_KEY = "orbix-active-session-v1";
const WINDOW_KEY = "orbix-window-mode-v1";

export type OrbixWindowMode = "normal" | "minimized" | "maximized";

export interface StoredOrbixMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  report?: import("./orbixReportTypes").OrbixReportPayload;
  reportClarify?: import("./orbixReportTypes").PendingOrbixReport;
}

export interface OrbixChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredOrbixMessage[];
  llmSessionId?: string;
}

export function serializeMessage(m: EKhataChatMessage): StoredOrbixMessage {
  return {
    id: m.id,
    role: m.role,
    text: m.text,
    timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
    report: m.report,
    reportClarify: m.reportClarify,
  };
}

export function deserializeMessage(m: StoredOrbixMessage): EKhataChatMessage {
  return {
    id: m.id,
    role: m.role,
    text: m.text,
    timestamp: new Date(m.timestamp),
    report: m.report,
    reportClarify: m.reportClarify,
  };
}

function genSessionId(): string {
  return `orbix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptySession(): OrbixChatSession {
  const now = new Date().toISOString();
  return {
    id: genSessionId(),
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: [],
    llmSessionId: crypto.randomUUID(),
  };
}

export function deriveSessionTitle(messages: EKhataChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.text.trim());
  if (!firstUser) return "New chat";
  const t = firstUser.text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}

function purgeExpired(sessions: OrbixChatSession[]): OrbixChatSession[] {
  const cutoff = Date.now() - ORBIX_RETENTION_MS;
  return sessions.filter((s) => new Date(s.updatedAt).getTime() >= cutoff);
}

export function loadOrbixSessions(): {
  sessions: OrbixChatSession[];
  activeSessionId: string;
  windowMode: OrbixWindowMode;
} {
  let sessions: OrbixChatSession[] = [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) sessions = purgeExpired(JSON.parse(raw) as OrbixChatSession[]);
  } catch {
    sessions = [];
  }

  if (sessions.length === 0) {
    const fresh = createEmptySession();
    sessions = [fresh];
  }

  let activeSessionId = localStorage.getItem(ACTIVE_KEY) ?? "";
  if (!sessions.some((s) => s.id === activeSessionId)) {
    activeSessionId = sessions[0].id;
  }

  let windowMode: OrbixWindowMode = "normal";
  try {
    const wm = localStorage.getItem(WINDOW_KEY);
    if (wm === "normal" || wm === "minimized" || wm === "maximized") windowMode = wm;
  } catch {
    /* ignore */
  }

  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  localStorage.setItem(ACTIVE_KEY, activeSessionId);

  return { sessions, activeSessionId, windowMode };
}

export function saveOrbixSessions(
  sessions: OrbixChatSession[],
  activeSessionId: string,
  windowMode?: OrbixWindowMode,
): void {
  const purged = purgeExpired(
    sessions.filter((s) => s.id === activeSessionId || s.messages.length > 0),
  );
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(purged));
  localStorage.setItem(ACTIVE_KEY, activeSessionId);
  if (windowMode) localStorage.setItem(WINDOW_KEY, windowMode);
}

export function groupSessionsByDate(sessions: OrbixChatSession[]): {
  label: string;
  sessions: OrbixChatSession[];
}[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

  const groups: Record<string, OrbixChatSession[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
  };

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  for (const session of sorted) {
    if (session.messages.length === 0 && session.title === "New chat") continue;
    const d = new Date(session.updatedAt);
    if (d >= startOfToday) groups.Today.push(session);
    else if (d >= startOfYesterday) groups.Yesterday.push(session);
    else groups["Previous 7 days"].push(session);
  }

  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, sessions: list }));
}

export function formatSessionTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
