import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import { COMMAND_ITEMS } from "./commandItems";
import { CommandPaletteItem } from "./menuTypes";
import { useTopMenuPermission } from "./menuPermissions";

interface GoToPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

const GoToPanel: React.FC<GoToPanelProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { canAccess } = useTopMenuPermission();

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const allowed = COMMAND_ITEMS.filter((item) =>
      canAccess(item.permission, item.adminOnly),
    );

    const q = query.trim().toLowerCase();

    if (!q) {
      const recent = getRecentItems();
      const recentIds = new Set(recent.map((item) => item.id));
      return [
        ...recent,
        ...allowed.filter((item) => !recentIds.has(item.id)),
      ].slice(0, 40);
    }

    return allowed
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.page?.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [query, canAccess]);

  useEffect(() => {
    if (!isOpen) return;

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selected = filtered[activeIndex];
        if (selected) handleSelect(selected);
      }
    };

    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, filtered, activeIndex]);

  const handleSelect = (item: CommandPaletteItem) => {
    saveRecentItem(item);

    if (item.action) {
      item.action();
      onClose();
      return;
    }

    if (item.page) {
      onNavigate(item.page);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/40 flex items-start justify-center pt-20"
      onMouseDown={onClose}
    >
      <div
        className="w-[720px] max-w-[calc(100vw-32px)] bg-[#EBF5E2] border border-[#000000] rounded-md shadow-2xl overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#D4EABD] border-b border-[#000000]">
          <div>
            <h2 className="text-[14px] font-bold text-[#000000]">Go To</h2>
            <p className="text-[11px] text-[#000000] mt-0.5">
              Search reports, vouchers, masters, and actions without breaking workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center border border-[#000000] rounded bg-[#EBF5E2]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#000000]">
          <Search className="h-4 w-4 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type command, report, voucher, master..."
            className="h-8 flex-1 border border-[#000000] bg-[#EBF5E2] px-3 text-[12px] focus:outline-none"
          />
          <kbd className="border border-[#000000] px-2 py-1 text-[10px] rounded bg-[#D4EABD]">
            Enter
          </kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-[#000000]">
              No matching command found.
            </div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full flex items-center justify-between px-4 py-2.5 border-b border-[#000000] text-left"
                style={{
                  background: activeIndex === index ? "#C9DEB5" : "#EBF5E2",
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <div>
                  <div className="text-[12px] font-semibold text-[#000000]">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-[#000000] mt-0.5">
                    {item.category}
                    {item.description ? ` · ${item.description}` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.shortcut && (
                    <kbd className="border border-[#000000] bg-[#D4EABD] px-2 py-0.5 rounded text-[10px] font-mono">
                      {item.shortcut}
                    </kbd>
                  )}
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function getRecentItems(): CommandPaletteItem[] {
  try {
    const raw = localStorage.getItem("sutra_goto_recent");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommandPaletteItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveRecentItem(item: CommandPaletteItem) {
  try {
    const existing = getRecentItems();
    const next = [item, ...existing.filter((row) => row.id !== item.id)].slice(0, 6);
    localStorage.setItem("sutra_goto_recent", JSON.stringify(next));
  } catch {
    // ignore localStorage issues
  }
}

export default GoToPanel;
