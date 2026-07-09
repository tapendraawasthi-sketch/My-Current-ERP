/** SUTRA AI — cross-session conversation memory (IndexedDB) */

import type { SessionSnapshot } from "../types";
import type { ContextManager } from "../core/ContextManager";
import { userProfileManager } from "../knowledge/UserProfileManager";
import { sutraAiDb } from "./SutraAiDexie";

const MAX_UI_MESSAGES = 40;

export class SessionMemoryStore {
  async save(
    context: ContextManager,
    uiMessages?: SessionSnapshot["uiMessages"],
  ): Promise<void> {
    const userId = userProfileManager.getUserId();
    const snapshot = context.exportSnapshot(userId, uiMessages);
    await sutraAiDb.sessions.put({
      userId,
      snapshot,
      updatedAt: Date.now(),
    });
  }

  async load(userId?: string): Promise<SessionSnapshot | null> {
    const id = userId ?? userProfileManager.getUserId();
    const row = await sutraAiDb.sessions.get(id);
    return row?.snapshot ?? null;
  }

  async clear(userId?: string): Promise<void> {
    const id = userId ?? userProfileManager.getUserId();
    await sutraAiDb.sessions.delete(id);
  }

  trimUiMessages(
    messages: SessionSnapshot["uiMessages"],
  ): SessionSnapshot["uiMessages"] {
    if (!messages?.length) return messages;
    return messages.slice(-MAX_UI_MESSAGES);
  }
}

export const sessionMemoryStore = new SessionMemoryStore();

export function applySnapshotToContext(
  context: ContextManager,
  snapshot: SessionSnapshot,
): void {
  context.restoreSnapshot({
    turns: snapshot.turns,
    session: snapshot.session,
    domainContext: snapshot.domainContext,
  });
}

export function buildUiMessagesFromSnapshot(
  snapshot: SessionSnapshot,
  welcomeText: string,
): Array<{ id: string; role: "user" | "assistant"; text: string; timestamp: Date }> {
  const stored = snapshot.uiMessages;
  if (!stored?.length) {
    return snapshot.turns.map((t, i) => ({
      id: `restored-${i}`,
      role: t.role,
      text: t.content,
      timestamp: new Date(t.timestamp),
    }));
  }
  return [
    { id: "welcome", role: "assistant" as const, text: welcomeText, timestamp: new Date() },
    ...stored.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      timestamp: new Date(m.timestamp),
    })),
  ];
}
