import type { IConversationMemory } from "../contracts/memoryContract";

interface ConversationTurn {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export class ConversationMemory implements IConversationMemory {
  private sessions = new Map<string, ConversationTurn[]>();

  appendTurn(sessionId: string, role: "user" | "assistant" | "system", content: string): void {
    const turns = this.sessions.get(sessionId) ?? [];
    turns.push({ role, content, timestamp: new Date().toISOString() });
    this.sessions.set(sessionId, turns);
  }

  getTurns(sessionId: string, limit = 50): readonly ConversationTurn[] {
    const turns = this.sessions.get(sessionId) ?? [];
    return turns.slice(-limit);
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
