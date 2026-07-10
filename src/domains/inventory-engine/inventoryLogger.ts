type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry = { level, message, context, timestamp: new Date().toISOString() };
  if (level === "error") {
    console.error("[inventory-engine]", entry);
    return;
  }
  if (level === "warn") {
    console.warn("[inventory-engine]", entry);
    return;
  }
  if (import.meta.env?.DEV) {
    console.debug("[inventory-engine]", entry);
  }
}

export const inventoryLogger = {
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
