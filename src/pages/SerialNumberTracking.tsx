import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Edit2,
  Eye,
  Package,
  Plus,
  Printer,
  Search,
  Shield,
  Wrench,
  X,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

interface SerialRecord {
  id: string;
  serialNo: string;
  itemId: string;
  itemName: string;
  purchaseDate: string;
  purchaseInvoiceNo: string;
  supplierId: string;
  supplierName: string;
  purchaseRate: number;
  saleDate: string;
  saleInvoiceNo: string;
  customerId: string;
  customerName: string;
  saleRate: number;
  warrantyMonths: number;
  warrantyExpiry: string;
  status: "in_stock" | "sold" | "in_repair" | "returned" | "written_off";
  location: string;
  notes: string;
  companyId: string;
  branchId?: string;
}

const STORAGE_KEY = "sutra_serials";

const blankSerial: Omit<SerialRecord, "id" | "companyId"> = {
  serialNo: "",
  itemId: "",
  itemName: "",
  purchaseDate: new Date().toISOString().split("T")[0],
  purchaseInvoiceNo: "",
  supplierId: "",
  supplierName: "",
  purchaseRate: 0,
  saleDate: "",
  saleInvoiceNo: "",
  customerId: "",
  customerName: "",
  saleRate: 0,
  warrantyMonths: 12,
  warrantyExpiry: "",
  status: "in_stock",
  location: "",
  notes: "",
};

function readAllSerials(): SerialRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadSerials(companyId: string): SerialRecord[] {
  try {
    return readAllSerials().filter((serial) => serial.companyId === companyId);
  } catch {
    return [];
  }
}

function saveSerial(serial: SerialRecord): void {
  try {
    const all = readAllSerials();
    const idx = all.findIndex((row) => row.id === serial.id);

    if (idx >= 0) all[idx] = serial;
    else all.push(serial);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // no-op
  }
}

function generateWarrantyExpiry(saleDate: string, warrantyMonths: number): string {
  if (!saleDate) return "";
  const d = new Date(saleDate);
  if (Number.isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + warrantyMonths);
  return d.toISOString().split("T")[0];
}

function money(value: number): string {
  return Number(value || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusClass(status: SerialRecord["status"]): string {
  switch (status) {
    case "in_stock":
      return "bg-green-100 text-green-700";
    case "sold":
      return "bg-blue-100 text-blue-700";
    case "in_repair":
      return "bg-amber-100 text-amber-700";
    case "returned":
      return "bg-orange-100 text-orange-700";
    case "written_off":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getWarrantyStatus(serial: SerialRecord): {
  text: string;
  color: "gray" | "red" | "amber" | "green";
} {
  if (serial.status !== "sold" || !serial.warrantyExpiry) {
    return { text: "N/A", color: "gray" };
  }

  const daysLeft = Math.floor((new Date(serial.warrantyExpiry).getTime() - Date.now()) / 86400000);

  if (daysLeft < 0) return { text: "Expired", color: "red" };
  if (daysLeft <= 30) return { text: `${daysLeft} days left`, color: "amber" };
  return { text: `${daysLeft} days`, color: "green" };
}

function warrantyTextClass(color: "gray" | "red" | "amber" | "green") {
  if (color === "red") return "text-red-700 font-semibold";
  if (color === "amber") return "text-amber-700 font-semibold";
  if (color === "green") return "text-green-700 font-medium";
  return "text-gray-500";
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatDate(date: string) {
  return date || "—";
}

export default function SerialNumberTracking() {
  const store = useStore() as any;
  const companyId = store.currentCompany?.id ?? "default";
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const [serials, setSerials] = useState<SerialRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "in_stock" | "sold" | "warranty" | "search">(
    "all",
  );
  const [searchSerial, setSearchSerial] = useState("");
  const [filterItem, setFilterItem] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSerial, setSelectedSerial] = useState<SerialRecord | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Omit<SerialRecord, "id" | "companyId">>({ ...blankSerial });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reload = () => setSerials(loadSerials(companyId));

  useEffect(() => {
    reload();
  }, [companyId]);

  const uniqueItems = useMemo(() => {
    return Array.from(new Set(serials.map((s) => s.itemName).filter(Boolean))).sort();
  }, [serials]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];

    return {
      total: serials.length,
      inStock: serials.filter((s) => s.status === "in_stock").length,
      sold: serials.filter((s) => s.status === "sold").length,
      underWarranty: serials.filter(
        (s) => s.status === "sold" && s.warrantyExpiry && s.warrantyExpiry > today,
      ).length,
    };
  }, [serials]);

  const filteredSerials = useMemo(() => {
    const q = searchSerial.trim().toLowerCase();

    let list = serials;

    if (activeTab === "in_stock") list = list.filter((s) => s.status === "in_stock");
    if (activeTab === "sold") list = list.filter((s) => s.status === "sold");

    return list.filter((serial) => {
      if (!matchBranch((serial as any).branchId)) return false;

      if (
        q &&
        !serial.serialNo.toLowerCase().includes(q) &&
        !serial.itemName.toLowerCase().includes(q)
      ) {
        return false;
      }

      if (filterItem !== "ALL" && serial.itemName !== filterItem) return false;
      if (filterStatus !== "ALL" && serial.status !== filterStatus) return false;

      return true;
    });
  }, [serials, activeTab, searchSerial, filterItem, filterStatus, matchBranch]);

  const warrantyRows = useMemo(() => {
    return serials
      .filter((s) => s.status === "sold" && matchBranch((s as any).branchId))
      .sort((a, b) => {
        const aDays = Math.floor((new Date(a.warrantyExpiry).getTime() - Date.now()) / 86400000);
        const bDays = Math.floor((new Date(b.warrantyExpiry).getTime() - Date.now()) / 86400000);
        return aDays - bDays;
      });
  }, [serials, matchBranch]);

  const searchResult = useMemo(() => {
    const q = searchSerial.trim().toLowerCase();
    if (!q) return null;

    return serials.find(
      (s) => s.serialNo.toLowerCase() === q && matchBranch((s as any).branchId),
    ) ?? null;
  }, [serials, searchSerial, matchBranch]);

  const updateForm = (field: keyof Omit<SerialRecord, "id" | "companyId">, value: any) => {
    const next: any = { ...form, [field]: value };

    if (field === "saleDate" || field === "warrantyMonths") {
      next.warrantyExpiry = generateWarrantyExpiry(
        field === "saleDate" ? value : next.saleDate,
        field === "warrantyMonths" ? Number(value) : Number(next.warrantyMonths),
      );
    }

    if (field === "status" && value !== "sold" && value !== "returned") {
      next.saleDate = next.saleDate || "";
      next.warrantyExpiry = generateWarrantyExpiry(next.saleDate, Number(next.warrantyMonths || 0));
    }

    setForm(next);
  };

  const openNewModal = () => {
    setEditMode(false);
    setSelectedSerial(null);
    setForm({ ...blankSerial });
    setErrors({});
    setShowAddModal(true);
  };

  const openEditModal = (serial: SerialRecord) => {
    setEditMode(true);
    setSelectedSerial(serial);
    const { id, companyId: _companyId, ...rest } = serial;
    setForm(rest);
    setErrors({});
    setShowAddModal(true);
  };

  const openDetail = (serial: SerialRecord) => {
    setSelectedSerial(serial);
    setShowDetailModal(true);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.serialNo.trim()) nextErrors.serialNo = "Serial No is required";
    if (!form.itemName.trim()) nextErrors.itemName = "Item Name is required";

    if (form.status === "sold") {
      if (!form.saleDate) nextErrors.saleDate = "Sale Date is required for sold item";
      if (!form.customerName.trim() && !form.customerId.trim()) {
        nextErrors.customerName = "Customer is required for sold item";
      }
      if (!(Number(form.saleRate) > 0)) nextErrors.saleRate = "Sale Rate must be greater than zero";
    }

    const duplicate = serials.find(
      (s) =>
        s.itemName.toLowerCase() === form.itemName.toLowerCase() &&
        s.serialNo.toLowerCase() === form.serialNo.toLowerCase() &&
        (!editMode || s.id !== selectedSerial?.id),
    );

    if (duplicate) nextErrors.serialNo = "Duplicate serial number for this item";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      if (errors.serialNo) alert(errors.serialNo);
      return;
    }

    const serial: SerialRecord = {
      ...form,
      id: editMode && selectedSerial ? selectedSerial.id : crypto.randomUUID(),
      companyId,
      branchId: selectedSerial?.branchId || readActiveBranchId() || undefined,
      warrantyExpiry: generateWarrantyExpiry(form.saleDate, Number(form.warrantyMonths || 0)),
      purchaseRate: Number(form.purchaseRate || 0),
      saleRate: Number(form.saleRate || 0),
      warrantyMonths: Number(form.warrantyMonths || 0),
    };

    saveSerial(serial);
    reload();
    setShowAddModal(false);
    setSelectedSerial(null);
    setEditMode(false);
    setForm({ ...blankSerial });
  };

  const renderStatus = (status: SerialRecord["status"]) => (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${statusClass(status)}`}
    >
      {formatStatus(status)}
    </span>
  );

  const renderSerialTable = (rows: SerialRecord[]) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {rows.length === 0 ? (
        <div className="py-14 text-center">
          <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-[12px] text-gray-400">No serial records found</p>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {[
                "Serial No",
                "Item Name",
                "Purchase Date",
                "Supplier",
                "Status",
                "Warranty Status",
                "Sale Date",
                "Customer",
                "Location",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((serial) => {
              const warranty = getWarrantyStatus(serial);

              return (
                <tr key={serial.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono font-medium">
                    {serial.serialNo}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{serial.itemName}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {formatDate(serial.purchaseDate)}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {serial.supplierName || "—"}
                  </td>
                  <td className="px-3 py-2.5">{renderStatus(serial.status)}</td>
                  <td className={`px-3 py-2.5 text-[12px] ${warrantyTextClass(warranty.color)}`}>
                    {warranty.text}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {serial.saleDate || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {serial.customerName || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {serial.location || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openDetail(serial)}
                        className="h-7 px-2 bg-white border border-gray-300 text-gray-700 text-[11px] rounded hover:bg-gray-50 flex items-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(serial)}
                        className="h-7 px-2 bg-white border border-gray-300 text-[var(--ds-action-primary)] text-[11px] rounded hover:bg-gray-50 flex items-center gap-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
            <Package className="h-4 w-4 text-[var(--ds-action-primary)]" />
            Serial Number Tracking
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Track individual items by serial number for warranty and service management
          </p>
        </div>

        <div className="flex items-center gap-2">
          {branchOptions.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              aria-label="Branch"
            >
              <option value="all">All branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.code || b.id}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={openNewModal}
            className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Register Serial
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[11px] text-gray-500">Total Serials Registered</p>
          <p className="text-[22px] font-semibold text-gray-700 mt-1">{summary.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[11px] text-gray-500">In Stock</p>
          <p className="text-[22px] font-semibold text-green-700 mt-1">{summary.inStock}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[11px] text-gray-500">Sold</p>
          <p className="text-[22px] font-semibold text-blue-700 mt-1">{summary.sold}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[11px] text-gray-500">Under Warranty</p>
          <p className="text-[22px] font-semibold text-teal-700 mt-1">{summary.underWarranty}</p>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-4">
        {[
          ["all", "All"],
          ["in_stock", "In Stock"],
          ["sold", "Sold"],
          ["warranty", "Warranty Tracking"],
          ["search", "Serial Search"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as any)}
            className={
              activeTab === key
                ? "px-4 py-2 border-b-2 border-[var(--ds-action-primary)] text-[var(--ds-action-primary)] text-[12px] font-medium"
                : "px-4 py-2 text-gray-500 text-[12px] hover:text-gray-700"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {(activeTab === "all" || activeTab === "in_stock" || activeTab === "sold") && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-wrap gap-3">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchSerial}
                onChange={(e) => setSearchSerial(e.target.value)}
                placeholder="Search serial or item..."
                className="h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-64"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white"
            >
              <option value="ALL">All Status</option>
              <option value="in_stock">In Stock</option>
              <option value="sold">Sold</option>
              <option value="in_repair">In Repair</option>
              <option value="returned">Returned</option>
              <option value="written_off">Written Off</option>
            </select>

            <select
              value={filterItem}
              onChange={(e) => setFilterItem(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white"
            >
              <option value="ALL">All Items</option>
              {uniqueItems.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {renderSerialTable(filteredSerials)}
        </>
      )}

      {activeTab === "warranty" && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {warrantyRows.length === 0 ? (
            <div className="py-14 text-center">
              <Shield className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-[12px] text-gray-400">No sold items with warranty found</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    "Serial No",
                    "Item",
                    "Customer",
                    "Sale Date",
                    "Warranty Months",
                    "Warranty Expiry",
                    "Days Remaining",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {warrantyRows.map((serial) => {
                  const warranty = getWarrantyStatus(serial);
                  const rowBg =
                    warranty.color === "red"
                      ? "bg-red-50"
                      : warranty.color === "amber"
                        ? "bg-amber-50"
                        : "";

                  return (
                    <tr key={serial.id} className={`border-b border-gray-100 ${rowBg}`}>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">
                        {serial.serialNo}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{serial.itemName}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {serial.customerName}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{serial.saleDate}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                        {serial.warrantyMonths}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {serial.warrantyExpiry || "—"}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-[12px] ${warrantyTextClass(warranty.color)}`}
                      >
                        {warranty.text}
                      </td>
                      <td className="px-3 py-2.5">{renderStatus(serial.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "search" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Quick Serial Lookup
            </label>
            <input
              value={searchSerial}
              onChange={(e) => setSearchSerial(e.target.value)}
              placeholder="Enter exact serial number..."
              className="h-10 px-3 text-[14px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full font-mono"
            />
          </div>

          {!searchSerial.trim() ? (
            <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
              <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-[12px] text-gray-400">Type a serial number to search</p>
            </div>
          ) : !searchResult ? (
            <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
              <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-[12px] text-gray-400">No serial found</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-700 font-mono">
                    {searchResult.serialNo}
                  </h2>
                  <p className="text-[12px] text-gray-500 mt-1">{searchResult.itemName}</p>
                </div>
                {renderStatus(searchResult.status)}
              </div>

              <div className="grid grid-cols-3 gap-4 text-[12px] mb-4">
                <div className="border border-gray-200 rounded p-3">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Purchase</p>
                  <p>Date: {searchResult.purchaseDate || "—"}</p>
                  <p>Invoice: {searchResult.purchaseInvoiceNo || "—"}</p>
                  <p>Supplier: {searchResult.supplierName || "—"}</p>
                  <p>Rate: {money(searchResult.purchaseRate)}</p>
                </div>

                <div className="border border-gray-200 rounded p-3">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Sale</p>
                  <p>Date: {searchResult.saleDate || "—"}</p>
                  <p>Invoice: {searchResult.saleInvoiceNo || "—"}</p>
                  <p>Customer: {searchResult.customerName || "—"}</p>
                  <p>Rate: {money(searchResult.saleRate)}</p>
                </div>

                <div className="border border-gray-200 rounded p-3">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Warranty</p>
                  <p>Months: {searchResult.warrantyMonths}</p>
                  <p>Expiry: {searchResult.warrantyExpiry || "—"}</p>
                  <p className={warrantyTextClass(getWarrantyStatus(searchResult).color)}>
                    Status: {getWarrantyStatus(searchResult).text}
                  </p>
                </div>
              </div>

              <div className="border border-gray-200 rounded p-3">
                <p className="text-[10px] text-gray-500 uppercase mb-2">Status Timeline</p>
                <div className="flex items-center gap-2 text-[12px] text-gray-700 flex-wrap">
                  <span className="px-2 py-1 rounded bg-green-100 text-green-700">Purchased</span>
                  <span>→</span>
                  <span className="px-2 py-1 rounded bg-green-100 text-green-700">In Stock</span>
                  {(searchResult.status === "sold" ||
                    searchResult.status === "in_repair" ||
                    searchResult.status === "returned") && (
                    <>
                      <span>→</span>
                      <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">Sold</span>
                    </>
                  )}
                  {searchResult.status === "in_repair" && (
                    <>
                      <span>→</span>
                      <span className="px-2 py-1 rounded bg-amber-100 text-amber-700">
                        In Repair
                      </span>
                    </>
                  )}
                  {searchResult.status === "returned" && (
                    <>
                      <span>→</span>
                      <span className="px-2 py-1 rounded bg-orange-100 text-orange-700">
                        Returned
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-gray-700">
                {editMode ? "Edit Serial" : "Register Serial Number"}
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Serial No *
                </label>
                <input
                  value={form.serialNo}
                  onChange={(e) => updateForm("serialNo", e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full font-mono"
                />
                {errors.serialNo && (
                  <p className="text-[11px] text-red-600 mt-1">{errors.serialNo}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Item Name *
                </label>
                <input
                  value={form.itemName}
                  onChange={(e) => updateForm("itemName", e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full"
                />
                {errors.itemName && (
                  <p className="text-[11px] text-red-600 mt-1">{errors.itemName}</p>
                )}
              </div>

              {[
                ["Purchase Date", "purchaseDate", "date"],
                ["Purchase Invoice No", "purchaseInvoiceNo", "text"],
                ["Purchase Rate", "purchaseRate", "number"],
                ["Supplier Name", "supplierName", "text"],
                ["Location/Warehouse", "location", "text"],
                ["Warranty Months", "warrantyMonths", "number"],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={(e) =>
                      updateForm(
                        key as keyof Omit<SerialRecord, "id" | "companyId">,
                        type === "number" ? Number(e.target.value) : e.target.value,
                      )
                    }
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full"
                  />
                </div>
              ))}

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => updateForm("status", e.target.value as SerialRecord["status"])}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full"
                >
                  <option value="in_stock">In Stock</option>
                  <option value="sold">Sold</option>
                  <option value="in_repair">In Repair</option>
                  <option value="returned">Returned</option>
                  <option value="written_off">Written Off</option>
                </select>
              </div>

              {(form.status === "sold" || form.status === "returned") && (
                <>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Sale Date
                    </label>
                    <input
                      type="date"
                      value={form.saleDate}
                      onChange={(e) => updateForm("saleDate", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full"
                    />
                    {errors.saleDate && (
                      <p className="text-[11px] text-red-600 mt-1">{errors.saleDate}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Sale Invoice No
                    </label>
                    <input
                      value={form.saleInvoiceNo}
                      onChange={(e) => updateForm("saleInvoiceNo", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Sale Rate
                    </label>
                    <input
                      type="number"
                      value={form.saleRate}
                      onChange={(e) => updateForm("saleRate", Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full"
                    />
                    {errors.saleRate && (
                      <p className="text-[11px] text-red-600 mt-1">{errors.saleRate}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Customer Name
                    </label>
                    <input
                      value={form.customerName}
                      onChange={(e) => updateForm("customerName", e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white w-full"
                    />
                    {errors.customerName && (
                      <p className="text-[11px] text-red-600 mt-1">{errors.customerName}</p>
                    )}
                  </div>
                </>
              )}

              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  rows={3}
                  className="w-full px-2.5 py-2 text-[12px] border border-gray-300 rounded-lg bg-white"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] rounded-md"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedSerial && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-2xl shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between">
              <h2 className="text-[14px] font-semibold text-gray-700">
                Serial Details: <span className="font-mono">{selectedSerial.serialNo}</span>
              </h2>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="flex justify-between mb-4">
                <div>
                  <p className="text-[15px] font-semibold text-gray-700">
                    {selectedSerial.itemName}
                  </p>
                  <p className="text-[12px] text-gray-500">
                    Location: {selectedSerial.location || "—"}
                  </p>
                </div>
                {renderStatus(selectedSerial.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-[12px]">
                <div className="border rounded p-3">
                  <p className="text-[10px] uppercase text-gray-500 mb-1">Purchase</p>
                  <p>Date: {selectedSerial.purchaseDate || "—"}</p>
                  <p>Invoice: {selectedSerial.purchaseInvoiceNo || "—"}</p>
                  <p>Supplier: {selectedSerial.supplierName || "—"}</p>
                  <p>Rate: {money(selectedSerial.purchaseRate)}</p>
                </div>

                <div className="border rounded p-3">
                  <p className="text-[10px] uppercase text-gray-500 mb-1">Sale / Warranty</p>
                  <p>Customer: {selectedSerial.customerName || "—"}</p>
                  <p>Sale Date: {selectedSerial.saleDate || "—"}</p>
                  <p>Warranty Expiry: {selectedSerial.warrantyExpiry || "—"}</p>
                  <p className={warrantyTextClass(getWarrantyStatus(selectedSerial).color)}>
                    {getWarrantyStatus(selectedSerial).text}
                  </p>
                </div>
              </div>

              <div className="mt-4 border rounded p-3">
                <p className="text-[10px] uppercase text-gray-500 mb-2">Movement Timeline</p>
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Purchased</span>
                  <span>→</span>
                  <Package className="h-4 w-4 text-green-600" />
                  <span>In Stock</span>
                  {selectedSerial.status !== "in_stock" && (
                    <>
                      <span>→</span>
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span>Sold / Moved</span>
                    </>
                  )}
                  {selectedSerial.status === "in_repair" && (
                    <>
                      <span>→</span>
                      <Wrench className="h-4 w-4 text-amber-600" />
                      <span>In Repair</span>
                    </>
                  )}
                </div>
              </div>

              {selectedSerial.notes && (
                <div className="mt-4 text-[12px] text-gray-700">
                  <p className="font-semibold">Notes</p>
                  <p>{selectedSerial.notes}</p>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-lg flex items-center gap-1"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Warranty Card
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="h-8 px-3 bg-[var(--ds-action-primary)] text-white text-[12px] rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
