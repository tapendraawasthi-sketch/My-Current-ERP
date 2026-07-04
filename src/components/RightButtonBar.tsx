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
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.getAttribute("contenteditable") === "true") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  const role = el.getAttribute("role");
  if (role === "textbox" || role === "searchbox" || role === "combobox" || role === "spinbutton")
    return true;
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

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-2 py-1.5 bg-[#273148] border-y border-[#3d4a63]">
    <span className="block text-center text-[10px] font-bold text-gray-300 uppercase tracking-wider">
      {label}
    </span>
  </div>
);

const ShortcutButton: React.FC<{
  button: RightBarButton;
  isHovered: boolean;
  isActive?: boolean;
  onHover: (id: string | null) => void;
}> = ({ button, isHovered, isActive, onHover }) => {
  const bgClass = isActive
    ? "bg-[#1557b0] border-[#1557b0]"
    : isHovered && button.enabled
      ? "bg-[#273148] border-[#3d4a63]"
      : "bg-[#232a3b] border-[#3d4a63]";

  return (
    <button
      type="button"
      className={`w-full h-[28px] mx-1 mb-0.5 rounded border flex items-center select-none text-left transition-colors ${bgClass} ${
        button.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-40"
      }`}
      style={{ width: "calc(100% - 8px)" }}
      onMouseEnter={() => onHover(button.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => button.enabled && button.action()}
      title={button.shortcut}
      aria-label={`${button.label}${button.shortcut ? ` (${button.shortcut})` : ""}`}
    >
      <span
        className={`w-9 text-center shrink-0 text-[10px] font-bold ${isActive ? "text-blue-200" : "text-[#f59e0b]"}`}
      >
        {formatShortcutLabel(button.shortcut)}
      </span>
      <span
        className={`flex-1 text-[11px] font-medium truncate pr-2 ${isActive ? "text-white" : "text-gray-200"}`}
      >
        {button.label}
      </span>
    </button>
  );
};

export const RightButtonBar: React.FC<{ onShortcut?: (key: string) => void }> = ({
  onShortcut,
}) => {
  const { setCurrentPage } = useStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { toggleF12, isOpen: f12IsOpen } = useF12Config();

  const actionButtons: RightBarButton[] = useMemo(
    () => [
      { id: "f1", label: "Help", shortcut: "F1", action: () => setCurrentPage("dashboard"), enabled: true, visible: true },
      { id: "f2", label: "New Sales", shortcut: "F2", action: () => setCurrentPage("billing"), enabled: true, visible: true },
      { id: "f3", label: "Items", shortcut: "F3", action: () => setCurrentPage("item-master"), enabled: true, visible: true },
      { id: "f4", label: "Accounts", shortcut: "F4", action: () => setCurrentPage("accounts"), enabled: true, visible: true },
      { id: "f5", label: "Journal", shortcut: "F5", action: () => setCurrentPage("journal"), enabled: true, visible: true },
      { id: "f6", label: "Payment", shortcut: "F6", action: () => setCurrentPage("payment"), enabled: true, visible: true },
      { id: "f7", label: "Receipt", shortcut: "F7", action: () => setCurrentPage("receipt"), enabled: true, visible: true },
      { id: "f8", label: "Contra", shortcut: "F8", action: () => setCurrentPage("contra"), enabled: true, visible: true },
      { id: "f9", label: "Sales Invoice", shortcut: "F9", action: () => setCurrentPage("billing"), enabled: true, visible: true },
      { id: "f10", label: "Purchase", shortcut: "F10", action: () => setCurrentPage("purchase"), enabled: true, visible: true },
      { id: "f11", label: "Balance Sheet", shortcut: "F11", action: () => setCurrentPage("balance-sheet"), enabled: true, visible: true },
    ],
    [setCurrentPage],
  );

  const reportButtons: RightBarButton[] = useMemo(
    () => [
      { id: "b", label: "Balance Sheet", shortcut: "B", action: () => setCurrentPage("balance-sheet"), enabled: true, visible: true },
      { id: "t", label: "Trial Balance", shortcut: "T", action: () => setCurrentPage("trial-balance"), enabled: true, visible: true },
      { id: "s", label: "Stock Status", shortcut: "S", action: () => setCurrentPage("stock-summary"), enabled: true, visible: true },
      { id: "l", label: "Ledger", shortcut: "L", action: () => setCurrentPage("ledger"), enabled: true, visible: true },
      { id: "v", label: "VAT Report", shortcut: "V", action: () => setCurrentPage("vat-reports"), enabled: true, visible: true },
      { id: "d", label: "Day Book", shortcut: "D", action: () => setCurrentPage("day-book"), enabled: true, visible: true },
      { id: "g", label: "GST Summary", shortcut: "G", action: () => setCurrentPage("vat-reports"), enabled: true, visible: true },
    ],
    [setCurrentPage],
  );

  const allButtons = useMemo(() => [...actionButtons, ...reportButtons], [actionButtons, reportButtons]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F12") return;
      const typing = isInputElement(document.activeElement);
      if (typing) return;

      const hasOpenModal =
        document.querySelector('[role="dialog"]') !== null ||
        document.querySelector('[data-modal-open="true"]') !== null ||
        document.querySelector(".modal-overlay") !== null ||
        document.querySelector('[aria-modal="true"]') !== null;
      if (hasOpenModal) return;

      const combo = getComboString(e);

      if (e.key.startsWith("F") && !isNaN(Number(e.key.slice(1)))) {
        const btn = allButtons.find((b) => b.shortcut === e.key && b.enabled);
        if (btn) {
          e.preventDefault();
          btn.action();
          return;
        }
      }

      if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && e.key.length === 1) {
        const key = e.key.toUpperCase();
        const btn = allButtons.find((b) => b.shortcut === key && b.enabled);
        if (btn) {
          e.preventDefault();
          btn.action();
          return;
        }
      }

      if (onShortcut) onShortcut(combo);
    };

    document.addEventListener("keydown", handler, { capture: false });
    return () => document.removeEventListener("keydown", handler, { capture: false });
  }, [allButtons, onShortcut]);

  return (
    <div
      className="right-button-bar w-[156px] bg-[#1e2433] border-l border-[#2d3748] text-white flex flex-col shrink-0 overflow-y-auto"
      style={{ boxShadow: "-3px 0 8px rgba(0,0,0,0.18)" }}
    >
      <SectionHeader label="Quick Actions" />

      <div className="py-1">
        {actionButtons.map((button) => (
          <ShortcutButton
            key={button.id}
            button={button}
            isHovered={hoveredId === button.id}
            onHover={setHoveredId}
          />
        ))}
      </div>

      <SectionHeader label="Configuration" />
      <div className="py-1">
        <button
          type="button"
          onClick={toggleF12}
          className={`h-[28px] mx-1 mb-0.5 rounded border flex items-center select-none w-full text-left transition-colors ${
            f12IsOpen
              ? "bg-[#1557b0] border-[#1557b0] text-white"
              : "bg-[#232a3b] border-[#3d4a63] hover:bg-[#273148] text-white"
          }`}
          style={{ width: "calc(100% - 8px)" }}
          title="F12: Open screen configuration settings"
        >
          <span
            className={`w-9 text-center shrink-0 text-[10px] font-bold ${f12IsOpen ? "text-blue-200" : "text-[#f59e0b]"}`}
          >
            F12
          </span>
          <span className="flex-1 text-[11px] font-medium truncate pr-2 flex items-center gap-1">
            {f12IsOpen && <span className="text-blue-200 text-[9px]">✓</span>}
            Configure
          </span>
        </button>
      </div>

      <SectionHeader label="Quick Reports" />
      <div className="py-1">
        {reportButtons.map((button) => (
          <ShortcutButton
            key={button.id}
            button={button}
            isHovered={hoveredId === button.id}
            onHover={setHoveredId}
          />
        ))}
      </div>

      <div className="mt-auto border-t border-[#2d3748]">
        <SectionHeader label="Nepal Links" />
        <div className="py-1.5 px-2 space-y-1">
          <a
            href="https://ird.gov.np"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center py-1.5 text-[11px] font-medium text-[#38bdf8] hover:text-white hover:bg-[#273148] rounded border border-[#3d4a63] transition-colors"
          >
            IRD Portal
          </a>
          <a
            href="https://etds.ird.gov.np"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center py-1.5 text-[11px] font-medium text-[#38bdf8] hover:text-white hover:bg-[#273148] rounded border border-[#3d4a63] transition-colors"
          >
            e-TDS Portal
          </a>
        </div>
      </div>
    </div>
  );
};

export default RightButtonBar;
