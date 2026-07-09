/** Orbix v2 chat store — talks to the real reasoning backend, with an honest
 * offline fallback. Evidence and tool traces are first-class on each message. */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  checkOrbixStatus,
  forgetOrbixSession,
  sendOrbixMessage,
} from "../lib/orbix/orbixClient";
import { buildLocalFallbackAnswer } from "../lib/orbix/localFallback";
import {
  appendOrbixMessage,
  getOrCreateOrbixSession,
  resetOrbixSession,
} from "../lib/orbix/sessionMemory";
import type {
  OrbixChatResponse,
  OrbixEvidenceRef,
  OrbixRuntimeMode,
  OrbixToolTrace,
} from "../lib/orbix/types";

let _controller: AbortController | null = null;

function newController(): AbortController {
  _controller?.abort();
  _controller = new AbortController();
  return _controller;
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface OrbixMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  intent?: string;
  confidence?: number;
  evidence?: OrbixEvidenceRef[];
  toolTrace?: OrbixToolTrace[];
  warnings?: string[];
  engine?: string;
  needsConfirmation?: boolean;
  confirmationPayload?: Record<string, unknown>;
  isStreaming?: boolean;
}

export interface OrbixContext {
  route?: string;
  screenTitle?: string;
  userId?: string;
  companyId?: string;
}

interface OrbixStore {
  messages: OrbixMessage[];
  isLoading: boolean;
  status: OrbixRuntimeMode | "unknown";
  agentModel?: string;
  context: OrbixContext;
  setContext: (ctx: Partial<OrbixContext>) => void;
  refreshStatus: () => Promise<void>;
  sendMessage: (message: string, context?: OrbixContext) => Promise<void>;
  confirmAction: (
    messageId: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  clearHistory: () => void;
  cancel: () => void;
}

function applyResponse(resp: OrbixChatResponse): Partial<OrbixMessage> {
  return {
    content: resp.answer,
    intent: resp.intent,
    confidence: resp.confidence,
    evidence: resp.evidence,
    toolTrace: resp.tool_trace,
    warnings: resp.warnings,
    engine: resp.engine,
    needsConfirmation: resp.needs_confirmation,
    confirmationPayload: resp.confirmation_payload,
    isStreaming: false,
  };
}

export const useOrbixStore = create<OrbixStore>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,
      status: "unknown",
      context: {},

      setContext: (ctx) => set((s) => ({ context: { ...s.context, ...ctx } })),

      refreshStatus: async () => {
        const status = await checkOrbixStatus();
        set({ status: status.mode, agentModel: status.agentModel });
      },

      sendMessage: async (message, context) => {
        const text = message.trim();
        if (!text || get().isLoading) return;

        const ctx = { ...get().context, ...context };
        const session = getOrCreateOrbixSession();
        appendOrbixMessage("user", text);

        const userMsg: OrbixMessage = {
          id: genId(),
          role: "user",
          content: text,
          timestamp: Date.now(),
        };
        const assistantId = genId();
        set((s) => ({
          messages: [
            ...s.messages,
            userMsg,
            {
              id: assistantId,
              role: "assistant",
              content: "",
              timestamp: Date.now(),
              isStreaming: true,
            },
          ],
          isLoading: true,
        }));

        const status = await checkOrbixStatus();
        set({ status: status.mode, agentModel: status.agentModel });

        const controller = newController();
        let resp: OrbixChatResponse;
        try {
          if (status.mode !== "orbix") {
            resp = buildLocalFallbackAnswer(text, session.sessionId);
          } else {
            resp = await sendOrbixMessage(
              {
                message: text,
                session_id: session.sessionId,
                user_id: ctx.userId,
                company_id: ctx.companyId,
                current_route: ctx.route,
                screen_title: ctx.screenTitle,
                mode: "auto",
              },
              controller.signal,
            );
          }
        } catch (err: unknown) {
          const isAbort = err instanceof Error && err.name === "AbortError";
          resp = isAbort
            ? { ...buildLocalFallbackAnswer(text, session.sessionId), answer: "_(cancelled)_" }
            : buildLocalFallbackAnswer(text, session.sessionId);
        }

        appendOrbixMessage("assistant", resp.answer);
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, ...applyResponse(resp) } : m,
          ),
          isLoading: false,
        }));
      },

      confirmAction: async (messageId, payload) => {
        const session = getOrCreateOrbixSession();
        set({ isLoading: true });
        let resp: OrbixChatResponse;
        try {
          resp = await sendOrbixMessage({
            message: "confirm",
            session_id: session.sessionId,
            confirm_token: genId(),
            confirmation_payload: payload,
            mode: "khata",
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "confirmation failed";
          resp = buildLocalFallbackAnswer(msg, session.sessionId);
        }
        set((s) => ({
          messages: [
            ...s.messages.map((m) =>
              m.id === messageId ? { ...m, needsConfirmation: false } : m,
            ),
            {
              id: genId(),
              role: "assistant",
              content: resp.answer,
              timestamp: Date.now(),
              ...applyResponse(resp),
            },
          ],
          isLoading: false,
        }));
      },

      clearHistory: () => {
        const session = getOrCreateOrbixSession();
        forgetOrbixSession(session.sessionId).catch(() => undefined);
        resetOrbixSession();
        set({ messages: [], isLoading: false });
      },

      cancel: () => {
        _controller?.abort();
        _controller = null;
        set({ isLoading: false });
      },
    }),
    {
      name: "orbix-store-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        context: state.context,
        messages: state.messages.slice(-50),
      }),
    },
  ),
);

export default useOrbixStore;
