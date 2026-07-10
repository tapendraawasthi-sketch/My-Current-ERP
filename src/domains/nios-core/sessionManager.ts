import { updateKernelCounters } from "./niosKernel";

export interface NiosSession {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  turnCount: number;
  tenantId?: string;
  userId?: string;
}

const sessions = new Map<string, NiosSession>();

export function getOrCreateSession(sessionId: string): NiosSession {
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.lastActiveAt = new Date().toISOString();
    existing.turnCount += 1;
    sessions.set(sessionId, existing);
    return existing;
  }

  const session: NiosSession = {
    id: sessionId,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    turnCount: 1,
  };
  sessions.set(sessionId, session);
  updateKernelCounters({ activeSessions: sessions.size });
  return session;
}

export function getSession(sessionId: string): NiosSession | null {
  return sessions.get(sessionId) ?? null;
}

export function listSessions(): NiosSession[] {
  return Array.from(sessions.values());
}

export function endSession(sessionId: string): void {
  sessions.delete(sessionId);
  updateKernelCounters({ activeSessions: sessions.size });
}

export function clearExpiredSessions(maxAgeMs = 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - maxAgeMs;
  let cleared = 0;
  for (const [id, session] of sessions) {
    if (new Date(session.lastActiveAt).getTime() < cutoff) {
      sessions.delete(id);
      cleared += 1;
    }
  }
  updateKernelCounters({ activeSessions: sessions.size });
  return cleared;
}
