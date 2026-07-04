// src/components/RightButtonBar.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useF12Config } from "../hooks/useF12Config";
import { useStore } from "../store/useStore";

interface RightBarButton {
  id: string;
  label: string;
  shortcut: string;
  action: () => void;
  enabled: boolean;
  visible: boolean;
  active?: boolean;
  confirmMessage?: string;
  disabledReason?: string;
}

const formatShortcutLabel = (shortcut: string): string => {
  return shortcut
    .replace("Control+", "C+")
    .replace("Ctrl+", "C+")
    .replace("Alt+", "A+")
    .replace("Shift+", "S+")
    .replace("Escape", "Esc");
};

const isInputElement = (el: Element | null): boolean => {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  // Standard HTML input elements
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  // ContentEditable (rich text editors, chat UIs)
  if (el.getAttribute("contenteditable") === "true") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  // ARIA roles used by chat UIs, rich text editors, custom inputs
  const role = el.getAttribute("role");
  if (role === "textbox" || role === "searchbox" || role === "combobox" || role === "spinbutton")
    return true;
  // Check if inside a Falcon/chat container (any ancestor with data-falcon or id containing falcon/chat)
  let ancestor: Element | null = el;
  while (ancestor) {
    const id = ancestor.id?.toLowerCase() || "";
    const cls = ancestor.className?.toLowerCase?.() || "";
    const dataCmp = ancestor.getAttribute("data-component") || "";
    if (
      id.includes("falcon") ||
      id.includes("chat") ||
      id.includes("ai-input") ||
      cls.includes("falcon") ||
      cls.includes("chat-input") ||
      cls.includes("ai-chat") ||
      dataCmp.includes("falcon") ||
      dataCmp.includes("chat")
    )
      return true;
    ancestor = ancestor.parentElement;
  }
  return false;
};

function getComboString(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(key);
  return parts.join("+");
}

export const RightButtonBar: React.FC<{ onShortcut?: (key: string) => void }> = ({
  onShortcut,
}) => {
  const { setCurrentPage } = useStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { toggleF12, isOpen: f12IsOpen } = useF12Config();

  const buttons: RightBarButton[] = useMemo(
    () => [
      {
        id: "f1",
        label: "Help",
        shortcut: "F1",
        action: () => setCurrentPage("dashboard"),
        enabled: true,
        visible: true,
      },
      {
        id: "f2",
        label: "New Sales",
        shortcut: "F2",
        action: () => setCurrentPage("billing"),
        enabled: true,
        visible: true,
      },
      {
        id: "f3",
        label: "Items",
        shortcut: "F3",
        action: () => setCurrentPage("item-master"),
        enabled: true,
        visible: true,
      },
      {
        id: "f4",
        label: "Accounts",
        shortcut: "F4",
        action: () => setCurrentPage("accounts"),
        enabled: true,
        visible: true,
      },
      {
        id: "f5",
        label: "Journal",
        shortcut: "F5",
        action: () => setCurrentPage("journal"),
        enabled: true,
        visible: true,
      },
      {
        id: "f6",
        label: "Payment",
        shortcut: "F6",
        action: () => setCurrentPage("payment"),
        enabled: true,
        visible: true,
      },
      {
        id: "f7",
        label: "Receipt",
        shortcut: "F7",
        action: () => setCurrentPage("receipt"),
        enabled: true,
        visible: true,
      },
      {
        id: "f8",
        label: "Contra",
        shortcut: "F8",
        action: () => setCurrentPage("contra"),
        enabled: true,
        visible: true,
      },
      {
        id: "f9",
        label: "Sales Invoice",
        shortcut: "F9",
        action: () => setCurrentPage("billing"),
        enabled: true,
        visible: true,
      },
      {
        id: "f10",
        label: "Purchase",
        shortcut: "F10",
        action: () => setCurrentPage("purchase"),
        enabled: true,
        visible: true,
      },
      {
        id: "f11",
        label: "Balance Sheet",
        shortcut: "F11",
        action: () => setCurrentPage("balance-sheet"),
        enabled: true,
        visible: true,
      },
      {
        id: "divider1",
        label: "Quick Reports",
        shortcut: "",
        action: () => {},
        enabled: false,
        visible: true,
      },
      {
        id: "b",
        label: "Balance Sheet",
        shortcut: "B",
        action: () => setCurrentPage("balance-sheet"),
        enabled: true,
        visible: true,
      },
      {
        id: "t",
        label: "Trial Balance",
        shortcut: "T",
        action: () => setCurrentPage("trial-balance"),
        enabled: true,
        visible: true,
      },
      {
        id: "s",
        label: "Stock Status",
        shortcut: "S",
        action: () => setCurrentPage("stock-summary"),
        enabled: true,
        visible: true,
      },
      {
        id: "l",
        label: "Ledger",
        shortcut: "L",
        action: () => setCurrentPage("ledger"),
        enabled: true,
        visible: true,
      },
      {
        id: "v",
        label: "VAT Report",
        shortcut: "V",
        action: () => setCurrentPage("vat-reports"),
        enabled: true,
        visible: true,
      },
      {
        id: "d",
        label: "Day Book",
        shortcut: "D",
        action: () => setCurrentPage("day-book"),
        enabled: true,
        visible: true,
      },
      {
        id: "g",
        label: "GST Summary",
        shortcut: "G",
        action: () => setCurrentPage("vat-reports"),
        enabled: true,
        visible: true,
      },
    ],
    [setCurrentPage],
  );

  const visibleButtons = useMemo(() => buttons.filter((b) => b.visible), [buttons]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Never intercept F12 (browser dev tools + F12 config panel)
      if (e.key === "F12") return;

      // Check if user is actively typing in ANY input-like element
      const typing = isInputElement(document.activeElement);
      if (typing) return; // EXIT EARLY - never steal keypresses from inputs/chat

      // Check if any modal/dialog is currently open in the DOM
      const hasOpenModal =
        document.querySelector('[role="dialog"]') !== null ||
        document.querySelector('[data-modal-open="true"]') !== null ||
        document.querySelector(".modal-overlay") !== null ||
        document.querySelector('[aria-modal="true"]') !== null;
      if (hasOpenModal) return; // EXIT EARLY - don't navigate away from open modals

      const combo = getComboString(e);

      // F-keys (only when NOT typing - guard already checked above)
      if (e.key.startsWith("F") && !isNaN(Number(e.key.slice(1)))) {
        const btn = visibleButtons.find((b) => b.shortcut === e.key && b.enabled);
        if (btn) {
          e.preventDefault();
          btn.action();
          return;
        }
      }

      // Single letter shortcuts - only when not typing (guard already checked above)
      if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && e.key.length === 1) {
        const key = e.key.toUpperCase();
        const btn = visibleButtons.find((b) => b.shortcut === key && b.enabled);
        if (btn) {
          e.preventDefault();
          btn.action();
          return;
        }
      }

      // Pass to parent handler
      if (onShortcut) onShortcut(combo);
    };

    // CRITICAL FIX: Use BUBBLE phase (capture: false) NOT capture phase
    // This allows inputs, chat UIs, and custom components to handle events first
    document.addEventListener("keydown", handler, { capture: false });
    return () => document.removeEventListener("keydown", handler, { capture: false });
  }, [visibleButtons, onShortcut]);

  return (
    <div
      className="right-button-bar w-[148px] bg-[#1e2433] border-l border-[#2d3748] text-white flex flex-col shrink-0 overflow-y-auto"
      style={{ boxShadow: "-2px 0 4px rgba(0,0,0,0.15)" }}
    >
      <div className="bg-[#273148] text-center py-1 font-bold border-b border-[#2d3748] text-[10px] text-gray-300 uppercase tracking-widest shadow-sm">
        Quick Actions
      </div>

      {visibleButtons.map((button) => {
        if (!button.shortcut) {
          return (
            <div key={button.id} className="px-3 py-1.5 mt-1">
              <hr className="border-t border-[#2d3748] mb-1.5" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {button.label}
              </span>
            </div>
          );
        }

        const isHovered = hoveredId === button.id;
        const bgClass = isHovered && button.enabled ? "bg-[#273148]" : "bg-[#1e2433]";

        return (
          <button
            type="button"
            key={button.id}
            className={`w-full h-[26px] border-b border-[#2d3748] flex items-center select-none text-left ${bgClass} ${
              button.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-40"
            }`}
            onMouseEnter={() => setHoveredId(button.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => button.enabled && button.action()}
            title={button.shortcut}
            aria-label={`${button.label}${button.shortcut ? ` (${button.shortcut})` : ""}`}
          >
            <span className="w-8 text-center shrink-0 text-[10px] font-bold overflow-hidden text-[#d97706]">
              {formatShortcutLabel(button.shortcut)}
            </span>
            <span className="flex-1 text-[11px] truncate pr-1">{button.label}</span>
          </button>
        );
      })}

      <div className="bg-[#273148] text-center py-1 font-bold border-y border-[#2d3748] text-[10px] text-gray-300 uppercase tracking-widest mt-1">
        Configuration
      </div>
      <button
        type="button"
        onClick={toggleF12}
        className={`h-[26px] border-b border-[#2d3748] flex items-center select-none w-full text-left transition-colors ${
          f12IsOpen ? "bg-[#1557b0] text-white" : "bg-[#1e2433] hover:bg-[#273148] text-white"
        }`}
        title="F12: Open screen configuration settings"
      >
        <span
          className={`w-8 text-center shrink-0 text-[10px] font-bold ${f12IsOpen ? "text-blue-200" : "text-[#d97706]"}`}
        >
          F12
        </span>
        <span className="flex-1 text-[11px] truncate pr-1 flex items-center gap-1">
          {f12IsOpen && <span className="text-blue-200 text-[9px]">✓</span>}
          Configure
        </span>
      </button>

      <div className="mt-auto border-t border-[#2d3748] bg-[#1e2433] pt-1">
        <div className="bg-[#273148] text-center py-1 font-bold border-b border-[#2d3748] text-[10px] text-gray-300 uppercase tracking-widest">
          Nepal Links
        </div>
        <div className="py-1">
          <a
            href="https://ird.gov.np"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0284c7] hover:text-[#38bdf8] hover:underline text-center py-1 block text-[11px] transition-colors"
          >
            IRD Portal
          </a>
          <a
            href="https://etds.ird.gov.np"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0284c7] hover:text-[#38bdf8] hover:underline text-center py-1 block text-[11px] transition-colors"
          >
            e-TDS Portal
          </a>
        </div>
      </div>
    </div>
  );
};

export default RightButtonBar;
