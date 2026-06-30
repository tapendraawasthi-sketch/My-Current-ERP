import React, { useEffect, useMemo, useState } from "react";
import { useRightBarButtons, type RightBarButton } from "../hooks/useRightBarButtons";
import { useF12Config } from "../hooks/useF12Config";

const normalizeShortcut = (shortcut: string) =>
  shortcut.replace(/\s+/g, "").replace("Control+", "Ctrl+").replace("Escape", "Esc");

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
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.getAttribute("contenteditable") === "true"
  );
};

const executeButton = (button: RightBarButton) => {
  if (!button.enabled) return;
  if (button.confirmMessage && !window.confirm(button.confirmMessage)) return;
  button.action();
};

export const RightButtonBar: React.FC<{ onShortcut?: (key: string) => void }> = ({
  onShortcut,
}) => {
  const buttons = useRightBarButtons();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { toggleF12, isOpen: f12IsOpen } = useF12Config();

  const visibleButtons = useMemo(() => {
    return buttons.filter((b) => b.visible);
  }, [buttons]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow F-keys (F1–F12) even in inputs; block only alphanumeric shortcuts
      const isFunctionKey = e.key.startsWith("F") && e.key.length <= 3;
      if (isInputElement(document.activeElement) && !isFunctionKey && !e.ctrlKey) return;

      const combo = normalizeShortcut(
        `${e.ctrlKey ? "Ctrl+" : ""}${e.altKey ? "Alt+" : ""}${e.shiftKey ? "Shift+" : ""}${e.key.toUpperCase()}`,
      );

      const button = visibleButtons.find(
        (b) => b.shortcut && normalizeShortcut(b.shortcut) === combo,
      );

      if (button) {
        if (!button.enabled) {
          if (button.disabledReason) {
            alert(`Cannot perform action: ${button.disabledReason}`);
          }
          return;
        }
        e.preventDefault();
        executeButton(button);
        return;
      }

      onShortcut?.(combo);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visibleButtons, onShortcut, toggleF12]);

  return (
    <div className="right-button-bar w-[148px] bg-[#1e2433] border-l border-[#2d3748] text-white flex flex-col shrink-0 overflow-y-auto">
      <div className="bg-[#273148] text-center py-1 font-bold border-b border-[#2d3748] text-[10px] text-gray-300 uppercase tracking-widest shadow-sm">
        Quick Actions
      </div>

      {visibleButtons.map((button) => {
        const isHovered = hoveredId === button.id;
        const isActive = button.active;

        let bgClass = "bg-[#1e2433]";
        if (isActive) bgClass = "bg-[#1557b0]";
        else if (isHovered && button.enabled) bgClass = "bg-[#273148]";

        return (
          <button
            type="button"
            key={button.id}
            className={`w-full h-[26px] border-b border-[#2d3748] flex items-center select-none text-left ${bgClass} ${
              button.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-40"
            }`}
            onMouseEnter={() => setHoveredId(button.id)}
            onMouseLeave={() => setHoveredId(null)}
            onBlur={() => setHoveredId(null)}
            onClick={() => executeButton(button)}
            title={button.enabled ? button.shortcut : button.disabledReason}
            aria-label={`${button.label}${button.shortcut ? ` (${button.shortcut})` : ""}`}
          >
            <span
              className={`w-8 text-center shrink-0 text-[10px] font-bold overflow-hidden ${isActive ? "text-blue-200" : "text-[#d97706]"}`}
              title={button.shortcut}
            >
              {button.shortcut ? formatShortcutLabel(button.shortcut) : ""}
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
        aria-label="Open screen configuration settings"
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
