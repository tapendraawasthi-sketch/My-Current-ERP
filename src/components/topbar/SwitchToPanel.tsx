import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useTopbarStore } from "@/store/topbarStore";
import { ModalShell, OutlineButton, PrimaryButton } from "./shared";

interface SwitchItem {
  label: string;
  category: "Reports" | "Vouchers" | "Masters" | "Admin";
  page: string;
  shortcut?: string;
}

const SWITCH_ITEMS: SwitchItem[] = [
  { label: "Dashboard", category: "Reports", page: "dashboard" },
  { label: "Account totals check", category: "Reports", page: "trial-balance" },
  { label: "Profit & loss", category: "Reports", page: "profit-loss" },
  { label: "What you own & owe", category: "Reports", page: "balance-sheet" },
  { label: "Cash flow", category: "Reports", page: "cash-flow" },
  { label: "Today's transactions", category: "Reports", page: "day-book" },
  { label: "Cash Book", category: "Reports", page: "cash-book" },
  { label: "Bank Book", category: "Reports", page: "bank-book" },
  { label: "General Ledger", category: "Reports", page: "ledger" },
  { label: "Sales register", category: "Reports", page: "sales-register" },
  { label: "Purchase register", category: "Reports", page: "purchase-register" },
  { label: "VAT reports", category: "Reports", page: "vat-reports" },
  { label: "Stock summary", category: "Reports", page: "stock-summary" },

  { label: "Sales invoice", category: "Vouchers", page: "sales-invoice" },
  { label: "Purchase invoice", category: "Vouchers", page: "purchase-invoice" },
  { label: "Payment Voucher", category: "Vouchers", page: "payment" },
  { label: "Receipt Voucher", category: "Vouchers", page: "receipt" },
  { label: "Journal Entry", category: "Vouchers", page: "journal" },
  { label: "Contra Entry", category: "Vouchers", page: "contra" },

  { label: "Chart of Accounts", category: "Masters", page: "accounts" },
  { label: "Parties Directory", category: "Masters", page: "parties" },
  { label: "Stock Book", category: "Masters", page: "items" },
  { label: "Warehouses", category: "Masters", page: "warehouses" },
  { label: "Units", category: "Masters", page: "units" },
  { label: "Employees", category: "Masters", page: "employees" },

  { label: "Company settings", category: "Admin", page: "settings" },
  { label: "Fiscal Year", category: "Admin", page: "fiscal-year" },
  { label: "Users", category: "Admin", page: "users" },
  { label: "Audit log", category: "Admin", page: "audit-log" },
  { label: "Backup & restore", category: "Admin", page: "backup" },
];

function highlightMatch(label: string, query: string): ReactNode {
  if (!query.trim()) return label;

  const lowerLabel = label.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerLabel.indexOf(lowerQuery);

  if (index === -1) return label;

  return (
    <>
      {label.slice(0, index)}
      <span className="bg-amber-100 text-gray-900">{label.slice(index, index + query.length)}</span>
      {label.slice(index + query.length)}
    </>
  );
}

function groupItems(items: SwitchItem[]) {
  return items.reduce<Record<string, SwitchItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
}

export default function SwitchToPanel({ onClose }: { onClose: () => void }) {
  const setCurrentPage = useStore((state) => state.setCurrentPage);
  const hasUnsavedChanges = useTopbarStore((state) => state.hasUnsavedChanges);
  const setHasUnsavedChanges = useTopbarStore((state) => state.setHasUnsavedChanges);
  const setSwitchToOpen = useTopbarStore((state) => state.setSwitchToOpen);

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingItem, setPendingItem] = useState<SwitchItem | null>(null);

  const visibleItems = useMemo(() => {
    if (!query.trim()) return SWITCH_ITEMS.slice(0, 12);

    const normalized = query.toLowerCase();

    return SWITCH_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized),
    ).slice(0, 40);
  }, [query]);

  const grouped = useMemo(() => groupItems(visibleItems), [visibleItems]);
  const flatItems = visibleItems;

  const navigateTo = (item: SwitchItem) => {
    setCurrentPage(item.page);
    setSwitchToOpen(false);
    onClose();
  };

  const executeItem = (item: SwitchItem) => {
    if (hasUnsavedChanges) {
      setPendingItem(item);
      return;
    }

    navigateTo(item);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, Math.max(flatItems.length - 1, 0)));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) executeItem(item);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flatItems, hasUnsavedChanges, onClose, selectedIndex]);

  let runningIndex = 0;

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[180] flex items-start justify-center bg-black/60 px-4 pt-20">
          <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex h-11 items-center gap-2 border-b border-gray-200 px-3">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Switch to screen..."
                className="h-9 flex-1 border-0 bg-transparent text-[13px] text-gray-800 outline-none"
              />
              <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500">
                Esc
              </kbd>
            </div>

            <div className="max-h-[360px] overflow-y-auto py-2">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {category}
                  </div>

                  {items.map((item) => {
                    const currentIndex = runningIndex;
                    runningIndex += 1;

                    const active = selectedIndex === currentIndex;

                    return (
                      <button
                        key={`${category}-${item.label}`}
                        type="button"
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        onClick={() => executeItem(item)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left ${
                          active ? "bg-[#eef2ff]" : "hover:bg-gray-50"
                        }`}
                      >
                        <div>
                          <div className="text-[12px] font-medium text-gray-800">
                            {highlightMatch(item.label, query)}
                          </div>
                          <div className="text-[10px] text-gray-500">{item.category}</div>
                        </div>

                        {item.shortcut && (
                          <span className="font-mono text-[10px] text-gray-400">
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {visibleItems.length === 0 && (
                <div className="px-3 py-10 text-center text-[12px] text-gray-500">
                  No matching screen found.
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {pendingItem && (
        <ModalShell
          title="Unsaved Changes"
          onClose={() => setPendingItem(null)}
          footer={
            <>
              <OutlineButton onClick={() => setPendingItem(null)}>Cancel</OutlineButton>
              <OutlineButton
                onClick={() => {
                  setHasUnsavedChanges(false);
                  navigateTo(pendingItem);
                }}
              >
                Discard
              </OutlineButton>
              <PrimaryButton
                onClick={() => {
                  setHasUnsavedChanges(false);
                  navigateTo(pendingItem);
                }}
              >
                Save
              </PrimaryButton>
            </>
          }
        >
          <p className="text-[12px] text-gray-700">
            You have unsaved changes. Save before switching?
          </p>
        </ModalShell>
      )}
    </>
  );
}
