import React, { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { TopMenuItem } from "./menuTypes";
import { useTopMenuPermission } from "./menuPermissions";

interface MenuDropdownProps {
  shortcutKey: string;
  label: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  items: TopMenuItem[];
  onNavigate: (page: string) => void;
}

const MenuDropdown: React.FC<MenuDropdownProps> = ({
  shortcutKey,
  label,
  isOpen,
  onOpen,
  onClose,
  items,
  onNavigate,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { canAccess } = useTopMenuPermission();

  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();

      const key = event.key.toLowerCase();
      const matched = items.find(
        (item) =>
          item.shortcut &&
          !item.shortcut.includes("+") &&
          item.shortcut.toLowerCase() === key,
      );

      if (matched) {
        event.preventDefault();
        runItem(matched);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, items]);

  const runItem = (item: TopMenuItem) => {
    if (item.kind === "divider" || item.kind === "heading") return;

    const allowed = canAccess(item.permission, item.adminOnly);

    if (!allowed || item.disabled) {
      window.dispatchEvent(
        new CustomEvent("topmenu:blocked", {
          detail: {
            item: item.label,
            reason: item.disabledReason || "permission",
          },
        }),
      );
      return;
    }

    if (item.onClick) {
      item.onClick();
      onClose();
      return;
    }

    if (item.page) {
      onNavigate(item.page);
      onClose();
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={isOpen ? onClose : onOpen}
        className="topbar-menu-button"
        style={{
          height: 27,
          padding: "0 10px",
          border: isOpen ? "1px solid #000000" : "1px solid transparent",
          background: isOpen ? "#C9DEB5" : "transparent",
          color: "#000000",
          display: "flex",
          alignItems: "center",
          gap: 3,
          fontSize: 12,
          fontWeight: isOpen ? 700 : 500,
          cursor: "pointer",
        }}
      >
        <span style={{ textDecoration: "underline", fontWeight: 700 }}>{shortcutKey}</span>
        <span>: {label}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: 27,
            left: 0,
            minWidth: 280,
            maxWidth: 340,
            background: "#EBF5E2",
            border: "1px solid #000000",
            boxShadow: "2px 2px 8px rgba(0,0,0,0.28)",
            zIndex: 1000,
            padding: "4px 0",
          }}
        >
          <div
            style={{
              padding: "6px 10px",
              background: "#C9DEB5",
              borderBottom: "1px solid #000000",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#000000",
            }}
          >
            {label} Menu
          </div>

          {items.map((item) => {
            if (item.kind === "divider") {
              return (
                <div
                  key={item.id}
                  style={{
                    height: 1,
                    background: "#000000",
                    opacity: 0.35,
                    margin: "3px 0",
                  }}
                />
              );
            }

            if (item.kind === "heading") {
              return (
                <div
                  key={item.id}
                  style={{
                    padding: "5px 10px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#000000",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    background: "#D4EABD",
                  }}
                >
                  {item.label}
                </div>
              );
            }

            const allowed = canAccess(item.permission, item.adminOnly);
            const locked = !allowed || item.disabled;

            return (
              <button
                key={item.id}
                type="button"
                disabled={locked}
                onClick={() => runItem(item)}
                onMouseEnter={(e) => {
                  if (!locked) e.currentTarget.style.background = "#D4EABD";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                style={{
                  width: "100%",
                  minHeight: 29,
                  padding: "5px 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  border: "none",
                  background: "transparent",
                  color: "#000000",
                  cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.5 : 1,
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  {locked ? <Lock style={{ width: 12, height: 12 }} /> : item.icon}
                  <span>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 600 }}>
                      {item.label}
                    </span>
                    {item.description && (
                      <span style={{ display: "block", fontSize: 10, opacity: 0.8 }}>
                        {item.description}
                      </span>
                    )}
                  </span>
                </span>

                {item.shortcut && (
                  <kbd
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      border: "1px solid #000000",
                      background: "#D4EABD",
                      borderRadius: 3,
                      padding: "1px 5px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MenuDropdown;
