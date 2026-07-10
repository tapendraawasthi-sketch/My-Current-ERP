import type { NiosRequest } from "./niosKernel";
import type { NiosSession } from "./sessionManager";
import { getPrompt } from "./promptRegistry";
import { retrieveContext } from "./retrievalEngine";
import { getMemorySnapshot } from "./memoryEngine";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export interface UnifiedContext {
  sessionId: string;
  systemPrompt: string;
  message: string;
  retrieved: Array<{ source: string; content: string; score: number }>;
  memory: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export async function buildContext(
  request: NiosRequest,
  session: NiosSession,
): Promise<UnifiedContext> {
  const systemPrompt = getPrompt("system-default")?.template ?? "";
  const retrieved = isMigrationFlagEnabled("MIGRATION_NIOS_MEMORY")
    ? await retrieveContext(request.message, session.id)
    : [];
  const memory = isMigrationFlagEnabled("MIGRATION_NIOS_MEMORY")
    ? getMemorySnapshot(session.id)
    : {};

  return {
    sessionId: session.id,
    systemPrompt,
    message: request.message,
    retrieved,
    memory,
    metadata: {
      channel: request.channel ?? "chat",
      tenantId: request.tenantId,
      userId: request.userId,
      turnCount: session.turnCount,
      ...request.context,
    },
  };
}
