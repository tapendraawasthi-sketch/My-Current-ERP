import React from "react";
import type { Invoice } from "../../lib/types";
import { TAB_META, type TabKey } from "./types";

type Props = {
  tab: TabKey;
  invoices: Invoice[];
  onChange: (tab: TabKey) => void;
};

export function BillingTabs({ tab, invoices, onChange }: Props) {
  return (
    <div className="flex gap-1 mb-3 bg-white border border-gray-200 rounded-lg p-1 w-fit flex-wrap">
      {(Object.keys(TAB_META) as TabKey[]).map((k) => {
        const m = TAB_META[k];
        const count = invoices.filter((i) => i.type === m.vt).length;
        const active = tab === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={`flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${
              active ? "bg-[var(--ds-action-primary)] text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {m.label}
            <span
              className={`text-[12px] px-1.5 py-0.5 rounded font-semibold ${
                active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
