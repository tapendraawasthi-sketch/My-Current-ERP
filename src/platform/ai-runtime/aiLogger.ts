type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, event: string, data?: Record<string, unknown>): void {
  const entry = { level, event, timestamp: new Date().toISOString(), ...data };
  if (level === "error") console.error("[ai-runtime]", entry);
  else if (level === "warn") console.warn("[ai-runtime]", entry);
  else if (import.meta.env?.DEV) console.debug("[ai-runtime]", entry);
}

export const aiLogger = {
  debug: (event: string, data?: Record<string, unknown>) => log("debug", event, data),
  info: (event: string, data?: Record<string, unknown>) => log("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => log("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => log("error", event, data),
};
