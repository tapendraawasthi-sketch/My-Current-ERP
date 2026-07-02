// @ts-nocheck
import { DualDate } from "../components/ui/DualDate";
import React, { useState, useMemo } from "react";
import { ActionToolbar } from "../components/ui";
import { Filter, Download, Eye, Edit, FileText } from "lucide-react";
import SearchableTable from "../components/ui/SearchableTable";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Select from "../components/ui/Select";
import Input from "../components/ui/Input";
import Card from "../components/ui/Card";
import { PaymentStatus, VoucherType, Invoice } from "../lib/types";
import { formatCurrency, formatNumber } from "../lib/utils";
import NepaliDatePicker from "../components/ui/NepaliDatePicker";
import { useStore } from "../store/useStore";
import Pagination from "../components/ui/Pagination";


interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  width: string;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "invoiceNo",  label: "Invoice No",  defaultVisible: true,  width: "10%" },
  { key: "date",       label: "Date",        defaultVisible: true,  width: "9%"  },
  { key: "party",      label: "Party",       defaultVisible: true,  width: "22%" },
  { key: "pan",        label: "PAN",         defaultVisible: false, width: "8%"  },
  { key: "subTotal",   label: "Sub Total",   defaultVisible: true,  width: "10%" },
  { key: "discount",   label: "Discount",    defaultVisible: true,  width: "9%" },
  { key: "taxable",    label: "Taxable",     defaultVisible: true,  width: "10%" },
  { key: "exempt",     label: "Exempt",      defaultVisible: true,  width: "10%" },
  { key: "vat",        label: "VAT 13%",     defaultVisible: true,  width: "10%" },
  { key: "grandTotal", label: "Grand Total", defaultVisible: true,  width: "11%" },
  { key: "tds",        label: "TDS",         defaultVisible: false, width: "8%"  },
  { key: "netAmount",  label: "Net Amount",  defaultVisible: true,  width: "11%" },
  { key: "status",     label: "Status",      defaultVisible: true,  width: "8%"  },
];

const SalesRegister: React.FC = () => {
  const { invoices } = useStore();
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
  }, [salesInvoices, filters]);

  const paginatedInvoices = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredInvoices.slice(startIndex, startIndex + pageSize);
  }, [filteredInvoices, page, pageSize]);

  const totalPages = Math.ceil(filteredInvoices.length / pageSize);

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

  const summaryStats = useMemo(() => {
    const totalSales = filteredInvoices
      .filter((inv) => inv.type === VoucherType.SALES_INVOICE)
      .reduce((sum, inv) => sum + inv.grandTotal, 0);

    const totalVAT = filteredInvoices.reduce((sum, inv) => sum + inv.vatAmount, 0);

    const totalOutstanding = filteredInvoices
      .filter((inv) => inv.paymentStatus !== PaymentStatus.PAID)
      .reduce((sum, inv) => sum + (inv.grandTotal - (inv.paidAmount || 0)), 0);

    return { totalSales, totalVAT, totalOutstanding };
  }, [filteredInvoices]);

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    const variants = {
      [PaymentStatus.PAID]: "success",
      [PaymentStatus.PARTIAL]: "warning",
      [PaymentStatus.UNPAID]: "danger",
    } as const;
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  const handleView = (invoice: Invoice) => {
    console.log("View invoice:", invoice.id);
  };

  const handleEdit = (invoice: Invoice) => {
    console.log("Edit invoice:", invoice.id);
  };

  const handleExportIRD = () => {
    console.log("Export IRD Annex B format");
    // Implementation for IRD-compatible export
  };

  const columns = [
    {
      key: "invoiceNo",
      header: "Invoice No",
      sortable: true,
    },
    {
      key: "date",
      header: "Date",
      render: (_: any, row: any) => (
        <DualDate date={row.date || row.adDate} dateNepali={row.dateNepali || row.bsDate} />
      ),
    },
    {
      key: "partyName",
      header: "Customer",
    },
    {
      key: "partyPan",
      header: "Customer PAN",
      render: (invoice: Invoice) => invoice.partyPan || "-",
    },
    {
      key: "subTotal",
      header: "Sub Total",
      align: "right",
      render: (invoice: Invoice) => formatCurrency(invoice.subTotal),
    },
    {
      key: "discountAmount",
      header: "Discount",
      align: "right",
      render: (invoice: Invoice) => formatCurrency(invoice.discountAmount),
    },
    {
      key: "taxableAmount",
      header: "Taxable",
      align: "right",
      render: (invoice: Invoice) => formatCurrency(invoice.taxableAmount),
    },
    {
      key: "exemptAmount",
      header: "Exempt",
      align: "right",
      render: (invoice: Invoice) => formatCurrency(invoice.exemptAmount),
    },
    {
      key: "vatAmount",
      header: "VAT",
      align: "right",
      render: (invoice: Invoice) => formatCurrency(invoice.vatAmount),
    },
    {
      key: "grandTotal",
      header: "Grand Total",
      align: "right",
      render: (invoice: Invoice) => formatCurrency(invoice.grandTotal),
    },
    {
      key: "tdsAmount",
      header: "TDS",
      align: "right",
      render: (invoice: Invoice) => formatCurrency(invoice.tdsAmount || 0),
    },
    {
      key: "netAmount",
      header: "Net Amount",
      align: "right",
      render: (invoice: Invoice) => formatCurrency(invoice.grandTotal - (invoice.tdsAmount || 0)),
    },
    {
      key: "paymentStatus",
      header: "Payment Status",
      render: (invoice: Invoice) => getPaymentStatusBadge(invoice.paymentStatus),
    },
    {
      key: "actions",
      header: "Actions",
      render: (invoice: Invoice) => (
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleView(invoice)}
            icon={<Eye className="h-3 w-3" />}
          >
            {null}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleEdit(invoice)}
            icon={<Edit className="h-3 w-3" />}
          >
            {null}
          </Button>
        </div>
      ),
      width: "100px",
    },
  ];

  const paymentStatusOptions = [
    { value: "all", label: "All Status" },
    { value: PaymentStatus.PAID, label: "Paid" },
    { value: PaymentStatus.UNPAID, label: "Unpaid" },
    { value: PaymentStatus.PARTIAL, label: "Partial" },
  ];

  const taxCategoryOptions = [
    { value: "all", label: "All Categories" },
    { value: "taxable", label: "Taxable" },
    { value: "exempt", label: "Exempt" },
  ];

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4 text-xs select-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-[#000000]">Sales Register</h1>
          <p className="text-[11px] text-[#000000] mt-0.5">All sales invoices and returns</p>
        </div>
        <div className="flex items-center gap-2">

          <div style={{ position: "relative" }}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowColPicker((v) => !v)}
              style={{
                background: showColPicker ? "#eff6ff" : "#ffffff",
              }}
            >
              ⊞ Columns
            </Button>
            {showColPicker && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                zIndex: 50,
                minWidth: 200,
                padding: 8,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280", padding: "2px 6px 6px" }}>
                  Show / Hide Columns
                </div>
                {ALL_COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 6px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                      color: "#374151",
                      userSelect: "none",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLLabelElement).style.background = "#f5f6fa"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLLabelElement).style.background = "transparent"; }}
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.key)}
                      onChange={() => toggleCol(col.key)}
                      style={{ accentColor: "#1557b0", width: 14, height: 14 }}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportIRD}
            icon={<FileText className="h-4 w-4" />}
          >
            Export IRD Format
          </Button>
          <Button size="sm" variant="outline" icon={<Download className="h-4 w-4" />}>
            Export Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          {
            label: "Total Sales",
            value: formatCurrency(filteredInvoices.reduce((s, r) => s + (r.grandTotal || 0), 0)),
            color: "#15803d",
          },
          { label: "Invoice Count", value: filteredInvoices.length, color: "#1557b0" },
          {
            label: "Total VAT",
            value: formatCurrency(filteredInvoices.reduce((s, r) => s + (r.vatAmount || 0), 0)),
            color: "#b45309",
          },
          {
            label: "Posted",
            value: filteredInvoices.filter((r) => r.status === "posted").length,
            color: "#15803d",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white border rounded-lg p-3"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#000000]">
              {label}
            </div>
            <div className="text-[16px] font-bold text-[#000000] mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card border padding="md" className="no-print">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-[#000000]" />
          <span className="font-semibold text-[#000000]">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <NepaliDatePicker
            label="From Date"
            value={filters.dateFrom}
            onChange={(value) => setFilters((prev) => ({ ...prev, dateFrom: value }))}
          />
          <NepaliDatePicker
            label="To Date"
            value={filters.dateTo}
            onChange={(value) => setFilters((prev) => ({ ...prev, dateTo: value }))}
          />
          <Input
            label="Party"
            value={filters.partyId}
            onChange={(value) => setFilters((prev) => ({ ...prev, partyId: value }))}
            placeholder="Select party..."
          />
          <Select
            label="Payment Status"
            value={filters.paymentStatus}
            onChange={(value) => setFilters((prev) => ({ ...prev, paymentStatus: value }))}
            options={paymentStatusOptions}
          />
          <Input
            label="Item"
            value={filters.itemId}
            onChange={(value) => setFilters((prev) => ({ ...prev, itemId: value }))}
            placeholder="Select item..."
          />
          <Select
            label="Tax Category"
            value={filters.taxCategory}
            onChange={(value) => setFilters((prev) => ({ ...prev, taxCategory: value }))}
            options={taxCategoryOptions}
          />
        </div>
      </Card>

      
      {/* Table */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        maxHeight: "calc(100vh - 200px)",
        position: "relative",
      }} className="bg-white border rounded-lg overflow-hidden animate-fadeIn" style={{ borderColor: "var(--border)" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            {ALL_COLUMNS.filter((c) => visibleCols.has(c.key)).map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
          </colgroup>
          <thead style={{ position: "sticky", top: 0, zIndex: 5 }}>
            <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              {ALL_COLUMNS.filter((c) => visibleCols.has(c.key)).map((col) => (
                <th key={col.key} className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em]" style={{ textAlign: ["subTotal", "discount", "taxable", "exempt", "vat", "grandTotal", "tds", "netAmount"].includes(col.key) ? "right" : "left" }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedInvoices.length === 0 ? (
              <tr>
                <td colSpan={ALL_COLUMNS.filter(c => visibleCols.has(c.key)).length} className="text-center py-8 text-[#000000]">
                  No invoices found
                </td>
              </tr>
            ) : (
              paginatedInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-[#e8eeff]">
                  {ALL_COLUMNS.filter((c) => visibleCols.has(c.key)).map((col) => {
                    switch (col.key) {
                      case "invoiceNo": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-[#000000] font-bold">{invoice.invoiceNo}</td>;
                      case "date": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-[#000000]">{new Date(invoice.date).toLocaleDateString()}</td>;
                      case "party": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-[#000000]">{invoice.partyName}</td>;
                      case "pan": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-[#000000] font-mono">{invoice.partyPan || "-"}</td>;
                      case "subTotal": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(invoice.subTotal)}</td>;
                      case "discount": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(invoice.discountAmount || 0)}</td>;
                      case "taxable": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(invoice.taxableAmount)}</td>;
                      case "exempt": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(invoice.exemptAmount || 0)}</td>;
                      case "vat": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-right font-mono amt amt-dr">Rs. {formatNumber(invoice.vatAmount)}</td>;
                      case "grandTotal": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-right font-mono amt font-bold">Rs. {formatNumber(invoice.grandTotal)}</td>;
                      case "tds": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(invoice.tdsAmount || 0)}</td>;
                      case "netAmount": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-right font-mono amt font-bold" style={{ color: "var(--primary)" }}>Rs. {formatNumber(invoice.grandTotal - (invoice.tdsAmount || 0))}</td>;
                      case "status": return <td key={col.key} className="px-3 py-[7px] text-[12px] text-center">{getPaymentStatusBadge(invoice.paymentStatus)}</td>;
                      default: return <td key={col.key} />;
                    }
                  })}
                </tr>
              ))
            )}
          </tbody>
          <tfoot style={{ position: "sticky", bottom: 0, zIndex: 5, boxShadow: "0 -2px 8px rgba(0,0,0,0.08)" }}>
            <tr style={{ background: "#1e2433", color: "#ffffff" }}>
              {ALL_COLUMNS.filter((c) => visibleCols.has(c.key)).map((col, idx) => {
                if (idx === 0) {
                  const span = ALL_COLUMNS.filter((c) => visibleCols.has(c.key)).findIndex(c => c.key === "subTotal");
                  if (span > 0) {
                    return (
                      <td key="grand-total-label" colSpan={span} style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "#ffffff" }}>
                        Grand Total ({filteredInvoices.length} records)
                      </td>
                    );
                  }
                }
                
                const span = ALL_COLUMNS.filter((c) => visibleCols.has(c.key)).findIndex(c => c.key === "subTotal");
                if (idx > 0 && idx < span) return null;

                switch (col.key) {
                  case "subTotal": return <td key={col.key} className="num-cell-bold" style={{ padding: "10px 12px", color: "#ffffff", fontFamily: "'Courier New', monospace", textAlign: "right" }}>Rs. {formatNumber(totals.subTotal)}</td>;
                  case "discount": return <td key={col.key} className="num-cell-bold" style={{ padding: "10px 12px", color: "#ffffff", fontFamily: "'Courier New', monospace", textAlign: "right" }}>Rs. {formatNumber(totals.discount)}</td>;
                  case "taxable": return <td key={col.key} className="num-cell-bold" style={{ padding: "10px 12px", color: "#86efac", fontFamily: "'Courier New', monospace", textAlign: "right" }}>Rs. {formatNumber(totals.taxable)}</td>;
                  case "exempt": return <td key={col.key} className="num-cell-bold" style={{ padding: "10px 12px", color: "#ffffff", fontFamily: "'Courier New', monospace", textAlign: "right" }}>Rs. {formatNumber(totals.exempt)}</td>;
                  case "vat": return <td key={col.key} className="num-cell-bold" style={{ padding: "10px 12px", color: "#93c5fd", fontFamily: "'Courier New', monospace", textAlign: "right" }}>Rs. {formatNumber(totals.vat)}</td>;
                  case "grandTotal": return <td key={col.key} className="num-cell-bold" style={{ padding: "10px 12px", color: "#fde68a", fontFamily: "'Courier New', monospace", fontSize: 13, textAlign: "right" }}>Rs. {formatNumber(totals.grandTotal)}</td>;
                  case "tds": return <td key={col.key} className="num-cell-bold" style={{ padding: "10px 12px", color: "#ffffff", fontFamily: "'Courier New', monospace", textAlign: "right" }}>Rs. {formatNumber(totals.tds)}</td>;
                  case "netAmount": return <td key={col.key} className="num-cell-bold" style={{ padding: "10px 12px", color: "#fde68a", fontFamily: "'Courier New', monospace", fontSize: 13, textAlign: "right" }}>Rs. {formatNumber(totals.netAmount)}</td>;
                  case "status": return <td key={col.key} style={{ padding: "10px 12px" }}></td>;
                  default: return <td key={col.key} style={{ padding: "10px 12px" }}></td>;
                }
              })}
            </tr>
          </tfoot>
        </table>
      </div>
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
  );
};

export default SalesRegister;
