/** Frontend-only Orbix session metadata (durable memory lives server-side). */

export interface LocalOrbixSessionState {
  sessionId: string;
  lastRoute?: string;
  lastScreenTitle?: string;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
}

const KEY = "orbix_session_state_v1";
const MAX_RECENT = 12;

export function getOrCreateOrbixSession(): LocalOrbixSessionState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalOrbixSessionState;
      if (parsed.sessionId) return parsed;
    }
  } catch {
    /* ignore corrupt state */
  }
  const fresh: LocalOrbixSessionState = {
    sessionId: crypto.randomUUID(),
    recentMessages: [],
  };
  persist(fresh);
  return fresh;
}

export function updateOrbixSession(
  patch: Partial<LocalOrbixSessionState>,
): LocalOrbixSessionState {
  const current = getOrCreateOrbixSession();
  const next: LocalOrbixSessionState = { ...current, ...patch };
  if (patch.recentMessages) {
    next.recentMessages = patch.recentMessages.slice(-MAX_RECENT);
  }
  persist(next);
  return next;
}

export function appendOrbixMessage(role: "user" | "assistant", content: string): void {
  const current = getOrCreateOrbixSession();
  const recent = [...current.recentMessages, { role, content }].slice(-MAX_RECENT);
  updateOrbixSession({ recentMessages: recent });
}

export function resetOrbixSession(): LocalOrbixSessionState {
  const fresh: LocalOrbixSessionState = {
    sessionId: crypto.randomUUID(),
    recentMessages: [],
  };
  persist(fresh);
  return fresh;
}

function persist(state: LocalOrbixSessionState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / unavailable */
  }
}
