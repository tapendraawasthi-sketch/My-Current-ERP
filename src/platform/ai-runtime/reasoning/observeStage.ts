import type { ObserveInput, ObserveOutput } from "../contracts/intelligenceContract";
import { createImmutable } from "../types/immutable";
import { buildConversationContext } from "../conversation/conversationContext";

export async function runObserveStage(input: ObserveInput): Promise<ObserveOutput> {
  const { request } = input;
  buildConversationContext(request);

  return createImmutable({
    requestId: request.requestId,
    sessionId: request.sessionId,
    rawInput: request.input.trim(),
    channel: (request.context?.channel as ObserveOutput["channel"]) ?? "chat",
    metadata: {
      userId: request.userId,
      tenantId: request.tenantId,
      correlationId: request.correlationId,
      ...(request.context ?? {}),
    },
    timestamp: new Date().toISOString(),
  });
}
