/**
 * App toast API — drop-in replacement for react-hot-toast.
 * Backed by design-system ToastProvider imperative bridge.
 */
import type { ReactNode } from "react";
import { getToastBridge } from "@/design-system/primitives/Feedback/Patterns";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

function asMessage(input: unknown): string {
  if (typeof input === "string") return input.replace(/^[✓⚠✅❌]\s*/, "");
  if (input instanceof Error) return input.message;
  if (input && typeof input === "object" && "message" in input) {
    return String((input as { message: unknown }).message);
  }
  return String(input ?? "");
}

function push(title: string, tone: Tone): string {
  const api = getToastBridge();
  if (!api) {
    if (typeof console !== "undefined") console.warn("[toast]", tone, title);
    return "";
  }
  return api.push({ title, tone });
}

type CustomToastArg = { id: string; visible: boolean };

export const toast = {
  success(message: unknown, _opts?: unknown): string {
    return push(asMessage(message), "success");
  },
  error(message: unknown, _opts?: unknown): string {
    return push(asMessage(message), "danger");
  },
  loading(message: unknown, _opts?: unknown): string {
    return push(asMessage(message), "info");
  },
  dismiss(id?: string): void {
    getToastBridge()?.dismiss(id);
  },
  /**
   * Success toast with an Undo action (5s window via ToastProvider).
   * Prefer for soft-delete / reversible post flows.
   */
  undo(
    message: unknown,
    onUndo: () => void,
    opts?: { actionLabel?: string; description?: string },
  ): string {
    const api = getToastBridge();
    if (!api) {
      if (typeof console !== "undefined") console.warn("[toast] undo", asMessage(message));
      return "";
    }
    const id = api.push({
      title: asMessage(message),
      description: opts?.description,
      tone: "success",
      actionLabel: opts?.actionLabel ?? "Undo",
      onAction: () => {
        onUndo();
        api.dismiss(id);
      },
    });
    return id;
  },
  custom(
    renderer: (t: CustomToastArg) => ReactNode,
    _opts?: { duration?: number },
  ): string {
    const api = getToastBridge();
    if (!api) return "";
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const content = renderer({ id, visible: true });
    return api.push({ id, content, title: "" });
  },
};

export default toast;
