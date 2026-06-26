import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useTopbarStore } from "@/store/topbarStore";

interface CommandItem {
  label: string;
  category: "Reports" | "Vouchers" | "Masters" | "Actions";
  page?: string;
  action?: string;
  shortcut?: string;
  disabled?: boolean;
}

const GO_TO_ITEMS: CommandItem[] = [
  // Reports
  { label: "Trial Balance", category: "Reports", page: "trial-balance" },
  { label: "Profit & Loss", category: "Reports", page: "profit-loss" },
  { label: "Balance Sheet", category: "Reports", page: "balance-sheet" },
  { label: "Cash Flow Statement", category: "Reports", page: "cash-flow" },
  { label: "Day Book", category: "Reports", page: "day-book" },
  { label: "Cash Book", category: "Reports", page: "cash-book" },
  { label: "Bank Book", category: "Reports", page: "bank-book" },
  { label: "Ledger Report", category: "Reports", page: "ledger" },
  { label: "Sales Register", category: "Reports", page: "sales-register" },
  { label: "Purchase Register", category: "Reports", page: "purchase-register" },
  { label: "Stock Summary", category: "Reports", page: "stock-summary" },
  { label: "VAT Report", category: "Reports", page: "vat-reports" },
  { label: "TDS Report", category: "Reports", page: "tds-report" },
  { label: "Payroll Report", category: "Reports", page: "payroll-run" },

  // Vouchers
  { label: "Sales Invoice", category: "Vouchers", page: "sales-invoice" },
  { label: "Purchase Invoice", category: "Vouchers", page: "purchase-invoice" },
  { label: "Sales Return", category: "Vouchers", page: "sales-return" },
  { label: "Purchase Return", category: "Vouchers", page: "purchase-return" },
  { label: "Payment Voucher", category: "Vouchers", page: "payment" },
  { label: "Receipt Voucher", category: "Vouchers", page: "receipt" },
  { label: "Journal Entry", category: "Vouchers", page: "journal" },
  { label: "Contra Entry", category: "Vouchers", page: "contra" },
  { label: "Debit Note", category: "Vouchers", page: "debit-note" },
  { label: "Credit Note", category: "Vouchers", page: "credit-note" },

  // Masters
  { label: "Create Ledger", category: "Masters", page: "accounts", action: "create-ledger" },
  { label: "Alter Ledger", category: "Masters", page: "accounts" },
  { label: "Stock Items", category: "Masters", page: "items" },
  { label: "Customers", category: "Masters", page: "parties" },
  { label: "Suppliers", category: "Masters", page: "parties" },
  { label: "Employees", category: "Masters", page: "employees" },
  { label: "Cost Centers", category: "Masters", page: "cost-centers" },
  { label: "Bank Accounts", category: "Masters", page: "bank-accounts" },

  // Actions
  { label: "Backup Data", category: "Actions", action: "backup" },
  { label: "Export Current", category: "Actions", action: "export" },
  { label: "Company Features", category: "Actions", shortcut: "F11", action: "company-features" },
  { label: "Security Control", category: "Actions", action: "security" },
];

const RECENTS_KEY = "goToRecents";

function getStoredRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveRecent(label: string) {
  const current = getStoredRecents();
  const next = [label, ...current.filter((item) => item !== label)].slice(0, 5);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

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

function groupItems(items: CommandItem[]) {
  return items.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
}

export default function GoToPanel({ onClose }: { onClose: () => void }) {
  const setCurrentPage = useStore((state) => state.setCurrentPage);
  const setOpenMenu = useTopbarStore((state) => state.setOpenMenu);
  const setGoToOpen = useTopbarStore((state) => state.setGoToOpen);

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const recents = useMemo(() => getStoredRecents(), []);

  const visibleItems = useMemo(() => {
    if (!query.trim()) {
      const recentItems = recents
        .map((label) => GO_TO_ITEMS.find((item) => item.label === label))
        .filter((item): item is CommandItem => Boolean(item));

      return recentItems.length ? recentItems : GO_TO_ITEMS.slice(0, 8);
    }

    const normalized = query.toLowerCase();

    return GO_TO_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized),
    ).slice(0, 40);
  }, [query, recents]);

  const grouped = useMemo(() => groupItems(visibleItems), [visibleItems]);

  const flatItems = visibleItems;

  const executeItem = (item: CommandItem) => {
    if (item.disabled) return;

    saveRecent(item.label);

    if (item.page) {
      setCurrentPage(item.page);
      setGoToOpen(false);
      onClose();
      return;
    }

    if (item.action === "backup") {
      setOpenMenu("data");
      setGoToOpen(false);
      onClose();
      return;
    }

    if (item.action === "export") {
      setOpenMenu("export");
      setGoToOpen(false);
      onClose();
      return;
    }

    if (item.action === "company-features") {
      window.dispatchEvent(new CustomEvent("topbar:company-action", { detail: "features" }));
      setOpenMenu("company");
      setGoToOpen(false);
      onClose();
      return;
    }

    if (item.action === "security") {
      window.dispatchEvent(new CustomEvent("topbar:company-action", { detail: "security" }));
      setOpenMenu("company");
      setGoToOpen(false);
      onClose();
    }
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
  }, [flatItems, onClose, selectedIndex]);

  let runningIndex = 0;

  return createPortal(
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
            placeholder="Search reports, vouchers, masters, actions..."
            className="h-9 flex-1 border-0 bg-transparent text-[13px] text-gray-800 outline-none"
          />
          <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500">
            Esc
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto py-2">
          {!query.trim() && recents.length > 0 && (
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase text-gray-400">
              Recently Used
            </div>
          )}

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
                    disabled={item.disabled}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                    onClick={() => executeItem(item)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left ${
                      active ? "bg-[#eef2ff]" : "hover:bg-gray-50"
                    } ${item.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    <div>
                      <div className="text-[12px] font-medium text-gray-800">
                        {highlightMatch(item.label, query)}
                      </div>
                      <div className="text-[10px] text-gray-500">{item.category}</div>
                    </div>

                    {item.shortcut && (
                      <span className="font-mono text-[10px] text-gray-400">{item.shortcut}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {visibleItems.length === 0 && (
            <div className="px-3 py-10 text-center text-[12px] text-gray-500">
              No matching command found.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
