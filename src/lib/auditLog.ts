export async function logAuditEvent(params: {
  action: string;
  module: string;
  status: "success" | "failed";
  oldValue?: unknown;
  newValue?: unknown;
  errorReason?: string;
}): Promise<void> {
  try {
    await fetch("/api/audit-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...params,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }),
    });
  } catch {
    // Silent fail — audit logging should never block user workflow.
  }
}
