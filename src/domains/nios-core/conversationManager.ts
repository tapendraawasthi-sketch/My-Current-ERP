export interface ConversationTurn {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

const conversations = new Map<string, ConversationTurn[]>();

export function appendConversationTurn(
  sessionId: string,
  role: ConversationTurn["role"],
  content: string,
): void {
  const turns = conversations.get(sessionId) ?? [];
  turns.push({ role, content, timestamp: new Date().toISOString() });
  conversations.set(sessionId, turns);
}

export function getConversationHistory(sessionId: string): ConversationTurn[] {
  return [...(conversations.get(sessionId) ?? [])];
}

export function clearConversation(sessionId: string): void {
  conversations.delete(sessionId);
}

export function getConversationSummary(sessionId: string): string {
  const turns = getConversationHistory(sessionId);
  return turns.map((t) => `${t.role}: ${t.content}`).join("\n");
}
