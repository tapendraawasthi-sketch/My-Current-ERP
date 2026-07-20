// @ts-nocheck
import { DualDate } from "../components/ui/DualDate";
import React, { useState, useMemo } from "react";
import { ReportWorkspace } from "@/features/reports";
import { Download, FileText, Search, Columns3 } from "lucide-react";
import { PaymentStatus, VoucherType } from "../lib/types";
import { formatCurrency, formatNumber } from "../lib/utils";
import NepaliDatePicker from "../components/ui/NepaliDatePicker";
import { useStore } from "../store/useStore";
import Pagination from "../components/ui/Pagination";
import { ReportEmptyState } from "../components/ReportEmptyState";
import { useBranchFilter } from "../hooks/useBranchFilter";

interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  width: string;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "invoiceNo", label: "Invoice no.", defaultVisible: true, width: "10%" },
  { key: "date", label: "Date", defaultVisible: true, width: "9%" },
  { key: "party", label: "Party", defaultVisible: true, width: "22%" },
  { key: "pan", label: "PAN", defaultVisible: false, width: "8%" },
  { key: "subTotal", label: "Sub total", defaultVisible: true, width: "10%" },
  { key: "discount", label: "Discount", defaultVisible: true, width: "9%" },
  { key: "taxable", label: "Taxable", defaultVisible: true, width: "10%" },
  { key: "exempt", label: "Exempt", defaultVisible: true, width: "10%" },
  { key: "vat", label: "VAT 13%", defaultVisible: true, width: "10%" },
  { key: "grandTotal", label: "Grand total", defaultVisible: true, width: "11%" },
  { key: "tds", label: "TDS", defaultVisible: false, width: "8%" },
  { key: "netAmount", label: "Net amount", defaultVisible: true, width: "11%" },
  { key: "status", label: "Status", defaultVisible: true, width: "8%" },
];

const AMOUNT_KEYS = new Set([
  "subTotal",
  "discount",
  "taxable",
  "exempt",
  "vat",
  "grandTotal",
  "tds",
  "netAmount",
]);

const th =
  "px-3 py-2.5 text-[12px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";

const paymentBadgeCls = (status: PaymentStatus) => {
  if (status === PaymentStatus.PAID) return "bg-green-100 text-green-700";
  if (status === PaymentStatus.PARTIAL) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
};

const SalesRegister: React.FC = () => {
  const { invoices } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const salesInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => inv.type === VoucherType.SALES_INVOICE || inv.type === VoucherType.SALES_RETURN,
    );
  }, [invoices]);

  const STORAGE_KEY = "sutra_sales_register_cols";
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
  });

  const toggleCol = (key: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const [showColPicker, setShowColPicker] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    partyId: "",
    paymentStatus: "all",
    itemId: "",
    taxCategory: "all",
    search: "",
  });

  const filteredInvoices = useMemo(() => {
    return salesInvoices.filter((invoice) => {
      if (!matchBranch((invoice as any).branchId)) return false;
      if (filters.paymentStatus !== "all" && invoice.paymentStatus !== filters.paymentStatus)
        return false;
      if (
        filters.search &&
        !invoice.invoiceNo.toLowerCase().includes(filters.search.toLowerCase()) &&
        !invoice.partyName.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [salesInvoices, filters, matchBranch, branchFilter]);

  const paginatedInvoices = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredInvoices.slice(startIndex, startIndex + pageSize);
  }, [filteredInvoices, page, pageSize]);

  const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;

  const visibleColumnList = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleCols.has(c.key)),
    [visibleCols],
  );

  const totals = useMemo(() => {
    return filteredInvoices.reduce(
      (acc, invoice) => ({
        subTotal: acc.subTotal + invoice.subTotal,
        discount: acc.discount + invoice.discountAmount,
        taxable: acc.taxable + invoice.taxableAmount,
        exempt: acc.exempt + invoice.exemptAmount,
        vat: acc.vat + invoice.vatAmount,
        grandTotal: acc.grandTotal + invoice.grandTotal,
        tds: acc.tds + (invoice.tdsAmount || 0),
        netAmount: acc.netAmount + (invoice.grandTotal - (invoice.tdsAmount || 0)),
      }),
      {
        subTotal: 0,
        discount: 0,
        taxable: 0,
        exempt: 0,
        vat: 0,
        grandTotal: 0,
        tds: 0,
        netAmount: 0,
      },
    );
  }, [filteredInvoices]);

  const handleExportIRD = () => {
    console.log("Export IRD Annex B format");
  };

  const renderCell = (col: ColumnDef, invoice: any) => {
    switch (col.key) {
      case "invoiceNo":
        return <span className="font-mono font-medium text-gray-700">{invoice.invoiceNo}</span>;
      case "date":
        return <DualDate date={invoice.date} dateNepali={invoice.dateNepali} />;
      case "party":
        return invoice.partyName;
      case "pan":
        return <span className="font-mono">{invoice.partyPan || "—"}</span>;
      case "subTotal":
        return formatNumber(invoice.subTotal);
      case "discount":
        return formatNumber(invoice.discountAmount || 0);
      case "taxable":
        return formatNumber(invoice.taxableAmount);
      case "exempt":
        return formatNumber(invoice.exemptAmount || 0);
      case "vat":
        return formatNumber(invoice.vatAmount);
      case "grandTotal":
        return formatNumber(invoice.grandTotal);
      case "tds":
        return formatNumber(invoice.tdsAmount || 0);
      case "netAmount":
        return formatNumber(invoice.grandTotal - (invoice.tdsAmount || 0));
      case "status":
        return (
          <span
            className={`rounded px-2 py-0.5 text-[12px] font-semibold uppercase ${paymentBadgeCls(invoice.paymentStatus)}`}
          >
            {invoice.paymentStatus}
          </span>
        );
      default:
        return null;
    }
  };

  const renderTotalCell = (col: ColumnDef) => {
    switch (col.key) {
      case "subTotal":
        return formatNumber(totals.subTotal);
      case "discount":
        return formatNumber(totals.discount);
      case "taxable":
        return formatNumber(totals.taxable);
      case "exempt":
        return formatNumber(totals.exempt);
      case "vat":
        return formatNumber(totals.vat);
      case "grandTotal":
        return formatNumber(totals.grandTotal);
      case "tds":
        return formatNumber(totals.tds);
      case "netAmount":
        return formatNumber(totals.netAmount);
      default:
        return null;
    }
  };

  const amountStartIdx = visibleColumnList.findIndex((c) => c.key === "subTotal");

  return (
    <ReportWorkspace
      title="Sales register"
      description="List of sales invoices."
      onPrint={() => window.print()}
      onExportExcel={handleExportIRD}
    >
      <div className="p-4 pb-0 shrink-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Total sales
            </p>
            <p className="text-[12px] number-cell-bold text-gray-700 mt-0.5">
              {formatCurrency(filteredInvoices.reduce((s, r) => s + (r.grandTotal || 0), 0))}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Invoices
            </p>
            <p className="text-[14px] font-semibold text-[var(--ds-action-primary)] mt-0.5">
              {filteredInvoices.length}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Total VAT
            </p>
            <p className="text-[12px] number-cell-bold text-gray-700 mt-0.5">
              {formatCurrency(filteredInvoices.reduce((s, r) => s + (r.vatAmount || 0), 0))}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
            <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              Posted
            </p>
            <p className="text-[14px] font-semibold text-green-700 mt-0.5">
              {filteredInvoices.filter((r) => r.status === "posted").length}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 shrink-0">
        <div className="no-print bg-white border border-gray-200 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">From date</label>
              <NepaliDatePicker
                value={filters.dateFrom}
                onChange={(value) => setFilters((prev) => ({ ...prev, dateFrom: value }))}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">To date</label>
              <NepaliDatePicker
                value={filters.dateTo}
                onChange={(value) => setFilters((prev) => ({ ...prev, dateTo: value }))}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Party</label>
              <input
                type="text"
                value={filters.partyId}
                onChange={(e) => setFilters((prev) => ({ ...prev, partyId: e.target.value }))}
                placeholder="Party name…"
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">
                Payment status
              </label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                className={`${inputCls} w-full`}
              >
                <option value="all">All statuses</option>
                <option value={PaymentStatus.PAID}>Paid</option>
                <option value={PaymentStatus.UNPAID}>Unpaid</option>
                <option value={PaymentStatus.PARTIAL}>Partial</option>
              </select>
            </div>
            {branchOptions.length > 0 && (
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">Branch</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className={`${inputCls} w-full`}
                >
                  <option value="all">All branches</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name || b.code || b.id}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Item</label>
              <input
                type="text"
                value={filters.itemId}
                onChange={(e) => setFilters((prev) => ({ ...prev, itemId: e.target.value }))}
                placeholder="Item…"
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">
                Tax category
              </label>
              <select
                value={filters.taxCategory}
                onChange={(e) => setFilters((prev) => ({ ...prev, taxCategory: e.target.value }))}
                className={`${inputCls} w-full`}
              >
                <option value="all">All categories</option>
                <option value="taxable">Taxable</option>
                <option value="exempt">Exempt</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Search invoice no. or party…"
                className={`${inputCls} w-full pl-8`}
              />
            </div>
            <span className="text-[12px] text-gray-500">
              {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-4 pb-4 flex flex-col">
        {filteredInvoices.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg flex-1">
            <ReportEmptyState
              message="No sales invoices found"
              hint="Adjust filters or create invoices from Billing."
            />
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="overflow-auto flex-1 min-h-0">
              <table className="data-table w-full min-w-[900px]">
                <colgroup>
                  {visibleColumnList.map((c) => (
                    <col key={c.key} style={{ width: c.width }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[var(--ds-surface-muted)]">
                  <tr>
                    {visibleColumnList.map((col) => (
                      <th
                        key={col.key}
                        className={`${th} ${AMOUNT_KEYS.has(col.key) ? "text-right" : "text-left"}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="group hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[var(--ds-action-primary)]"
                    >
                      {visibleColumnList.map((col) => (
                        <td
                          key={col.key}
                          className={`${td} ${AMOUNT_KEYS.has(col.key) ? "number-cell" : ""} ${col.key === "status" ? "text-center" : ""}`}
                        >
                          {renderCell(col, invoice)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--ds-action-primary)] border-t-2 border-[var(--ds-border-default)] font-bold text-[12px]">
                    {visibleColumnList.map((col, idx) => {
                      if (amountStartIdx > 0 && idx === 0) {
                        return (
                          <td
                            key="grand-label"
                            colSpan={amountStartIdx}
                            className="px-3 py-2.5 text-gray-700"
                          >
                            Grand total ({filteredInvoices.length} records)
                          </td>
                        );
                      }
                      if (amountStartIdx > 0 && idx > 0 && idx < amountStartIdx) return null;
                      if (amountStartIdx === -1 && idx === 0) {
                        return (
                          <td key="grand-label" className="px-3 py-2.5 text-gray-700">
                            Grand total ({filteredInvoices.length} records)
                          </td>
                        );
                      }
                      if (amountStartIdx === -1 && idx > 0 && !AMOUNT_KEYS.has(col.key)) {
                        return <td key={col.key} className="px-3 py-2.5" />;
                      }
                      if (AMOUNT_KEYS.has(col.key)) {
                        return (
                          <td
                            key={col.key}
                            className="number-cell-bold text-[var(--ds-action-primary)]"
                          >
                            {renderTotalCell(col)}
                          </td>
                        );
                      }
                      if (amountStartIdx <= 0 || idx >= amountStartIdx) {
                        return <td key={col.key} className="px-3 py-2.5" />;
                      }
                      return null;
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="px-3 py-2 border-t border-gray-200 bg-[var(--ds-surface-muted)] text-[12px] text-gray-500 shrink-0">
              {filteredInvoices.length} sales register record
              {filteredInvoices.length === 1 ? "" : "s"}
            </div>
          </div>
        )}

        {filteredInvoices.length > 0 && (
          <div className="mt-3 shrink-0">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalRecords={filteredInvoices.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>
    </ReportWorkspace>
  );
};

export default SalesRegister;
