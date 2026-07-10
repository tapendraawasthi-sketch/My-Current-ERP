type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry = { level, message, context, timestamp: new Date().toISOString() };
  if (level === "error") console.error("[ai-proposal]", entry);
  else if (level === "warn") console.warn("[ai-proposal]", entry);
  else if (import.meta.env?.DEV) console.debug("[ai-proposal]", entry);
}

export const proposalLogger = {
  debug(m: string, c?: Record<string, unknown>): void {
    emit("debug", m, c);
  },
  info(m: string, c?: Record<string, unknown>): void {
    emit("info", m, c);
  },
  warn(m: string, c?: Record<string, unknown>): void {
    emit("warn", m, c);
  },
  error(m: string, c?: Record<string, unknown>): void {
    emit("error", m, c);
  },
};
