// @ts-nocheck
import React, { useState, useMemo } from "react";
import { Filter, Download, Printer, Eye, Edit, X, Trash2, Calendar } from "lucide-react";
import SearchableTable from "../components/ui/SearchableTable";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Select from "../components/ui/Select";
import Input from "../components/ui/Input";
import Card from "../components/ui/Card";
import { VoucherStatus, VoucherType, JournalEntry } from "../lib/types";
import { formatCurrency } from "../lib/utils";
import NepaliDatePicker from "../components/ui/NepaliDatePicker";

const VouchersLog: React.FC = () => {
  const [filters, setFilters] = useState({
    voucherType: "all",
    status: "all",
    dateFrom: "",
    dateTo: "",
    search: "",
  });
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);

  // Mock data - replace with actual API call
  const vouchers: (JournalEntry & { actions?: string })[] = [
    {
      id: "1",
      voucherNo: "JV-001",
      date: "2024-01-15",
      dateNepali: "2080-10-01",
      type: VoucherType.JOURNAL,
      partyName: "ABC Suppliers",
      narration: "Purchase payment",
      totalDebit: 50000,
      totalCredit: 50000,
      status: VoucherStatus.POSTED,
      lines: [],
    },
    {
      id: "2",
      voucherNo: "PV-001",
      date: "2024-01-16",
      dateNepali: "2080-10-02",
      type: VoucherType.PAYMENT,
      partyName: "XYZ Customer",
      narration: "Sales receipt",
      totalDebit: 25000,
      totalCredit: 25000,
      status: VoucherStatus.DRAFT,
      lines: [],
    },
  ];

  const stats = useMemo(() => {
    const posted = vouchers.filter((v) => v.status === VoucherStatus.POSTED).length;
    const draft = vouchers.filter((v) => v.status === VoucherStatus.DRAFT).length;
    const cancelled = vouchers.filter((v) => v.status === VoucherStatus.CANCELLED).length;
    return { posted, draft, cancelled };
  }, [vouchers]);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      if (filters.voucherType !== "all" && voucher.type !== filters.voucherType) return false;
      if (filters.status !== "all" && voucher.status !== filters.status) return false;
      if (
        filters.search &&
        !voucher.voucherNo.toLowerCase().includes(filters.search.toLowerCase()) &&
        !voucher.narration.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [vouchers, filters]);

  const getStatusBadge = (status: VoucherStatus) => {
    const variants = {
      [VoucherStatus.POSTED]: "success",
      [VoucherStatus.DRAFT]: "warning",
      [VoucherStatus.CANCELLED]: "danger",
    } as const;
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  const getTypeBadge = (type: VoucherType) => {
    return <Badge variant="info">{type.replace("-", " ").toUpperCase()}</Badge>;
  };

  const handleBulkPrint = () => {
    if (selectedVouchers.length === 0) return;
    console.log("Bulk print vouchers:", selectedVouchers);
  };

  const handleBulkExport = () => {
    if (selectedVouchers.length === 0) return;
    console.log("Bulk export vouchers:", selectedVouchers);
  };

  const handleView = (voucher: JournalEntry) => {
    console.log("View voucher:", voucher.id);
  };

  const handleEdit = (voucher: JournalEntry) => {
    if (voucher.status === VoucherStatus.CANCELLED) return;
    console.log("Edit voucher:", voucher.id);
  };

  const handleCancel = (voucher: JournalEntry) => {
    if (voucher.status === VoucherStatus.CANCELLED) return;
    const reason = prompt("Enter cancellation reason:");
    if (reason) {
      console.log("Cancel voucher:", voucher.id, "Reason:", reason);
    }
  };

  const handleDelete = (voucher: JournalEntry) => {
    if (voucher.status !== VoucherStatus.DRAFT) return;
    if (confirm("Are you sure you want to delete this voucher?")) {
      console.log("Delete voucher:", voucher.id);
    }
  };

  const handlePrint = (voucher: JournalEntry) => {
    console.log("Print voucher:", voucher.id);
  };

  const columns = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={
            selectedVouchers.length === filteredVouchers.length && filteredVouchers.length > 0
          }
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedVouchers(filteredVouchers.map((v) => v.id));
            } else {
              setSelectedVouchers([]);
            }
          }}
          className="rounded border-gray-300"
        />
      ),
      render: (voucher: JournalEntry) => (
        <input
          type="checkbox"
          checked={selectedVouchers.includes(voucher.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedVouchers([...selectedVouchers, voucher.id]);
            } else {
              setSelectedVouchers(selectedVouchers.filter((id) => id !== voucher.id));
            }
          }}
          className="rounded border-gray-300"
        />
      ),
      width: "50px",
    },
    {
      key: "voucherNo",
      header: "Voucher No",
      sortable: true,
    },
    { key: "date", header: "Date", render: (_: any, row: any) => <DualDate date={row.date || row.adDate} dateNepali={row.dateNepali || row.bsDate} /> },
    {
      key: "type",
      header: "Type",
      render: (voucher: JournalEntry) => getTypeBadge(voucher.type),
    },
    {
      key: "partyName",
      header: "Party",
      render: (voucher: JournalEntry) => voucher.partyName || "-",
    },
    {
      key: "narration",
      header: "Narration",
    },
    {
      key: "totalDebit",
      header: "Debit Total",
      align: "right",
      render: (voucher: JournalEntry) => formatCurrency(voucher.totalDebit),
    },
    {
      key: "totalCredit",
      header: "Credit Total",
      align: "right",
      render: (voucher: JournalEntry) => formatCurrency(voucher.totalCredit),
    },
    {
      key: "status",
      header: "Status",
      render: (voucher: JournalEntry) => getStatusBadge(voucher.status),
    },
    {
      key: "actions",
      header: "Actions",
      render: (voucher: JournalEntry) => (
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleView(voucher)}
            icon={<Eye className="h-3 w-3" />}
          />
          {voucher.status !== VoucherStatus.CANCELLED && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => handleEdit(voucher)}
              icon={<Edit className="h-3 w-3" />}
            />
          )}
          {voucher.status !== VoucherStatus.CANCELLED && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => handleCancel(voucher)}
              icon={<X className="h-3 w-3" />}
            />
          )}
          {voucher.status === VoucherStatus.DRAFT && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => handleDelete(voucher)}
              icon={<Trash2 className="h-3 w-3" />}
            />
          )}
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handlePrint(voucher)}
            icon={<Printer className="h-3 w-3" />}
          />
        </div>
      ),
      width: "150px",
    },
  ];

  const voucherTypeOptions = [
    { value: "all", label: "All Types" },
    { value: VoucherType.JOURNAL, label: "Journal" },
    { value: VoucherType.PAYMENT, label: "Payment" },
    { value: VoucherType.RECEIPT, label: "Receipt" },
    { value: VoucherType.CONTRA, label: "Contra" },
    { value: VoucherType.SALES_INVOICE, label: "Sales Invoice" },
    { value: VoucherType.PURCHASE_INVOICE, label: "Purchase Invoice" },
  ];

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: VoucherStatus.POSTED, label: "Posted" },
    { value: VoucherStatus.DRAFT, label: "Draft" },
    { value: VoucherStatus.CANCELLED, label: "Cancelled" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vouchers Log</h1>
        <div className="flex items-center gap-2">
          {selectedVouchers.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkPrint}
                icon={<Printer className="h-4 w-4" />}
              >
                Bulk Print ({selectedVouchers.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkExport}
                icon={<Download className="h-4 w-4" />}
              >
                Bulk Export ({selectedVouchers.length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Posted</p>
              <p className="text-2xl font-bold text-green-600">{stats.posted}</p>
            </div>
            <Badge variant="success" dot />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Draft</p>
              <p className="text-2xl font-bold text-amber-600">{stats.draft}</p>
            </div>
            <Badge variant="warning" dot />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Cancelled</p>
              <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
            </div>
            <Badge variant="danger" dot />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Select
            label="Voucher Type"
            value={filters.voucherType}
            onChange={(value) => setFilters((prev) => ({ ...prev, voucherType: value }))}
            options={voucherTypeOptions}
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            options={statusOptions}
          />
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
            label="Search"
            value={filters.search}
            onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
            placeholder="Voucher no, narration..."
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <SearchableTable
          columns={columns}
          data={filteredVouchers}
          searchFields={["voucherNo", "narration", "partyName"]}
          rowKey="id"
          emptyMessage="No vouchers found"
          placeholder="Search vouchers..."
        />
      </Card>
    </div>
  );
};

export default VouchersLog;
