export interface AiDiagnosticEntry {
  requestId: string;
  sessionId: string;
  stage: string;
  message?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const diagnostics: AiDiagnosticEntry[] = [];
const MAX_DIAGNOSTICS = 500;

export function recordAiDiagnostic(entry: AiDiagnosticEntry): void {
  diagnostics.push(entry);
  if (diagnostics.length > MAX_DIAGNOSTICS) {
    diagnostics.splice(0, diagnostics.length - MAX_DIAGNOSTICS);
  }
}

export function listAiDiagnostics(sessionId?: string): readonly AiDiagnosticEntry[] {
  return sessionId ? diagnostics.filter((d) => d.sessionId === sessionId) : [...diagnostics];
}

export function clearAiDiagnostics(): void {
  diagnostics.length = 0;
}
