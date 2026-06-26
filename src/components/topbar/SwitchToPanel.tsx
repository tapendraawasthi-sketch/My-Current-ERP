import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, X } from "lucide-react";
import { COMMAND_ITEMS } from "./commandItems";
import { CommandPaletteItem } from "./menuTypes";
import { useTopMenuPermission } from "./menuPermissions";

interface SwitchToPanelProps {
  isOpen: boolean;
  currentPage: string;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

const SwitchToPanel: React.FC<SwitchToPanelProps> = ({
  isOpen,
  currentPage,
  onClose,
  onNavigate,
}) => {
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

  const switchable = useMemo(() => {
    return COMMAND_ITEMS.filter((item) => item.page && canAccess(item.permission, item.adminOnly));
  }, [canAccess]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return switchable.slice(0, 40);

    return switchable
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.page?.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [query, switchable]);

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
    if (!item.page) return;

    if (item.page === currentPage) {
      onClose();
      return;
    }

    const ok = window.confirm(
      `Switch to "${item.label}"?\n\nIf you have unsaved work, please save it first.`,
    );

    if (!ok) return;

    onNavigate(item.page);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/40 flex items-start justify-center pt-20"
      onMouseDown={onClose}
    >
      <div
        className="w-[620px] max-w-[calc(100vw-32px)] bg-[#EBF5E2] border border-[#000000] rounded-md shadow-2xl overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#D4EABD] border-b border-[#000000]">
          <div>
            <h2 className="text-[14px] font-bold text-[#000000] flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Switch To
            </h2>
            <p className="text-[11px] text-[#000000] mt-0.5">
              Replace current screen after confirming unsaved work.
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

        <div className="px-4 py-3 border-b border-[#000000]">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search screen to switch..."
            className="h-8 w-full border border-[#000000] bg-[#EBF5E2] px-3 text-[12px] focus:outline-none"
          />
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {filtered.map((item, index) => {
            const isCurrent = item.page === currentPage;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full flex items-center justify-between px-4 py-2.5 border-b border-[#000000] text-left"
                style={{
                  background: isCurrent
                    ? "#C9DEB5"
                    : activeIndex === index
                      ? "#D4EABD"
                      : "#EBF5E2",
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <div>
                  <div className="text-[12px] font-semibold text-[#000000]">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-[#000000] mt-0.5">
                    {item.category} · {item.page}
                  </div>
                </div>

                {isCurrent && (
                  <span className="text-[10px] font-bold border border-[#000000] rounded px-2 py-0.5 bg-[#EBF5E2]">
                    CURRENT
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SwitchToPanel;
