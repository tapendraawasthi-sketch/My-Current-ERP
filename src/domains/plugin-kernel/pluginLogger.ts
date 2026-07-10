type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry = { level, message, context, timestamp: new Date().toISOString() };
  if (level === "error") console.error("[plugin-kernel]", entry);
  else if (level === "warn") console.warn("[plugin-kernel]", entry);
  else if (import.meta.env?.DEV) console.debug("[plugin-kernel]", entry);
}

export const pluginLogger = {
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
