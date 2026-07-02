// src/components/RightButtonBar.tsx
import React, { useEffect, useMemo, useState, createContext, useContext, useCallback } from "react";
import { useStore } from "../store/useStore";

// ─── Shortcut Context ─────────────────────────────────────────────────────────
// Pages push their relevant shortcuts here. The RightButtonBar reads from it.

export interface PageShortcut {
  id: string;
  label: string;
  shortcut: string;
  action: () => void;
  enabled?: boolean;
}

interface ShortcutContextType {
  shortcuts: PageShortcut[];
  registerShortcuts: (shortcuts: PageShortcut[]) => void;
  clearShortcuts: () => void;
}

const ShortcutContext = createContext<ShortcutContextType>({
  shortcuts: [],
  registerShortcuts: () => {},
  clearShortcuts: () => {},
});

export const ShortcutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shortcuts, setShortcuts] = useState<PageShortcut[]>([]);

  const registerShortcuts = useCallback((newShortcuts: PageShortcut[]) => {
    setShortcuts(newShortcuts);
  }, []);

  const clearShortcuts = useCallback(() => {
    setShortcuts([]);
  }, []);

  return (
    <ShortcutContext.Provider value={{ shortcuts, registerShortcuts, clearShortcuts }}>
      {children}
    </ShortcutContext.Provider>
  );
};

export const usePageShortcuts = () => useContext(ShortcutContext);

// ─── Default shortcuts per page ───────────────────────────────────────────────
// Pages that do NOT register their own shortcuts fall back to these.

const DEFAULT_SHORTCUTS: Record<string, Array<{ label: string; shortcut: string; page?: string }>> = {
  "balance-sheet": [
    { label: "Options",    shortcut: "F11" },
    { label: "Print",      shortcut: "F12" },
    { label: "Export",     shortcut: "Ctrl+E" },
    { label: "Drill Down", shortcut: "Enter" },
    { label: "Back",       shortcut: "Esc" },
  ],
  "profit-loss": [
    { label: "Options",    shortcut: "F11" },
    { label: "Print",      shortcut: "F12" },
    { label: "Export",     shortcut: "Ctrl+E" },
  ],
  "trial-balance": [
    { label: "Options",    shortcut: "F11" },
    { label: "Print",      shortcut: "F12" },
    { label: "Export",     shortcut: "Ctrl+E" },
    { label: "Balance",    shortcut: "Ctrl+B" },
  ],
  "day-book": [
    { label: "Prev Day",   shortcut: "←" },
    { label: "Next Day",   shortcut: "→" },
    { label: "Today",      shortcut: "T" },
    { label: "Print",      shortcut: "F12" },
    { label: "Export",     shortcut: "Ctrl+E" },
  ],
  "ledger": [
    { label: "Select Acc", shortcut: "F3" },
    { label: "Print",      shortcut: "F12" },
    { label: "Export",     shortcut: "Ctrl+E" },
    { label: "Drill Down", shortcut: "Enter" },
  ],
  "vat-reports": [
    { label: "Export",     shortcut: "Ctrl+E" },
    { label: "Print",      shortcut: "F12" },
    { label: "Options",    shortcut: "F11" },
  ],
  "billing": [
    { label: "Save",       shortcut: "F2" },
    { label: "New",        shortcut: "Ctrl+N" },
    { label: "Print",      shortcut: "F12" },
    { label: "Add Line",   shortcut: "Tab" },
    { label: "Del Line",   shortcut: "F9" },
  ],
  "purchase": [
    { label: "Save",       shortcut: "F2" },
    { label: "New",        shortcut: "Ctrl+N" },
    { label: "Print",      shortcut: "F12" },
    { label: "Add Line",   shortcut: "Tab" },
    { label: "Del Line",   shortcut: "F9" },
  ],
  "journal": [
    { label: "Save",       shortcut: "F2" },
    { label: "New",        shortcut: "Ctrl+N" },
    { label: "Add Line",   shortcut: "Tab" },
    { label: "Narration",  shortcut: "F4" },
  ],
  "payment": [
    { label: "Save",       shortcut: "F2" },
    { label: "New",        shortcut: "Ctrl+N" },
    { label: "Narration",  shortcut: "F4" },
  ],
  "receipt": [
    { label: "Save",       shortcut: "F2" },
    { label: "New",        shortcut: "Ctrl+N" },
    { label: "Narration",  shortcut: "F4" },
  ],
  "outstanding-receivables": [
    { label: "Export",     shortcut: "Ctrl+E" },
    { label: "Print",      shortcut: "F12" },
    { label: "Party Stmt", shortcut: "Enter" },
  ],
  "outstanding-payables": [
    { label: "Export",     shortcut: "Ctrl+E" },
    { label: "Print",      shortcut: "F12" },
    { label: "Party Stmt", shortcut: "Enter" },
  ],
};

// Universal shortcuts always shown at the bottom
const UNIVERSAL_SHORTCUTS = [
  { label: "Help",       shortcut: "F1" },
  { label: "Configure",  shortcut: "F12" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatShortcut = (s: string): string =>
  s.replace("Control+", "C+")
   .replace("Ctrl+", "C+")
   .replace("Alt+", "A+")
   .replace("Shift+", "S+")
   .replace("Escape", "Esc");

const isInputFocused = (): boolean => {
  const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" ||
    document.activeElement?.getAttribute("contenteditable") === "true";
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const RightButtonBar: React.FC<{ onShortcut?: (key: string) => void }> = ({
  onShortcut,
}) => {
  const { setCurrentPage, currentPage } = useStore();
  const { shortcuts: contextShortcuts } = usePageShortcuts();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Determine which shortcuts to show:
  // 1. If the current page has registered contextual shortcuts, use those
  // 2. Otherwise fall back to DEFAULT_SHORTCUTS[currentPage]
  // 3. Always append UNIVERSAL_SHORTCUTS at the bottom
  const displayShortcuts = useMemo(() => {
    const pageDefaults = DEFAULT_SHORTCUTS[currentPage] || [];
    const primary = contextShortcuts.length > 0
      ? contextShortcuts.map((cs) => ({
          label: cs.label,
          shortcut: cs.shortcut,
          action: cs.action,
          enabled: cs.enabled !== false,
        }))
      : pageDefaults.map((s) => ({
          label: s.label,
          shortcut: s.shortcut,
          action: undefined as (() => void) | undefined,
          enabled: true,
        }));

    return primary;
  }, [currentPage, contextShortcuts]);

  // Global keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F12") return; // handled by F12Panel separately

      const typing = isInputFocused();

      // F-keys work regardless of focus
      if (e.key.startsWith("F") && !isNaN(Number(e.key.slice(1)))) {
        // Let context shortcuts handle their own F-keys
        return;
      }

      // Single letters only when not typing
      if (!typing && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && e.key.length === 1) {
        onShortcut?.(e.key.toUpperCase());
      }
    };

    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onShortcut]);

  return (
    <div
      className="right-button-bar"
      style={{
        width: 148,
        background: "#1e2433",
        borderLeft: "1px solid #2d3748",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflowY: "auto",
        boxShadow: "-2px 0 4px rgba(0,0,0,0.15)",
      }}
    >
      {/* Header */}
      <div style={{
        background: "#273148",
        textAlign: "center",
        padding: "5px 0",
        fontWeight: 700,
        borderBottom: "1px solid #2d3748",
        fontSize: 10,
        color: "#9ca3af",
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        flexShrink: 0,
      }}>
        Quick Keys
      </div>

      {/* Page-specific section label */}
      {displayShortcuts.length > 0 && (
        <div style={{
          padding: "4px 10px 2px",
          fontSize: 9,
          fontWeight: 700,
          color: "#475c8a",
          textTransform: "uppercase" as const,
          letterSpacing: "0.05em",
        }}>
          {(currentPage || "general")
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")}
        </div>
      )}

      {/* Page-specific shortcuts */}
      <div style={{ flex: 1 }}>
        {displayShortcuts.map((btn, idx) => {
          const id = `${btn.shortcut}-${idx}`;
          const isHov = hoveredId === id;
          const enabled = btn.enabled !== false;

          return (
            <button
              key={id}
              type="button"
              className="w-full"
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => {
                if (!enabled) return;
                if (btn.action) btn.action();
                else onShortcut?.(btn.shortcut);
              }}
              style={{
                width: "100%",
                height: 26,
                borderBottom: "1px solid #2d3748",
                display: "flex",
                alignItems: "center",
                background: isHov && enabled ? "#273148" : "#1e2433",
                border: "none",
                borderBottom: "1px solid #2d3748",
                cursor: enabled ? "pointer" : "default",
                opacity: enabled ? 1 : 0.4,
                textAlign: "left" as const,
                padding: 0,
                userSelect: "none" as const,
                transition: "background 80ms ease",
              }}
              title={btn.label}
              aria-label={`${btn.label} (${btn.shortcut})`}
            >
              {/* Shortcut key — amber for distinction on dark bg */}
              <span style={{
                width: 36,
                textAlign: "center" as const,
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 700,
                color: "#d97706",
                fontFamily: "monospace",
                overflow: "hidden",
              }}>
                {formatShortcut(btn.shortcut)}
              </span>

              {/* Label */}
              <span style={{
                flex: 1,
                fontSize: 11,
                color: "#cbd5e1",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingRight: 4,
              }}>
                {btn.label}
              </span>
            </button>
          );
        })}

        {/* Fallback when no page shortcuts are defined */}
        {displayShortcuts.length === 0 && (
          <div style={{
            padding: "12px 10px",
            fontSize: 10,
            color: "#475c8a",
            textAlign: "center",
          }}>
            No shortcuts for
            <br />this screen
          </div>
        )}
      </div>

      {/* Universal shortcuts — always shown */}
      <div style={{
        borderTop: "1px solid #2d3748",
        background: "#1a1f2c",
        flexShrink: 0,
      }}>
        <div style={{
          padding: "4px 10px 2px",
          fontSize: 9,
          fontWeight: 700,
          color: "#475c8a",
          textTransform: "uppercase" as const,
          letterSpacing: "0.05em",
        }}>
          Universal
        </div>
        {UNIVERSAL_SHORTCUTS.map((btn, idx) => (
          <button
            key={idx}
            type="button"
            style={{
              width: "100%",
              height: 26,
              display: "flex",
              alignItems: "center",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #2d3748",
              cursor: "pointer",
              userSelect: "none" as const,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#273148";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <span style={{
              width: 36,
              textAlign: "center" as const,
              fontSize: 10,
              fontWeight: 700,
              color: "#d97706",
              fontFamily: "monospace",
            }}>
              {formatShortcut(btn.shortcut)}
            </span>
            <span style={{ flex: 1, fontSize: 11, color: "#94a3b8" }}>
              {btn.label}
            </span>
          </button>
        ))}
      </div>

      {/* IRD Links */}
      <div style={{
        borderTop: "1px solid #2d3748",
        background: "#1e2433",
        padding: "6px 0",
        flexShrink: 0,
      }}>
        <div style={{
          padding: "2px 10px",
          fontSize: 9,
          fontWeight: 700,
          color: "#475c8a",
          textTransform: "uppercase" as const,
          letterSpacing: "0.05em",
          marginBottom: 2,
        }}>
          Nepal Links
        </div>
        {[
          { label: "IRD Portal",   href: "https://ird.gov.np" },
          { label: "e-TDS Portal", href: "https://etds.ird.gov.np" },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              textAlign: "center",
              padding: "3px 0",
              fontSize: 11,
              color: "#0284c7",
              textDecoration: "none",
              transition: "color 100ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "#38bdf8";
              (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "#0284c7";
              (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none";
            }}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
};

export default RightButtonBar;
