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

const PurchaseRegister: React.FC = () => {
  const { invoices } = useStore();
  const purchaseInvoices = useMemo(() => {
    return invoices.filter(
      (inv) =>
        inv.type === VoucherType.PURCHASE_INVOICE ||
        inv.type === VoucherType.PURCHASE_RETURN
    );
  }, [invoices]);

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
    return purchaseInvoices.filter((invoice) => {
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
  }, [purchaseInvoices, filters]);

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
    const totalPurchases = filteredInvoices
      .filter((inv) => inv.type === VoucherType.PURCHASE_INVOICE)
      .reduce((sum, inv) => sum + inv.grandTotal, 0);

    const totalVAT = filteredInvoices.reduce((sum, inv) => sum + inv.vatAmount, 0);

    const totalOutstanding = filteredInvoices
      .filter((inv) => inv.paymentStatus !== PaymentStatus.PAID)
      .reduce((sum, inv) => sum + (inv.grandTotal - (inv.paidAmount || 0)), 0);

    return { totalPurchases, totalVAT, totalOutstanding };
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
    console.log("Export IRD compatible format");
    // Implementation for IRD-compatible export
  };

  const columns = [
    {
      key: "invoiceNo",
      header: "Invoice No",
      sortable: true,
    },
    { key: "date", header: "Date", render: (_: any, row: any) => <DualDate date={row.date || row.adDate} dateNepali={row.dateNepali || row.bsDate} /> },
    {
      key: "partyName",
      header: "Supplier",
    },
    {
      key: "partyPan",
      header: "Supplier PAN",
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
          <h1 className="text-[15px] font-semibold text-gray-800">Purchase Register</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">All purchase invoices and returns</p>
        </div>
        <div className="flex items-center gap-2">
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
          { label: "Total Purchases", value: formatCurrency(filteredInvoices.reduce((s,r)=>s+(r.grandTotal||0),0)), color: "var(--color-accent)" },
          { label: "Invoice Count", value: filteredInvoices.length, color: "var(--color-accent)" },
          { label: "Total VAT", value: formatCurrency(filteredInvoices.reduce((s,r)=>s+(r.vatAmount||0),0)), color: "#b45309" },
          { label: "Posted", value: filteredInvoices.filter(r=>r.status==="posted").length, color: "var(--color-positive)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border rounded-lg p-3" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</div>
            <div className="text-[16px] font-bold text-gray-800 mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card border padding="md" className="no-print">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="font-semibold text-gray-700">Filters</span>
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
            placeholder="Select supplier..."
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
      <div className="bg-white border rounded-lg overflow-hidden animate-fadeIn" style={{ borderColor: "var(--border)" }}>
        <table className="data-table">
          <thead>
            <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Invoice No</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Date</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Supplier</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">Supplier PAN</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Sub Total</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Discount</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Taxable</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Exempt</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">VAT</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Grand Total</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">TDS</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">Net Amount</th>
              <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInvoices.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-8 text-gray-500">
                  No purchase invoices found
                </td>
              </tr>
            ) : (
              paginatedInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-[#e8eeff]">
                  <td className="px-3 py-[7px] text-[12px] text-gray-700 font-bold">{invoice.invoiceNo}</td>
                  <td className="px-3 py-[7px] text-[12px] text-gray-700">{new Date(invoice.date).toLocaleDateString()}</td>
                  <td className="px-3 py-[7px] text-[12px] text-gray-700">{invoice.partyName}</td>
                  <td className="px-3 py-[7px] text-[12px] text-gray-700 font-mono">{invoice.partyPan || "-"}</td>
                  <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(invoice.subTotal)}</td>
                  <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(invoice.discountAmount || 0)}</td>
                  <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(invoice.taxableAmount)}</td>
                  <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(invoice.exemptAmount || 0)}</td>
                  <td className="px-3 py-[7px] text-[12px] text-right font-mono amt amt-cr">Rs. {formatNumber(invoice.vatAmount)}</td>
                  <td className="px-3 py-[7px] text-[12px] text-right font-mono amt font-bold">Rs. {formatNumber(invoice.grandTotal)}</td>
                  <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">Rs. {formatNumber(invoice.tdsAmount || 0)}</td>
                  <td className="px-3 py-[7px] text-[12px] text-right font-mono amt font-bold" style={{ color: "var(--primary)" }}>Rs. {formatNumber(invoice.grandTotal - (invoice.tdsAmount || 0))}</td>
                  <td className="px-3 py-[7px] text-[12px] text-center">{getPaymentStatusBadge(invoice.paymentStatus)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-[#eef1f8] border-t-2 border-[#c5cad8] font-bold">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-[12px] text-gray-700">Total</td>
              <td className="px-3 py-2 text-[12px] text-right font-mono amt">Rs. {formatNumber(totals.subTotal)}</td>
              <td className="px-3 py-2 text-[12px] text-right font-mono amt">Rs. {formatNumber(totals.discount)}</td>
              <td className="px-3 py-2 text-[12px] text-right font-mono amt">Rs. {formatNumber(totals.taxable)}</td>
              <td className="px-3 py-2 text-[12px] text-right font-mono amt">Rs. {formatNumber(totals.exempt)}</td>
              <td className="px-3 py-2 text-[12px] text-right font-mono amt amt-cr">Rs. {formatNumber(totals.vat)}</td>
              <td className="px-3 py-2 text-[12px] text-right font-mono amt font-bold">Rs. {formatNumber(totals.grandTotal)}</td>
              <td className="px-3 py-2 text-[12px] text-right font-mono amt">Rs. {formatNumber(totals.tds)}</td>
              <td className="px-3 py-2 text-[12px] text-right font-mono amt font-bold" style={{ color: "var(--primary)" }}>Rs. {formatNumber(totals.netAmount)}</td>
              <td />
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

export default PurchaseRegister;
