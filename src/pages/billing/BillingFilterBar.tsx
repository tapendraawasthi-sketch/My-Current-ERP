import React from "react";
import { Search, Download } from "lucide-react";
import { Select, NepaliDatePicker, PartySelect } from "../../components/ui";
import { PaymentStatus } from "../../lib/types";
import { btnOutline, inputCls } from "./types";

type Props = {
  fromDate: string;
  toDate: string;
  partyId: string;
  paymentFilter: string;
  searchTerm: string;
  pageSize: number;
  recordCount: number;
  onFromDate: (v: string) => void;
  onToDate: (v: string) => void;
  onPartyId: (v: string) => void;
  onPaymentFilter: (v: string) => void;
  onSearchTerm: (v: string) => void;
  onPageSize: (v: number) => void;
  onExport: () => void;
};

export function BillingFilterBar({
  fromDate,
  toDate,
  partyId,
  paymentFilter,
  searchTerm,
  pageSize,
  recordCount,
  onFromDate,
  onToDate,
  onPartyId,
  onPaymentFilter,
  onSearchTerm,
  onPageSize,
  onExport,
}: Props) {
  return (
    <>
      <div className="no-print flex flex-wrap items-center gap-2 mb-3 p-3 bg-white border border-gray-200 rounded-lg">
        <span className="text-[12px] text-gray-500">From</span>
        <div className="w-32">
          <NepaliDatePicker value={fromDate} onChange={onFromDate} />
        </div>
        <span className="text-[12px] text-gray-500">To</span>
        <div className="w-32">
          <NepaliDatePicker value={toDate} onChange={onToDate} />
        </div>
        <span className="text-[12px] text-gray-500">Party</span>
        <div className="w-48">
          <PartySelect value={partyId} onChange={onPartyId} placeholder="All parties" />
        </div>
        <span className="text-[12px] text-gray-500">Payment</span>
        <div className="w-32">
          <Select
            options={[
              { value: "ALL", label: "All" },
              { value: PaymentStatus.PAID, label: "Paid" },
              { value: PaymentStatus.PARTIAL, label: "Partial" },
              { value: PaymentStatus.UNPAID, label: "Unpaid" },
            ]}
            value={paymentFilter}
            onChange={onPaymentFilter}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTerm(e.target.value)}
            placeholder="Search invoice no, party or reference…"
            data-testid="billing-search"
            aria-label="Search invoices"
            className={`${inputCls} w-full pl-8`}
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className={inputCls}
        >
          <option value={25}>25 rows</option>
          <option value={50}>50 rows</option>
          <option value={100}>100 rows</option>
        </select>
        <span className="text-[12px] text-gray-500 whitespace-nowrap">
          {recordCount} record{recordCount === 1 ? "" : "s"}
        </span>
        <button type="button" className={btnOutline} onClick={onExport}>
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>
    </>
  );
}
