// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Billing & Invoicing — tabbed register for:
 *   Sales Invoices · Purchase Invoices · Sales Returns · Purchase Returns
 */

import React, { useMemo, useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import SalesInvoiceForm from "../components/invoice/SalesInvoiceForm";
import { Plus } from "lucide-react";
import { generateInvoicePDF } from "../lib/printUtils";
import toast from "@/lib/appToast";
import { peekAiInvoiceDraft } from "@/ai/actions/invoiceDraft";
import { useSutraAiStore } from "@/store/sutraAiStore";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";
import { TAB_META, btnPrimary, inputCls, type TabKey } from "./billing/types";
import { BillingTabs } from "./billing/BillingTabs";
import { BillingFilterBar } from "./billing/BillingFilterBar";
import { BillingInvoiceTable } from "./billing/BillingInvoiceTable";

const BILLING_PAGES = new Set([
  "billing",
  "sales",
  "sales-invoice",
  "purchase-invoice",
  "sales-return",
  "purchase-return",
]);

const BillingInvoice: React.FC = () => {
  const { invoices, accounts, parties, companySettings, currentPage } = useStore();
  const { branchFilter, matchBranch } = useBranchFilter();
  const pendingInvoiceOpen = useSutraAiStore((s) => s.pendingInvoiceOpen);
  const clearPendingInvoiceOpen = useSutraAiStore((s) => s.clearPendingInvoiceOpen);
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [tab, setTab] = useState<TabKey>("sales");
  const [mode, setMode] = useState<"list" | "new" | "edit">("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editType, setEditType] = useState<TabKey>("sales");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [partyId, setPartyId] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(50);

  const meta = TAB_META[tab];

  useEffect(() => {
    if (currentPage === "sales-invoice") setTab("sales");
    else if (currentPage === "purchase-invoice") setTab("purchase");
    else if (currentPage === "sales-return") setTab("sales-return");
    else if (currentPage === "purchase-return") setTab("purchase-return");
  }, [currentPage]);

  // Deep link: /app/billing/new | /app/billing/:id
  useEffect(() => {
    if (!BILLING_PAGES.has(route.pageId)) return;
    if (route.entityId === "new") {
      setActiveId(null);
      setEditType(tab);
      setMode("new");
      return;
    }
    if (route.entityId) {
      const row = invoices.find((i) => i.id === route.entityId);
      if (row) {
        const t =
          (Object.entries(TAB_META) as [TabKey, { vt: string }][]).find(
            ([, m]) => m.vt === row.type,
          )?.[0] || "sales";
        setActiveId(row.id);
        setEditType(t);
        setTab(t);
        setMode("edit");
      }
      return;
    }
    if (mode !== "list") {
      setMode("list");
      setActiveId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from URL entity only
  }, [route.pageId, route.entityId, invoices]);

  useEffect(() => {
    const draft = peekAiInvoiceDraft();
    if (!draft && !pendingInvoiceOpen) return;
    if (!draft) return;
    const tabMap: Record<string, TabKey> = {
      sales: "sales",
      purchase: "purchase",
      "sales-return": "sales-return",
      "purchase-return": "purchase-return",
    };
    const t = tabMap[draft.type] ?? "sales";
    setTab(t);
    setEditType(t);
    setActiveId(null);
    setMode("new");
    openEntity(currentPage || "billing", "new");
    clearPendingInvoiceOpen();
  }, [pendingInvoiceOpen, currentPage, clearPendingInvoiceOpen, openEntity]);

  const handleTabChange = (k: TabKey) => {
    setTab(k);
    setSearchTerm("");
  };

  const filtered = useMemo(() => {
    return invoices
      .filter((i) => i.type === meta.vt)
      .filter((i) => matchBranch((i as { branchId?: string }).branchId))
      .filter((i) => !fromDate || i.date >= fromDate)
      .filter((i) => !toDate || i.date <= toDate)
      .filter((i) => !partyId || i.partyId === partyId)
      .filter((i) => paymentFilter === "ALL" || i.paymentStatus === paymentFilter)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [invoices, meta.vt, fromDate, toDate, partyId, paymentFilter, matchBranch, branchFilter]);

  const searched = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(
      (row) =>
        (row.invoiceNo || "").toLowerCase().includes(q) ||
        (row.partyName || "").toLowerCase().includes(q) ||
        (row.referenceNo || "").toLowerCase().includes(q) ||
        (row.narration || "").toLowerCase().includes(q),
    );
  }, [filtered, searchTerm]);

  const displayed = useMemo(() => searched.slice(0, pageSize), [searched, pageSize]);

  const openNew = () => {
    setActiveId(null);
    setEditType(tab);
    setMode("new");
    openEntity(currentPage || "billing", "new");
  };

  const openEdit = (row: any) => {
    const t =
      (Object.entries(TAB_META) as [TabKey, any][]).find(([, m]) => m.vt === row.type)?.[0] ||
      "sales";
    setActiveId(row.id);
    setEditType(t);
    setMode("edit");
    openEntity(currentPage || "billing", row.id);
  };

  const backToList = () => {
    setMode("list");
    setActiveId(null);
    clearEntity(currentPage || "billing");
  };

  const handlePrint = async (row: any) => {
    // Align browser URL with the invoice being printed (shareable deep link)
    if (row?.id) {
      openEntity(currentPage || "billing", row.id, { replace: true });
    }
    try {
      const blob = await generateInvoicePDF(row, companySettings, accounts, parties);
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch {
      toast.error("Failed to generate PDF.");
    }
  };

  const exportCsv = () => {
    const headers = ["Invoice No", "Date", "Party", "Grand Total", "VAT", "Payment", "Status"];
    const rows = searched.map((row) =>
      [
        row.invoiceNo,
        row.date,
        row.partyName,
        row.grandTotal,
        row.vatAmount,
        row.paymentStatus,
        row.status,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tab}-invoices.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (mode === "new" || mode === "edit") {
    return (
      <SalesInvoiceForm
        key={`${editType}-${activeId || "new"}`}
        invoiceId={mode === "edit" ? activeId! : undefined}
        type={editType}
        onSave={backToList}
        onCancel={backToList}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ds-surface-muted)]">
      <div className="p-4 pb-0 shrink-0">
        <div className="flex items-center justify-end gap-2 mb-3">
          <button type="button" className={btnPrimary} onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            New {meta.label.replace(/s$/, "")}
          </button>
        </div>

        <BillingTabs tab={tab} invoices={invoices} onChange={handleTabChange} />

        <BillingFilterBar
          fromDate={fromDate}
          toDate={toDate}
          partyId={partyId}
          paymentFilter={paymentFilter}
          searchTerm={searchTerm}
          pageSize={pageSize}
          recordCount={searched.length}
          onFromDate={setFromDate}
          onToDate={setToDate}
          onPartyId={setPartyId}
          onPaymentFilter={setPaymentFilter}
          onSearchTerm={setSearchTerm}
          onPageSize={setPageSize}
          onExport={exportCsv}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
        <BillingInvoiceTable
          tab={tab}
          rows={searched}
          displayed={displayed}
          symbol={symbol}
          cbmsEnabled={companySettings?.cbmsEnabled}
          hasActiveFilters={Boolean(
            searchTerm.trim() ||
              fromDate ||
              toDate ||
              partyId ||
              paymentFilter !== "ALL",
          )}
          onEdit={openEdit}
          onPrint={handlePrint}
          onNew={openNew}
          onClearFilters={() => {
            setSearchTerm("");
            setFromDate("");
            setToDate("");
            setPartyId("");
            setPaymentFilter("ALL");
          }}
        />
      </div>
    </div>
  );
};

export default BillingInvoice;
