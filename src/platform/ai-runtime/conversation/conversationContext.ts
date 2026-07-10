import type { AiRuntimeRequest } from "../types";
import { getMemoryStore } from "../memory";

export interface ConversationContext {
  readonly sessionId: string;
  readonly userId?: string;
  readonly tenantId?: string;
  readonly turnCount: number;
  readonly recentTurns: readonly { role: string; content: string; timestamp: string }[];
}

export function buildConversationContext(request: AiRuntimeRequest): ConversationContext {
  const memory = getMemoryStore();
  memory.conversation.appendTurn(request.sessionId, "user", request.input);
  const turns = memory.conversation.getTurns(request.sessionId);

  return {
    sessionId: request.sessionId,
    userId: request.userId,
    tenantId: request.tenantId,
    turnCount: turns.length,
    recentTurns: turns,
  };
}

export function recordAssistantTurn(sessionId: string, content: string): void {
  getMemoryStore().conversation.appendTurn(sessionId, "assistant", content);
}
