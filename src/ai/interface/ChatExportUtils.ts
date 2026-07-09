/** SUTRA AI — export chat transcript with optional session summary */

export interface ChatExportMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

export function exportChatAsText(
  messages: ChatExportMessage[],
  sessionSummary?: string | null,
): string {
  const lines = messages
    .filter((m) => m.text.trim())
    .map((m) => {
      const ts = m.timestamp.toISOString().slice(0, 16).replace("T", " ");
      const who = m.role === "user" ? "You" : "SUTRA AI";
      return `[${ts}] ${who}:\n${m.text}`;
    });

  const summaryBlock = sessionSummary?.trim()
    ? `--- Session Summary ---\n${sessionSummary.trim()}\n\n--- Messages ---\n\n`
    : "";

  return `SUTRA AI Chat Export\n${"=".repeat(40)}\n\n${summaryBlock}${lines.join("\n\n")}\n`;
}

export function exportChatAsJson(
  messages: ChatExportMessage[],
  sessionSummary?: string | null,
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: "SUTRA AI",
      sessionSummary: sessionSummary?.trim() || undefined,
      messages: messages.map((m) => ({
        role: m.role,
        text: m.text,
        timestamp: m.timestamp.toISOString(),
      })),
    },
    null,
    2,
  );
}

export function downloadChatExport(
  messages: ChatExportMessage[],
  format: "text" | "json" = "text",
  sessionSummary?: string | null,
): void {
  const content =
    format === "json"
      ? exportChatAsJson(messages, sessionSummary)
      : exportChatAsText(messages, sessionSummary);
  const blob = new Blob([content], {
    type: format === "json" ? "application/json" : "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sutra-ai-chat-${new Date().toISOString().slice(0, 10)}.${format === "json" ? "json" : "txt"}`;
  a.click();
  URL.revokeObjectURL(url);
}
