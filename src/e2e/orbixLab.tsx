/**
 * Phase UI-6 — Orbix workspace harness (dev / VITE_ALLOW_AUTH_FIXTURE only).
 * Renders production OrbixWorkspace with seeded identity — no posting authority changes.
 */
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/design-system/foundations/index.css";
import { applyDensity, applyDsTheme, type Density } from "@/design-system";
import OrbixWorkspace from "../components/ekhata/OrbixWorkspace";
import { useStore } from "../store/useStore";
import { useEKhataStore } from "../store/eKhataStore";
import type { OrbixResponse } from "../lib/ekhata/orbixResponseTypes";
import type { EKhataChatMessage, KhataConfirmationCard } from "../lib/ekhata/types";

const ALLOWED =
  import.meta.env.DEV === true || import.meta.env.VITE_ALLOW_AUTH_FIXTURE === "true";

declare global {
  interface Window {
    __orbixFixture?: {
      setMode: (mode: "ask" | "accountant") => void;
      setTheme: (theme: "light" | "dark") => void;
      setDensity: (density: Density) => void;
      seedExplanation: () => void;
      seedModeRestriction: () => void;
      seedClarification: () => void;
      seedPreview: () => void;
      seedStalePreview: () => void;
      seedPostingCompleted: (sync?: "pending" | "synced" | "conflict") => void;
      openEvidence: () => void;
      getState: () => { mode: string; theme: string; density: Density };
    };
  }
}

function seed() {
  useStore.setState({
    isAuthenticated: true,
    authStage: "authenticated",
    currentUser: {
      id: "ui6-lab-user",
      username: "lab.user",
      name: "Lab User",
      role: "accountant",
      permissions: [],
    } as never,
    companySettings: {
      id: "lab-co",
      companyName: "Himalayan Precision Trading Pvt. Ltd.",
      companyNameEn: "Himalayan Precision Trading Pvt. Ltd.",
      currencySymbol: "Rs.",
      defaultCurrency: "NPR",
    } as never,
    currentFiscalYear: {
      id: "fy1",
      name: "2081/82",
      startDate: "2024-07-16",
      endDate: "2025-07-15",
      isCurrent: true,
      isClosed: false,
    },
    currentPage: "orbix",
  });
  useEKhataStore.setState({
    isOpen: true,
    windowMode: "maximized",
    orbixMode: "ask",
    messages: [],
    pendingCard: null,
  });
}

function msg(partial: Partial<EKhataChatMessage> & { text: string; role: "user" | "assistant" }): EKhataChatMessage {
  return {
    id: `lab-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date(),
    ...partial,
  };
}

function samplePreviewCard(): KhataConfirmationCard {
  return {
    intent: "khata_cash_sale",
    party: "Demo Customer",
    amount: 11300,
    date: "2081-12-01",
    raw_text: "fixture preview",
    draft_id: "draft-ui6-lab-001",
    preview_hash: "phash-ui6-abcdef012345",
    preview_version: 1,
    journalLines: [
      { accountCode: "1001", accountName: "Cash", accountClass: "asset", debit: 11300, credit: 0 },
      { accountCode: "4001", accountName: "Sales", accountClass: "income", debit: 0, credit: 10000 },
      {
        accountCode: "2101",
        accountName: "Output VAT",
        accountClass: "liability",
        debit: 0,
        credit: 1300,
      },
    ],
  };
}

function OrbixLabInner() {
  const [mode, setMode] = useState<"ask" | "accountant">("ask");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [density, setDensity] = useState<Density>("productive");
  const setOrbixMode = useEKhataStore((s) => s.setOrbixMode);

  useEffect(() => {
    applyDsTheme(theme);
    applyDensity(density);
  }, [theme, density]);

  useEffect(() => {
    seed();
  }, []);

  useEffect(() => {
    setOrbixMode(mode);
  }, [mode, setOrbixMode]);

  useEffect(() => {
    window.__orbixFixture = {
      setMode: (m) => setMode(m),
      setTheme: (t) => setTheme(t),
      setDensity: (d) => setDensity(d),
      seedExplanation: () => {
        const response: OrbixResponse = {
          schema_version: "1.0",
          response_type: "accounting_explanation",
          status: "success",
          display: {
            text: "Output VAT on a sales return is reversed against the original output VAT liability.",
            tone: "professional",
          },
          actions: [],
          payload: { kind: "accounting_explanation" },
        };
        useEKhataStore.setState({
          messages: [
            msg({ role: "user", text: "How is output VAT reversed on a Sales return?" }),
            msg({
              role: "assistant",
              text: response.display.text,
              orbixResponse: response,
            }),
          ],
          pendingCard: null,
        });
      },
      seedModeRestriction: () => {
        const response: OrbixResponse = {
          schema_version: "1.0",
          response_type: "mode_restriction",
          status: "requires_input",
          display: {
            text: "Ask Mode cannot post. Switch to Accountant Mode to continue.",
            tone: "professional",
          },
          actions: [{ id: "switch", type: "switch_mode", label: "Switch to Accountant Mode" }],
          payload: {
            requested_operation: "transaction_create",
            required_mode: "accountant",
            current_mode: "ask",
            can_preview: true,
            can_explain: true,
            original_request_preserved: true,
          },
        };
        useEKhataStore.setState({
          orbixMode: "ask",
          messages: [
            msg({ role: "user", text: "Record a return for invoice SI-E2E-CASH-001." }),
            msg({
              role: "assistant",
              text: response.display.text,
              orbixResponse: response,
            }),
          ],
          pendingCard: null,
        });
        setMode("ask");
      },
      seedClarification: () => {
        const response: OrbixResponse = {
          schema_version: "1.0",
          response_type: "clarification_required",
          status: "requires_input",
          display: { text: "Which party should this purchase use?", tone: "professional" },
          actions: [],
          payload: {
            draft_id: "draft-ui6-clarify-1",
            transaction_type: "purchase",
            draft_status: "awaiting_clarification",
            captured_fields: [{ field: "amount", label: "Amount", value: "5000" }],
            missing_fields: [
              { field: "party", label: "Party", required: true, input_type: "text" },
            ],
            ambiguous_fields: [],
            nothing_posted: true,
          },
        };
        useEKhataStore.setState({
          orbixMode: "accountant",
          messages: [
            msg({ role: "user", text: "Record a purchase of NPR 5000" }),
            msg({
              role: "assistant",
              text: response.display.text,
              orbixResponse: response,
            }),
          ],
          pendingCard: null,
        });
        setMode("accountant");
      },
      seedPreview: () => {
        useEKhataStore.setState({
          orbixMode: "accountant",
          messages: [
            msg({ role: "user", text: "Create a cash sale for Demo Customer NPR 11300" }),
          ],
          pendingCard: samplePreviewCard(),
        });
        setMode("accountant");
      },
      seedStalePreview: () => {
        const stale: OrbixResponse = {
          schema_version: "1.0",
          response_type: "posting_failed",
          status: "failed",
          display: {
            text: "This preview is out of date. Generate a new preview before confirming.",
            tone: "professional",
          },
          actions: [],
          payload: {
            draft_id: "draft-ui6-lab-001",
            error_code: "stale_preview",
            safe_message: "This preview is out of date. Generate a new preview before confirming.",
            rolled_back: true,
            retryable: true,
            user_action_required: true,
            draft_retained: true,
          },
        };
        useEKhataStore.setState({
          orbixMode: "accountant",
          messages: [
            msg({ role: "user", text: "Confirm sale" }),
            msg({
              role: "assistant",
              text: stale.display.text,
              orbixResponse: stale,
            }),
          ],
          pendingCard: samplePreviewCard(),
        });
        setMode("accountant");
      },
      seedPostingCompleted: (sync = "pending") => {
        const response: OrbixResponse = {
          schema_version: "1.0",
          response_type: "posting_completed",
          status: "success",
          display: { text: "Posted voucher JV-LAB-001", tone: "professional" },
          actions: [],
          payload: {
            draft_id: "draft-ui6-lab-001",
            posting_id: "post-lab-1",
            voucher_number: "JV-LAB-001",
            amount: "11300",
            currency: "NPR",
            posted_at: new Date().toISOString(),
            idempotent_replay: false,
            sync_status: sync,
          },
        };
        useEKhataStore.setState({
          messages: [
            msg({
              role: "assistant",
              text: response.display.text,
              orbixResponse: response,
            }),
          ],
          pendingCard: null,
        });
      },
      openEvidence: () => {
        // Evidence rail opens at xl; force viewport is E2E responsibility.
        // Click the evidence toggle if present.
        const btn = document.querySelector(
          'button[aria-label="Toggle evidence and context panel"]',
        ) as HTMLButtonElement | null;
        btn?.click();
      },
      getState: () => ({ mode, theme, density }),
    };
    return () => {
      delete window.__orbixFixture;
    };
  }, [mode, theme, density]);

  return (
    <div
      className="ds-root flex h-screen flex-col bg-[var(--ds-canvas,#f5f6fa)] p-3"
      data-testid="orbix-lab-ready"
    >
      <p className="mb-2 text-[12px] text-[var(--ds-text-muted)]">
        UI-6 Orbix Laboratory · mode={mode} · theme={theme} · density={density}
      </p>
      <div className="min-h-0 flex-1">
        <OrbixWorkspace variant="page" />
      </div>
    </div>
  );
}

function OrbixLab() {
  if (!ALLOWED) {
    return (
      <div data-testid="orbix-lab-blocked" className="p-8 text-[14px]">
        Orbix lab is not available in this build.
      </div>
    );
  }
  return <OrbixLabInner />;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<OrbixLab />);
