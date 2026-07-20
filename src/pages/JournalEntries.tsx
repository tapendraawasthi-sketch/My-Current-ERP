// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Journal Vouchers — list & entry page.
 */

import { DualDate } from "../components/ui/DualDate";
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Select, NepaliDatePicker } from "../components/ui";
import JournalVoucherForm from "../components/voucher/JournalVoucherForm";
import { Plus, Eye, Search, Download, BookOpen } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { VoucherType, VoucherStatus } from "../lib/types";
import {
  BRANCH_CHANGED_EVENT,
  matchesBranchFilter,
  readActiveBranchId,
} from "../lib/activeBranch";
import { Button, EmptyState } from "@/design-system";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";

const PAGE_ID = "journal";

const th =
  "px-3 py-2.5 text-left text-[12px] font-semibold text-[var(--ds-text-muted)] uppercase tracking-wide";
const td =
  "px-3 py-2.5 text-[12px] text-[var(--ds-text-default)] border-b border-[var(--ds-border-subtle)]";
const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-[var(--ds-surface)] border border-[var(--ds-border-default)] text-[var(--ds-text-default)] text-[12px] font-medium rounded-lg hover:bg-[var(--ds-surface-muted)] inline-flex items-center gap-1.5";
const inputCls =
  "h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";

const statusBadge = (status: string) => {
  if (status === VoucherStatus.POSTED) return "bg-green-100 text-green-700";
  if (status === VoucherStatus.CANCELLED) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
};

const statusLabel = (status: string) => {
  if (status === VoucherStatus.POSTED) return "Posted";
  if (status === VoucherStatus.CANCELLED) return "Cancelled";
  if (status === VoucherStatus.DRAFT) return "Draft";
  return status || "—";
};

const JournalEntries: React.FC = () => {
  const { vouchers, companySettings, branches } = useStore();
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [mode, setMode] = useState<"list" | "new" | "edit">("list");
  const [activeId, setActiveId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [branchFilter, setBranchFilter] = useState(() => readActiveBranchId() || "all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    const sync = () => {
      const id = readActiveBranchId();
      if (id) setBranchFilter(id);
    };
    window.addEventListener(BRANCH_CHANGED_EVENT, sync as EventListener);
    return () => window.removeEventListener(BRANCH_CHANGED_EVENT, sync as EventListener);
  }, []);

  const journals = useMemo(
    () => vouchers.filter((v) => v.type === VoucherType.JOURNAL),
    [vouchers],
  );

  // Deep link: /app/journal/new | /app/journal/:id
  useEffect(() => {
    if (route.pageId !== PAGE_ID) return;
    if (route.entityId === "new") {
      setActiveId(null);
      setMode("new");
      return;
    }
    if (route.entityId) {
      const row = journals.find((v) => v.id === route.entityId);
      if (row) {
        setActiveId(row.id);
        setMode("edit");
      }
      return;
    }
    if (mode !== "list") {
      setMode("list");
      setActiveId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from URL entity only
  }, [route.pageId, route.entityId, journals]);

  const filtered = useMemo(() => {
    return journals
      .filter((v) => statusFilter === "ALL" || v.status === statusFilter)
      .filter((v) => matchesBranchFilter((v as any).branchId, branchFilter))
      .filter((v) => !fromDate || v.date >= fromDate)
      .filter((v) => !toDate || v.date <= toDate)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [journals, statusFilter, branchFilter, fromDate, toDate]);

  const branchOptions = useMemo(
    () => ((branches || []) as any[]).filter((b) => b && b.isActive !== false),
    [branches],
  );

  const searched = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(
      (row) =>
        (row.voucherNo || "").toLowerCase().includes(q) ||
        (row.narration || "").toLowerCase().includes(q) ||
        (row.referenceNo || "").toLowerCase().includes(q),
    );
  }, [filtered, searchTerm]);

  const displayed = useMemo(() => searched.slice(0, pageSize), [searched, pageSize]);

  const openNew = () => {
    setActiveId(null);
    setMode("new");
    openEntity(PAGE_ID, "new");
  };
  const openEdit = (row: any) => {
    setActiveId(row.id);
    setMode("edit");
    openEntity(PAGE_ID, row.id);
  };
  const backToList = () => {
    setMode("list");
    setActiveId(null);
    clearEntity(PAGE_ID);
  };

  const exportCsv = () => {
    const headers = ["Voucher No", "Date", "Narration", "Debit", "Credit", "Status"];
    const rows = searched.map((row) =>
      [row.voucherNo, row.date, row.narration, row.totalDebit, row.totalCredit, row.status]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "journal-vouchers.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (mode === "new" || mode === "edit") {
    return (
      <JournalVoucherForm
        voucherId={mode === "edit" ? activeId! : undefined}
        onSave={backToList}
        onCancel={backToList}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ds-surface-muted)]">
      <div className="p-4 pb-0 shrink-0">
        <div className="flex items-center justify-end mb-3">
          <button type="button" className={btnPrimary} onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            New journal entry
          </button>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2 mb-3 p-3 bg-white border border-gray-200 rounded-lg">
          <span className="text-[12px] text-gray-500">From</span>
          <div className="w-32">
            <NepaliDatePicker value={fromDate} onChange={setFromDate} />
          </div>
          <span className="text-[12px] text-gray-500">To</span>
          <div className="w-32">
            <NepaliDatePicker value={toDate} onChange={setToDate} />
          </div>
          <span className="text-[12px] text-gray-500">Status</span>
          <div className="w-36">
            <Select
              options={[
                { value: "ALL", label: "All statuses" },
                { value: VoucherStatus.DRAFT, label: "Draft" },
                { value: VoucherStatus.POSTED, label: "Posted" },
                { value: VoucherStatus.CANCELLED, label: "Cancelled" },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
          {branchOptions.length > 0 && (
            <>
              <span className="text-[12px] text-gray-500">Branch</span>
              <div className="w-40">
                <Select
                  options={[
                    { value: "all", label: "All branches" },
                    ...branchOptions.map((b: any) => ({
                      value: b.id,
                      label: b.name || b.code || b.id,
                    })),
                  ]}
                  value={branchFilter}
                  onChange={setBranchFilter}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search voucher no or narration…"
              className={`${inputCls} w-full pl-8`}
            />
          </div>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className={inputCls}
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
          <span className="text-[12px] text-gray-500 whitespace-nowrap">
            {searched.length} record{searched.length === 1 ? "" : "s"}
          </span>
          <button type="button" className={btnOutline} onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
        {searched.length === 0 ? (
          <div className="rounded-lg border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-2">
            <EmptyState
              icon={
                searchTerm.trim() || fromDate || toDate || statusFilter !== "ALL" ? (
                  <Search className="h-4 w-4" aria-hidden />
                ) : (
                  <BookOpen className="h-4 w-4" aria-hidden />
                )
              }
              title={
                journals.length === 0
                  ? "No journal vouchers yet"
                  : "No journal vouchers match your filters"
              }
              description={
                journals.length === 0
                  ? "Post a double-entry journal to adjust ledgers or record non-cash movements."
                  : "Clear search or adjust status and dates to see more vouchers."
              }
              primaryAction={
                journals.length === 0 ? (
                  <Button
                    variant="primary"
                    size="small"
                    onClick={openNew}
                    startIcon={<Plus className="h-3.5 w-3.5" />}
                  >
                    New journal entry
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      setSearchTerm("");
                      setFromDate("");
                      setToDate("");
                      setStatusFilter("ALL");
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                    <th className={th}>Voucher no</th>
                    <th className={th}>Date</th>
                    <th className={th}>Narration</th>
                    <th className={`${th} text-right`}>Debit</th>
                    <th className={`${th} text-right`}>Credit</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((row) => (
                    <tr
                      key={row.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[var(--ds-action-primary)]"
                      onClick={() => openEdit(row)}
                    >
                      <td className={`${td} font-mono font-medium text-gray-700`}>
                        {row.voucherNo}
                      </td>
                      <td className={td}>
                        <DualDate
                          date={row.date || row.adDate}
                          dateNepali={row.dateNepali || row.bsDate}
                        />
                      </td>
                      <td className={`${td} text-gray-500 max-w-[260px] truncate`}>
                        {row.narration || "—"}
                      </td>
                      <td className={`${td} font-mono text-right`}>
                        {symbol} {formatNumber(row.totalDebit || 0)}
                      </td>
                      <td className={`${td} font-mono text-right`}>
                        {symbol} {formatNumber(row.totalCredit || 0)}
                      </td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[12px] font-medium ${statusBadge(row.status)}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(row);
                          }}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="View / edit"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 border-t border-gray-200 bg-[var(--ds-surface-muted)] text-[12px] text-gray-500">
              Showing {displayed.length} of {searched.length} journal vouchers
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JournalEntries;
