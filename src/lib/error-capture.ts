// src/lib/error-capture.ts
export function captureError(error: Error, context?: Record<string, any>): void {
  console.error("[Sutra ERP Error]", error.message, context || "");
  // In production, send to error monitoring service
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    // Add production error reporting here if needed
  }
}

export function captureMessage(message: string, level: "info" | "warn" | "error" = "info"): void {
  console[level]("[Sutra ERP]", message);
}
