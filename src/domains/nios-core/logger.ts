type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry = { level, message, context, timestamp: new Date().toISOString() };
  if (level === "error") {
    console.error("[nios-core]", entry);
    return;
  }
  if (level === "warn") {
    console.warn("[nios-core]", entry);
    return;
  }
  if (import.meta.env?.DEV) {
    console.debug("[nios-core]", entry);
  }
}

export const niosLogger = {
  debug(message: string, context?: Record<string, unknown>): void {
    emit("debug", message, context);
  },
  info(message: string, context?: Record<string, unknown>): void {
    emit("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    emit("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>): void {
    emit("error", message, context);
  },
};
