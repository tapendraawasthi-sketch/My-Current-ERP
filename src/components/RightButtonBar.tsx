// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { useRightBarButtons, type RightBarButton } from "../hooks/useRightBarButtons";

const normalizeShortcut = (shortcut: string) =>
  shortcut
    .replace(/\s+/g, "")
    .replace("Control+", "Ctrl+")
    .replace("Escape", "Esc")
    .toUpperCase();

const comboFromEvent = (e: KeyboardEvent) => {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  let key = e.key;

  if (key === "Escape") key = "Esc";
  else if (key === " ") key = "Space";
  else if (/^[a-z]$/i.test(key)) key = key.toUpperCase();
  else if (/^F\d{1,2}$/i.test(key)) key = key.toUpperCase();

  parts.push(key);

  return normalizeShortcut(parts.join("+"));
};

const isEditableTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
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

  const visibleButtons = useMemo(() => buttons.filter((b) => b.visible), [buttons]);

  const grouped = useMemo(() => {
    const result: Record<string, RightBarButton[]> = {};
    visibleButtons.forEach((button) => {
      if (!result[button.group]) result[button.group] = [];
      result[button.group].push(button);
    });
    return result;
  }, [visibleButtons]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const combo = comboFromEvent(e);
      const button = visibleButtons.find(
        (b) => normalizeShortcut(b.shortcut) === combo && b.visible,
      );

      if (button) {
        if (!button.enabled) return;
        e.preventDefault();
        executeButton(button);
        return;
      }

      onShortcut?.(combo);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visibleButtons, onShortcut]);

  const sidebarStyle: React.CSSProperties = {
    width: 148,
    background: "#D4EABD",
    borderLeft: "1px solid #000000",
    fontSize: 11,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    overflowY: "auto",
    color: "#000000",
  };

  const headerStyle: React.CSSProperties = {
    background: "#C9DEB5",
    textAlign: "center",
    padding: "3px 0",
    fontWeight: "bold",
    borderBottom: "1px solid #000000",
    color: "#000000",
  };

  const groupHeaderStyle: React.CSSProperties = {
    background: "#C9DEB5",
    textAlign: "center",
    padding: "2px 0",
    fontWeight: "bold",
    borderBottom: "1px solid #000000",
    color: "#000000",
    fontSize: 11,
  };

  const rowStyle = (button: RightBarButton, hovered: boolean): React.CSSProperties => ({
    height: 22,
    borderBottom: "1px solid #000000",
    cursor: button.enabled ? "pointer" : "not-allowed",
    background: button.active ? "#B8D89A" : hovered && button.enabled ? "#C9DEB5" : "#D4EABD",
    display: "flex",
    alignItems: "center",
    opacity: button.enabled ? 1 : 0.4,
    color: "#000000",
    padding: 0,
    width: "100%",
    textAlign: "left",
    borderTop: "none",
    borderRight: "none",
    borderLeft: "none",
    borderRadius: 0,
  });

  const shortcutStyle: React.CSSProperties = {
    width: 32,
    color: "#000000",
    fontWeight: "bold",
    textAlign: "center",
    flexShrink: 0,
    fontSize: 9,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    padding: "0 2px",
  };

  const labelStyle: React.CSSProperties = {
    color: "#000000",
    fontSize: 11,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    paddingRight: 4,
    flex: 1,
  };

  return (
    <div style={sidebarStyle} className="sidebar-scroll no-print">
      <div style={headerStyle}>Actions</div>

      {Object.entries(grouped).map(([group, groupButtons]) => {
        const usable = groupButtons.filter((b) => b.visible);
        if (usable.length === 0) return null;

        return (
          <div key={group}>
            <div style={groupHeaderStyle}>{group}</div>
            {usable.map((button) => (
              <button
                key={button.id}
                type="button"
                title={!button.enabled ? button.disabledReason || "Disabled" : `${button.shortcut}: ${button.label}`}
                onClick={() => executeButton(button)}
                onMouseEnter={() => setHoveredId(button.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={rowStyle(button, hoveredId === button.id)}
                disabled={!button.enabled}
              >
                <span style={shortcutStyle}>{button.shortcut}</span>
                <span style={labelStyle}>
                  {button.active ? "[✓] " : ""}
                  {button.label}
                </span>
              </button>
            ))}
          </div>
        );
      })}

      <div style={{ height: 6, borderBottom: "1px solid #000000" }} />
      <div
        style={{
          background: "#C9DEB5",
          textAlign: "center",
          padding: "2px 0",
          fontSize: 10,
          color: "#000000",
          borderBottom: "1px solid #000000",
          fontWeight: "bold",
        }}
      >
        Nepal Links
      </div>
      <a
        href="https://ird.gov.np"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "#000000",
          textDecoration: "underline",
          textAlign: "center",
          padding: "3px 0",
          display: "block",
          fontSize: 11,
          borderBottom: "1px solid #000000",
        }}
      >
        IRD Portal
      </a>
      <a
        href="https://etds.ird.gov.np"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "#000000",
          textDecoration: "underline",
          textAlign: "center",
          padding: "3px 0",
          display: "block",
          fontSize: 11,
        }}
      >
        e-TDS Portal
      </a>
    </div>
  );
};

export default RightButtonBar;
