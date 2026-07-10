import { clearDiagnostics } from "./diagnostics";
import { clearConversation } from "./conversationManager";
import { clearSessionMemory } from "./memoryEngine";
import { endSession, listSessions } from "./sessionManager";
import { initializeRuntime } from "./niosRuntime";
import { recordDiagnostic } from "./diagnostics";
import { niosLogger } from "./logger";

export interface RecoveryResult {
  sessionsCleared: number;
  recovered: boolean;
  message: string;
}

export function recoverNiosCore(): RecoveryResult {
  const sessions = listSessions();
  for (const session of sessions) {
    clearConversation(session.id);
    clearSessionMemory(session.id);
    endSession(session.id);
  }
  clearDiagnostics();
  initializeRuntime();

  recordDiagnostic({
    stage: "recovery",
    message: `recovered ${sessions.length} sessions`,
    timestamp: new Date().toISOString(),
  });
  niosLogger.info("nios-core-recovered", { sessionsCleared: sessions.length });

  return {
    sessionsCleared: sessions.length,
    recovered: true,
    message: "NIOS core recovered",
  };
}
