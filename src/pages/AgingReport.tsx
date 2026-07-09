// @ts-nocheck
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "../lib/db";
import { useStore } from "../store/useStore";
import { consumeAiAgingReportDraft, peekAiAgingReportDraft } from "@/ai/actions/agingReportDraft";
import { buildSetPhoneHandoffQuery, saveAgingSetphoneReturnDraft } from "@/ai/actions/chatQueryDraft";
import { agingWaButtonLabel, formatAgingSearchPlaceholder, formatAgingReminderModalTitle, formatAgingRemindWaButton, formatAgingRemindCopyButton } from "@/ai/intelligence/DigestPinPreference";
import {
  formatPayableReminder,
  formatReceivableReminder,
  openWhatsAppShare,
  copyWhatsAppText,
} from "@/ai/conversation/WhatsAppShareFormatter";
import { useSutraAiStore } from "@/store/sutraAiStore";
import { FileSpreadsheet, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import ReportDateRangePicker, { DateRange } from "../components/ui/ReportDateRangePicker";
import { ReportEmptyState } from "../components/ReportEmptyState";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { mergeSystemConfiguration, getAgeingBucketIndex } from "../lib/systemConfiguration";
import { computeInvoiceOutstanding } from "../lib/accounting";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgingBucket {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}

interface AgingRow {
  partyId: string;
  partyName: string;
  partyPan?: string;
  partyPhone?: string;
  buckets: AgingBucket;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function daysDiff(dateStr: string, asOf: string): number {
  const d1 = new Date(dateStr);
  const d2 = new Date(asOf);
  const diff = d2.getTime() - d1.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function bucketAmount(days: number, amount: number, slabIndex?: number): Partial<AgingBucket> {
  const keys: (keyof Omit<AgingBucket, "total">)[] = [
    "current",
    "days1to30",
    "days31to60",
    "days61to90",
    "over90",
  ];
  const idx = slabIndex ?? (days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4);
  const key = keys[Math.min(idx, keys.length - 1)];
  return { [key]: amount };
}

function emptyBucket(): AgingBucket {
  return { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 };
}

function addBuckets(a: AgingBucket, b: Partial<AgingBucket>): AgingBucket {
  return {
    current: a.current + (b.current ?? 0),
    days1to30: a.days1to30 + (b.days1to30 ?? 0),
    days31to60: a.days31to60 + (b.days31to60 ?? 0),
    days61to90: a.days61to90 + (b.days61to90 ?? 0),
    over90: a.over90 + (b.over90 ?? 0),
    total: a.total,
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────

const AgingBar: React.FC<{ totals: AgingBucket; direction: "receivable" | "payable" }> = ({
  totals,
  direction,
}) => {
  const segments = [
    {
      label: "Current",
      value: totals.current,
      barClass: "bg-emerald-600",
      dotClass: "bg-emerald-600",
      valueClass: "text-emerald-700",
      pct: (totals.current / totals.total) * 100,
    },
    {
      label: "1-30 days",
      value: totals.days1to30,
      barClass: "bg-amber-600",
      dotClass: "bg-amber-600",
      valueClass: "text-amber-700",
      pct: (totals.days1to30 / totals.total) * 100,
    },
    {
      label: "31-60 days",
      value: totals.days31to60,
      barClass: "bg-orange-500",
      dotClass: "bg-orange-500",
      valueClass: "text-orange-600",
      pct: (totals.days31to60 / totals.total) * 100,
    },
    {
      label: "61-90 days",
      value: totals.days61to90,
      barClass: "bg-red-500",
      dotClass: "bg-red-500",
      valueClass: "text-red-600",
      pct: (totals.days61to90 / totals.total) * 100,
    },
    {
      label: "90+ days",
      value: totals.over90,
      barClass: "bg-red-900",
      dotClass: "bg-red-900",
      valueClass: "text-red-800",
      pct: (totals.over90 / totals.total) * 100,
    },
  ];

  const fmt = (n: number) =>
    "Rs. " +
    (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="mb-3 rounded-md border border-gray-200 bg-white px-4 py-3">
      <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {direction === "receivable" ? "Receivables" : "Payables"} Aging Overview — Total:{" "}
        {fmt(totals.total)}
      </div>

      <div className="mb-2.5 flex h-3 overflow-hidden rounded-full bg-gray-100">
        {segments.map((seg) =>
          seg.pct > 0 ? (
            <div
              key={seg.label}
              title={`${seg.label}: ${fmt(seg.value)} (${seg.pct.toFixed(1)}%)`}
              className={`${seg.barClass} transition-[width] duration-500`}
              style={{ width: `${seg.pct}%`, minWidth: seg.pct > 0 ? 2 : 0 }}
            />
          ) : null,
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 flex-shrink-0 rounded-[2px] ${seg.dotClass}`} />
            <span className="text-[10px] text-gray-700">{seg.label}</span>
            <span className={`font-mono text-[10px] font-bold ${seg.valueClass}`}>
              {fmt(seg.value)}
            </span>
            <span className="text-[9px] text-gray-400">({(seg.pct || 0).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AgingReport: React.FC = () => {
  const { parties, companySettings, currentPage } = useStore();
  const handoffAgingReminder = useSutraAiStore((s) => s.handoffAgingReminder);
  const handoffChatQuery = useSutraAiStore((s) => s.handoffChatQuery);
  const outputLanguage = useSutraAiStore((s) => s.languageConfig.outputLanguage);
  const ageingSlabs = mergeSystemConfiguration(companySettings?.systemConfiguration).ageingSlabs;
  const slabLabels = ageingSlabs.map((s) => s.label);

  const [dateRange, setDateRange] = useState<DateRange>({
    fromDate: todayISO(),
    toDate: todayISO(),
  });
  const asOfDate = dateRange.toDate;
  const [direction, setDirection] = useState<"receivable" | "payable">("receivable");
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handoffSetPhoneFromAging = (
    partyName: string,
    opts?: { outstanding?: number; daysOverdue?: number },
  ) => {
    saveAgingSetphoneReturnDraft({
      direction,
      searchTerm: partyName,
      outstanding: opts?.outstanding,
      daysOverdue: opts?.daysOverdue,
    });
    handoffChatQuery(buildSetPhoneHandoffQuery(partyName));
  };

  const applyAgingReportDraft = useCallback(() => {
    const draft = peekAiAgingReportDraft();
    if (!draft) return false;
    consumeAiAgingReportDraft();
    if (draft.direction) setDirection(draft.direction);
    if (draft.searchTerm) {
      setSearchTerm(draft.searchTerm);
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    return Boolean(draft.searchTerm);
  }, []);

  useEffect(() => {
    if (currentPage !== "aging-report") return;
    applyAgingReportDraft();
  }, [currentPage, applyAgingReportDraft]);

  const [reminderParty, setReminderParty] = useState<{
    name: string;
    phone?: string;
    outstanding: number;
    days: number;
  } | null>(null);

  const reminderShareText = useMemo(() => {
    if (!reminderParty) return "";
    const opts =
      reminderParty.days > 0 ? { daysOverdue: reminderParty.days } : undefined;
    return direction === "payable"
      ? formatPayableReminder(reminderParty.name, reminderParty.outstanding, "english", opts)
      : formatReceivableReminder(reminderParty.name, reminderParty.outstanding, "english", opts);
  }, [reminderParty, direction]);

  // Fix: use getDB() — default import, not named { db }
  const db = getDB();

  const invoiceType = direction === "receivable" ? "sales-invoice" : "purchase-invoice";
  const paymentType = direction === "receivable" ? "receipt" : "payment";

  // Fix: useLiveQuery from "dexie-react-hooks" — correct package
  const invoices = useLiveQuery(
    () => db.invoices.where("type").equals(invoiceType).toArray(),
    [invoiceType],
  );

  const payments = useLiveQuery(
    () => db.vouchers.where("type").equals(paymentType).toArray(),
    [paymentType],
  );

  // ── Build aging rows ──────────────────────────────────────────────────────
  const agingRows = useMemo<AgingRow[]>(() => {
    if (!invoices || !payments) return [];

    const partyMap = new Map<string, AgingRow>();

    for (const inv of invoices as any[]) {
      if (!inv || inv.status === "cancelled" || inv.status === "draft") continue;

      const originalAmount = Number(inv.grandTotal ?? inv.total ?? 0);
      if (originalAmount <= 0) continue;

      const balance = computeInvoiceOutstanding(inv, payments as any[]);
      if (balance <= 0.005) continue;

      // Days overdue from dueDate or invoice date
      const refDate = inv.dueDate ?? inv.date;
      const days = refDate ? daysDiff(refDate, asOfDate) : 0;
      const slabIndex = getAgeingBucketIndex(days, ageingSlabs);
      const bucket = bucketAmount(days, balance, slabIndex);

      const partyId = inv.partyId ?? "unknown";
      const partyName =
        inv.partyName ?? parties.find((p: any) => p.id === partyId)?.name ?? "Unknown";
      const partyPan = inv.partyPan ?? parties.find((p: any) => p.id === partyId)?.pan;
      const party = parties.find((p: any) => p.id === partyId);
      const partyPhone = party?.phone || party?.mobile;

      const existing = partyMap.get(partyId) ?? {
        partyId,
        partyName,
        partyPan,
        partyPhone,
        buckets: emptyBucket(),
      };

      existing.buckets = addBuckets(existing.buckets, bucket);
      existing.buckets.total =
        existing.buckets.current +
        existing.buckets.days1to30 +
        existing.buckets.days31to60 +
        existing.buckets.days61to90 +
        existing.buckets.over90;

      partyMap.set(partyId, existing);
    }

    return Array.from(partyMap.values()).sort((a, b) => b.buckets.total - a.buckets.total);
  }, [invoices, payments, asOfDate, parties, direction, ageingSlabs]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredRows = useMemo<AgingRow[]>(() => {
    if (!searchTerm.trim()) return agingRows;
    const q = searchTerm.toLowerCase();
    return agingRows.filter(
      (r) => r.partyName.toLowerCase().includes(q) || (r.partyPan ?? "").toLowerCase().includes(q),
    );
  }, [agingRows, searchTerm]);

  // ── Grand totals ──────────────────────────────────────────────────────────
  const grandTotal = useMemo<AgingBucket>(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        current: acc.current + row.buckets.current,
        days1to30: acc.days1to30 + row.buckets.days1to30,
        days31to60: acc.days31to60 + row.buckets.days31to60,
        days61to90: acc.days61to90 + row.buckets.days61to90,
        over90: acc.over90 + row.buckets.over90,
        total: acc.total + row.buckets.total,
      }),
      emptyBucket(),
    );
  }, [filteredRows]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    try {
      const companyName = companySettings?.name ?? "Company";
      const headers = [
        "Party Name",
        "PAN",
        "Current",
        "1-30 Days",
        "31-60 Days",
        "61-90 Days",
        "Over 90 Days",
        "Total",
      ];
      const rows = filteredRows.map((r) => [
        r.partyName,
        r.partyPan ?? "",
        r.buckets.current,
        r.buckets.days1to30,
        r.buckets.days31to60,
        r.buckets.days61to90,
        r.buckets.over90,
        r.buckets.total,
      ]);

      const wb = XLSX.utils.book_new();
      const wsData = [
        [companyName],
        [`Aging Report — ${direction === "receivable" ? "Receivables" : "Payables"}`],
        [`As of: ${asOfDate}`],
        [],
        headers,
        ...rows,
        [],
        [
          "TOTAL",
          "",
          grandTotal.current,
          grandTotal.days1to30,
          grandTotal.days31to60,
          grandTotal.days61to90,
          grandTotal.over90,
          grandTotal.total,
        ],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Aging Report");
      XLSX.writeFile(wb, `AgingReport_${asOfDate}.xlsx`);
      toast.success("Aging Report exported.");
    } catch {
      toast.error("Export failed.");
    }
  };

  const isLoading = !invoices || !payments;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="erp-report p-4 md:p-6 bg-[#f5f6fa] min-h-screen">
      {/* Header */}
      <div className="erp-report-toolbar flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Aging Report</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Outstanding {direction === "receivable" ? "receivables" : "payables"} by age bucket
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={filteredRows.length === 0}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Visual Stacked Bar */}
      {filteredRows.length > 0 && <AgingBar totals={grandTotal} direction={direction} />}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-white p-3">
        <div className="flex items-center rounded-md border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setDirection("receivable")}
            className={`h-8 px-3 text-[12px] font-medium transition-colors flex items-center gap-1.5 ${
              direction === "receivable"
                ? "bg-[#1557b0] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Receivables
          </button>
          <button
            type="button"
            onClick={() => setDirection("payable")}
            className={`h-8 px-3 text-[12px] font-medium transition-colors flex items-center gap-1.5 ${
              direction === "payable"
                ? "bg-[#1557b0] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            Payables
          </button>
        </div>

        <div>
          <ReportDateRangePicker
            value={dateRange}
            onChange={setDateRange}
            label="As Of Date (Uses To Date)"
            compact
          />
        </div>

        <div className="flex-1 min-w-[180px]">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={formatAgingSearchPlaceholder(outputLanguage)}
            className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-[12px]">Loading aging data…</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <ReportEmptyState
            message={`No outstanding ${direction === "receivable" ? "receivables" : "payables"} as of ${asOfDate}.`}
            hint="Try changing the as-of date or clearing the party search filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="report-table w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Party Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                    PAN
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Current
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    1–30 Days
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    31–60 Days
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    61–90 Days
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Over 90
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">
                    Total
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Contact
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-20">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row: AgingRow) => (
                  <tr key={row.partyId} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-[12px] font-semibold text-gray-800">
                      {row.partyName}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-gray-600">
                      {row.partyPan ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-green-700">
                      {row.buckets.current > 0 ? money(row.buckets.current) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-amber-600">
                      {row.buckets.days1to30 > 0 ? money(row.buckets.days1to30) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-orange-600">
                      {row.buckets.days31to60 > 0 ? money(row.buckets.days31to60) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-red-500">
                      {row.buckets.days61to90 > 0 ? money(row.buckets.days61to90) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold text-red-700">
                      {row.buckets.over90 > 0 ? money(row.buckets.over90) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-gray-800">
                      {money(row.buckets.total)}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-gray-700">
                      {row.partyPhone ? (
                        <a
                          href={`tel:${row.partyPhone}`}
                          className="font-mono text-[#1557b0] no-underline hover:text-[#0f4a96]"
                        >
                          {row.partyPhone}
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setReminderParty({
                              name: row.partyName || "Party",
                              phone: row.partyPhone,
                              outstanding: row.buckets.total,
                              days:
                                row.buckets.over90 > 0
                                  ? 90
                                  : row.buckets.days61to90 > 0
                                    ? 60
                                    : row.buckets.days31to60 > 0
                                      ? 30
                                      : 0,
                            })
                          }
                          className="h-6 whitespace-nowrap rounded border border-amber-300 bg-amber-50 px-2 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          Remind
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handoffAgingReminder({
                              partyName: row.partyName || "Party",
                              direction,
                              outstanding: row.buckets.total,
                              daysOverdue:
                                row.buckets.over90 > 0
                                  ? 90
                                  : row.buckets.days61to90 > 0
                                    ? 60
                                    : row.buckets.days31to60 > 0
                                      ? 30
                                      : undefined,
                            })
                          }
                          className="h-6 whitespace-nowrap rounded border border-[#c7d2fe] bg-[#eef2ff] px-1.5 text-[10px] font-semibold text-[#1557b0] hover:bg-[#e0e7ff]"
                          title="Open SUTRA AI with reminder"
                        >
                          SUTRA
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const partyName = row.partyName || "Party";
                            if (row.partyPhone) {
                              handoffAgingReminder({
                                partyName,
                                direction,
                                outstanding: row.buckets.total,
                                daysOverdue:
                                  row.buckets.over90 > 0
                                    ? 90
                                    : row.buckets.days61to90 > 0
                                      ? 60
                                      : row.buckets.days31to60 > 0
                                        ? 30
                                        : undefined,
                                autoOpenWhatsApp: true,
                              });
                            } else {
                              handoffSetPhoneFromAging(partyName, {
                                outstanding: row.buckets.total,
                                daysOverdue:
                                  row.buckets.over90 > 0
                                    ? 90
                                    : row.buckets.days61to90 > 0
                                      ? 60
                                      : row.buckets.days31to60 > 0
                                        ? 30
                                        : undefined,
                              });
                            }
                          }}
                          className="h-6 whitespace-nowrap rounded border px-1.5 text-[10px] font-semibold border-[#1557b0] bg-white text-[#1557b0] hover:bg-[#eef2ff]"
                          title={
                            row.partyPhone
                              ? "Open SUTRA AI and send via WhatsApp"
                              : `Set phone in SUTRA AI (${buildSetPhoneHandoffQuery(row.partyName || "Party").trim()})`
                          }
                        >
                          {agingWaButtonLabel(Boolean(row.partyPhone), outputLanguage)}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              {filteredRows.length > 0 && (
                <tfoot>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                    <td colSpan={2} className="px-3 py-2.5 text-[12px] font-bold text-gray-800">
                      Grand Total ({filteredRows.length} parties)
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-green-700">
                      {money(grandTotal.current)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-amber-600">
                      {money(grandTotal.days1to30)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-orange-600">
                      {money(grandTotal.days31to60)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-red-500">
                      {money(grandTotal.days61to90)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-red-700">
                      {money(grandTotal.over90)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-[#1557b0]">
                      {money(grandTotal.total)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {reminderParty && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
              <div>
                <h2 className="text-[14px] font-semibold text-gray-800">
                  {formatAgingReminderModalTitle(direction, outputLanguage)}
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">{reminderParty.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setReminderParty(null)}
                className="text-gray-400 hover:text-gray-700 font-bold text-[16px] leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed border border-gray-200 rounded-md bg-gray-50 p-3">
                {reminderShareText}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => openWhatsAppShare(reminderShareText, reminderParty.phone)}
                  className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
                >
                  {formatAgingRemindWaButton(Boolean(reminderParty.phone), outputLanguage)}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyWhatsAppText(reminderShareText);
                    if (ok) toast.success("Copied to clipboard");
                    else toast.error("Copy failed");
                  }}
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
                >
                  {formatAgingRemindCopyButton(outputLanguage)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handoffAgingReminder({
                      partyName: reminderParty.name,
                      direction,
                      outstanding: reminderParty.outstanding,
                      daysOverdue: reminderParty.days > 0 ? reminderParty.days : undefined,
                    });
                    setReminderParty(null);
                  }}
                  className="h-8 px-3 bg-[#eef2ff] border border-[#c7d2fe] text-[#1557b0] text-[12px] font-medium rounded-md hover:bg-[#e0e7ff]"
                  title="Open SUTRA AI with reminder"
                >
                  SUTRA AI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (reminderParty.phone) {
                      handoffAgingReminder({
                        partyName: reminderParty.name,
                        direction,
                        outstanding: reminderParty.outstanding,
                        daysOverdue: reminderParty.days > 0 ? reminderParty.days : undefined,
                        autoOpenWhatsApp: true,
                      });
                    } else {
                      handoffSetPhoneFromAging(reminderParty.name, {
                        outstanding: reminderParty.outstanding,
                        daysOverdue: reminderParty.days > 0 ? reminderParty.days : undefined,
                      });
                    }
                    setReminderParty(null);
                  }}
                  className="h-8 px-3 bg-white border text-[12px] font-medium rounded-md border-[#1557b0] text-[#1557b0] hover:bg-[#eef2ff]"
                  title={
                    reminderParty.phone
                      ? "Open SUTRA AI and send via WhatsApp"
                      : `Set phone in SUTRA AI (${buildSetPhoneHandoffQuery(reminderParty.name).trim()})`
                  }
                >
                  {agingWaButtonLabel(Boolean(reminderParty.phone), outputLanguage)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgingReport;
