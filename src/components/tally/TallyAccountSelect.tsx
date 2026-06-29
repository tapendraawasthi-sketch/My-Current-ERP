import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import QuickCreateAccountModal from "../ui/QuickCreateAccountModal";

interface Props {
  value: string;
  onChange: (accountId: string, accountName: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  groupFilter?: "cash" | "bank" | "all";
  onCreate?: (name: string) => void;
}

export const TallyAccountSelect: React.FC<Props> = ({
  value,
  onChange,
  placeholder = "Select Account",
  autoFocus,
  groupFilter = "all",
  onCreate,
}) => {
  const { accounts } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    let list = accounts || [];
    if (groupFilter === "cash")
      list = list.filter((a) => a.group === "Cash" || a.name.toLowerCase().includes("cash"));
    if (groupFilter === "bank")
      list = list.filter((a) => a.group === "Bank" || a.name.toLowerCase().includes("bank"));
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (a) => a.name.toLowerCase().includes(q) || a.group?.toLowerCase().includes(q),
    );
  }, [accounts, query, groupFilter]);

  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  const selectedName = useMemo(() => {
    return (accounts || []).find((a) => a.id === value)?.name || "";
  }, [accounts, value]);

  const handleSelect = (a: { id: string; name: string }) => {
    onChange(a.id, a.name);
    setQuery("");
    setOpen(false);
  };

  const handleQuickCreate = () => {
    setShowCreate(true);
    setOpen(false);
  };

  const handleCreated = (name: string) => {
    setShowCreate(false);
    if (onCreate) onCreate(name);
  };

  return (
    <div ref={ref} className="relative h-full w-full">
      <input
        ref={inputRef}
        className="tally-input"
        value={open ? query : selectedName}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery(selectedName);
        }}
        onKeyDown={(e) => {
          if (e.key === "Alt" && e.key.toLowerCase() === "c") {
            e.preventDefault();
            handleQuickCreate();
          }
          if (e.key === "Escape") setOpen(false);
          if (e.key === "ArrowDown" && filtered.length) {
            e.preventDefault();
            // focus first list item handled by list itself
          }
        }}
      />
      {open && (
        <div className="tally-popup absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-sm shadow-lg">
          <div className="tally-popup-title flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Search size={12} /> Select Account
            </span>
            <button
              className="tally-btn text-xs flex items-center gap-1"
              onClick={handleQuickCreate}
            >
              <Plus size={12} /> Alt+C New
            </button>
          </div>
          {filtered.length === 0 ? (
            <div className="p-2 text-xs text-tally-600">
              No accounts found.
              <button className="tally-btn ml-2 text-xs" onClick={handleQuickCreate}>
                Create
              </button>
            </div>
          ) : (
            <ul className="text-sm">
              {filtered.map((a) => (
                <li
                  key={a.id}
                  className="cursor-pointer px-3 py-1 hover:bg-tally-200 border-b border-tally-100 last:border-0"
                  onClick={() => handleSelect(a)}
                >
                  <span className="font-medium">{a.name}</span>
                  <span className="ml-2 text-xs text-tally-600">({a.group})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {showCreate && (
        <QuickCreateAccountModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

export default TallyAccountSelect;
