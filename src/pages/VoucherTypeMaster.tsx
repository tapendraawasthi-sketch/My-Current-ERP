// src/pages/VoucherTypeMaster.tsx
import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Search, X, Save } from "lucide-react";
import { NumberingType, RenumberingFrequency, RoundOffMode } from "../lib/busyTypes";
import { getDB } from "../lib/db";
import { ReportEmptyState } from "../components/ReportEmptyState";

interface VoucherSeriesItem {
  id: string;
  voucherType: string;
  seriesName: string;
  description: string;
  numberingType: NumberingType;
  renumberingFrequency: RenumberingFrequency;
  embedYearInVchNo: "no" | "prefix" | "suffix";
  prefix: string;
  suffix: string;
  startingNumber: number;
  currentNumber: number;
  enableSettlement: boolean;
  autoRoundOff: boolean;
  roundOffMode: RoundOffMode;
  itemwiseDescription: boolean;
  itemwiseDescriptionLines: number;
  itemwiseDiscount: boolean;
  separateBillingShipping: boolean;
  billSundryNarration: boolean;
  enableAdvancedPOS: boolean;
  pickItemFromBarcode: boolean;
  consolidateItemsOnSave: boolean;
  sendSMSEmail: boolean;
  sendBNSNotification: boolean;
  generateEInvoice: boolean;
  showStockDuringEntry: boolean;
  allowPurchaseReturnInPurchase: boolean;
  isActive: boolean;
}

const VOUCHER_TYPES = [
  "Sales",
  "Purchase",
  "Sales Return (Cr. Note)",
  "Purchase Return (Dr. Note)",
  "Payment",
  "Receipt",
  "Journal",
  "Contra",
  "Debit Note w/o Items",
  "Credit Note w/o Items",
  "Stock Journal",
  "Physical Stock",
  "Stock Transfer",
  "Material Issue to Party",
  "Material Receive from Party",
  "Production",
  "Unassemble",
];

const DEFAULT_SERIES: Omit<VoucherSeriesItem, "id">[] = [
  {
    voucherType: "Sales",
    seriesName: "Tax Invoice",
    description: "Standard tax invoice for sales",
    numberingType: NumberingType.AUTOMATIC,
    renumberingFrequency: RenumberingFrequency.YEARLY,
    embedYearInVchNo: "prefix",
    prefix: "SI-",
    suffix: "",
    startingNumber: 1,
    currentNumber: 1,
    enableSettlement: true,
    autoRoundOff: true,
    roundOffMode: RoundOffMode.AUTOMATIC,
    itemwiseDescription: false,
    itemwiseDescriptionLines: 1,
    itemwiseDiscount: true,
    separateBillingShipping: false,
    billSundryNarration: false,
    enableAdvancedPOS: false,
    pickItemFromBarcode: false,
    consolidateItemsOnSave: false,
    sendSMSEmail: false,
    sendBNSNotification: false,
    generateEInvoice: false,
    showStockDuringEntry: true,
    allowPurchaseReturnInPurchase: false,
    isActive: true,
  },
  {
    voucherType: "Purchase",
    seriesName: "Purchase Invoice",
    description: "Standard purchase voucher",
    numberingType: NumberingType.AUTOMATIC,
    renumberingFrequency: RenumberingFrequency.YEARLY,
    embedYearInVchNo: "prefix",
    prefix: "PUR-",
    suffix: "",
    startingNumber: 1,
    currentNumber: 1,
    enableSettlement: false,
    autoRoundOff: true,
    roundOffMode: RoundOffMode.AUTOMATIC,
    itemwiseDescription: false,
    itemwiseDescriptionLines: 1,
    itemwiseDiscount: true,
    separateBillingShipping: false,
    billSundryNarration: false,
    enableAdvancedPOS: false,
    pickItemFromBarcode: false,
    consolidateItemsOnSave: false,
    sendSMSEmail: false,
    sendBNSNotification: false,
    generateEInvoice: false,
    showStockDuringEntry: true,
    allowPurchaseReturnInPurchase: true,
    isActive: true,
  },
  {
    voucherType: "Payment",
    seriesName: "Payment",
    description: "Payment voucher",
    numberingType: NumberingType.AUTOMATIC,
    renumberingFrequency: RenumberingFrequency.YEARLY,
    embedYearInVchNo: "prefix",
    prefix: "PAY-",
    suffix: "",
    startingNumber: 1,
    currentNumber: 1,
    enableSettlement: false,
    autoRoundOff: false,
    roundOffMode: RoundOffMode.AUTOMATIC,
    itemwiseDescription: false,
    itemwiseDescriptionLines: 1,
    itemwiseDiscount: false,
    separateBillingShipping: false,
    billSundryNarration: false,
    enableAdvancedPOS: false,
    pickItemFromBarcode: false,
    consolidateItemsOnSave: false,
    sendSMSEmail: false,
    sendBNSNotification: false,
    generateEInvoice: false,
    showStockDuringEntry: false,
    allowPurchaseReturnInPurchase: false,
    isActive: true,
  },
  {
    voucherType: "Receipt",
    seriesName: "Receipt",
    description: "Receipt voucher",
    numberingType: NumberingType.AUTOMATIC,
    renumberingFrequency: RenumberingFrequency.YEARLY,
    embedYearInVchNo: "prefix",
    prefix: "REC-",
    suffix: "",
    startingNumber: 1,
    currentNumber: 1,
    enableSettlement: false,
    autoRoundOff: false,
    roundOffMode: RoundOffMode.AUTOMATIC,
    itemwiseDescription: false,
    itemwiseDescriptionLines: 1,
    itemwiseDiscount: false,
    separateBillingShipping: false,
    billSundryNarration: false,
    enableAdvancedPOS: false,
    pickItemFromBarcode: false,
    consolidateItemsOnSave: false,
    sendSMSEmail: false,
    sendBNSNotification: false,
    generateEInvoice: false,
    showStockDuringEntry: false,
    allowPurchaseReturnInPurchase: false,
    isActive: true,
  },
  {
    voucherType: "Journal",
    seriesName: "Journal",
    description: "Journal voucher",
    numberingType: NumberingType.AUTOMATIC,
    renumberingFrequency: RenumberingFrequency.YEARLY,
    embedYearInVchNo: "prefix",
    prefix: "JV-",
    suffix: "",
    startingNumber: 1,
    currentNumber: 1,
    enableSettlement: false,
    autoRoundOff: false,
    roundOffMode: RoundOffMode.AUTOMATIC,
    itemwiseDescription: false,
    itemwiseDescriptionLines: 1,
    itemwiseDiscount: false,
    separateBillingShipping: false,
    billSundryNarration: false,
    enableAdvancedPOS: false,
    pickItemFromBarcode: false,
    consolidateItemsOnSave: false,
    sendSMSEmail: false,
    sendBNSNotification: false,
    generateEInvoice: false,
    showStockDuringEntry: false,
    allowPurchaseReturnInPurchase: false,
    isActive: true,
  },
  {
    voucherType: "Contra",
    seriesName: "Contra",
    description: "Cash/Bank transfers",
    numberingType: NumberingType.AUTOMATIC,
    renumberingFrequency: RenumberingFrequency.YEARLY,
    embedYearInVchNo: "prefix",
    prefix: "CON-",
    suffix: "",
    startingNumber: 1,
    currentNumber: 1,
    enableSettlement: false,
    autoRoundOff: false,
    roundOffMode: RoundOffMode.AUTOMATIC,
    itemwiseDescription: false,
    itemwiseDescriptionLines: 1,
    itemwiseDiscount: false,
    separateBillingShipping: false,
    billSundryNarration: false,
    enableAdvancedPOS: false,
    pickItemFromBarcode: false,
    consolidateItemsOnSave: false,
    sendSMSEmail: false,
    sendBNSNotification: false,
    generateEInvoice: false,
    showStockDuringEntry: false,
    allowPurchaseReturnInPurchase: false,
    isActive: true,
  },
];

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const defaultForm = (voucherType = "Sales"): Omit<VoucherSeriesItem, "id"> => ({
  voucherType,
  seriesName: "",
  description: "",
  numberingType: NumberingType.AUTOMATIC,
  renumberingFrequency: RenumberingFrequency.YEARLY,
  embedYearInVchNo: "prefix",
  prefix: "",
  suffix: "",
  startingNumber: 1,
  currentNumber: 1,
  enableSettlement: false,
  autoRoundOff: false,
  roundOffMode: RoundOffMode.AUTOMATIC,
  itemwiseDescription: false,
  itemwiseDescriptionLines: 1,
  itemwiseDiscount: false,
  separateBillingShipping: false,
  billSundryNarration: false,
  enableAdvancedPOS: false,
  pickItemFromBarcode: false,
  consolidateItemsOnSave: false,
  sendSMSEmail: false,
  sendBNSNotification: false,
  generateEInvoice: false,
  showStockDuringEntry: true,
  allowPurchaseReturnInPurchase: false,
  isActive: true,
});

export default function VoucherTypeMaster() {
  const [series, setSeries] = useState<VoucherSeriesItem[]>([]);
  const [selectedType, setSelectedType] = useState<string>("Sales");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<VoucherSeriesItem | null>(null);
  const [activeTab, setActiveTab] = useState<"numbering" | "features">("numbering");
  const [form, setForm] = useState<Omit<VoucherSeriesItem, "id">>(defaultForm());

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    try {
      const db = getDB();
      if (db.voucherSeriesConfig) {
        const data = await db.voucherSeriesConfig.toArray();
        if (data.length === 0) {
          const seeded = DEFAULT_SERIES.map((d, i) => ({ ...d, id: `vs-${i}` }));
          await db.voucherSeriesConfig.bulkPut(seeded);
          setSeries(seeded);
        } else setSeries(data);
      } else {
        setSeries(DEFAULT_SERIES.map((d, i) => ({ ...d, id: `vs-${i}` })));
      }
    } catch {
      setSeries(DEFAULT_SERIES.map((d, i) => ({ ...d, id: `vs-${i}` })));
    }
  };

  const filteredSeries = useMemo(() => {
    const byType = series.filter((s) => s.voucherType === selectedType);
    const q = search.trim().toLowerCase();
    if (!q) return byType;
    return byType.filter(
      (s) =>
        s.seriesName.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.prefix.toLowerCase().includes(q),
    );
  }, [series, selectedType, search]);

  const resetForm = () => {
    setShowForm(false);
    setEditItem(null);
    setActiveTab("numbering");
    setForm(defaultForm(selectedType));
  };

  const openAdd = () => {
    setEditItem(null);
    const count = series.filter((s) => s.voucherType === selectedType).length;
    setForm({
      ...defaultForm(selectedType),
      voucherType: selectedType,
      seriesName: `${selectedType} ${count + 1}`,
      prefix: selectedType.substring(0, 3).toUpperCase() + "-",
    });
    setActiveTab("numbering");
    setShowForm(true);
  };

  const openEdit = (item: VoucherSeriesItem) => {
    setEditItem(item);
    const { id, ...rest } = item;
    setForm(rest);
    setActiveTab("numbering");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.seriesName.trim()) {
      toast.error("Series name is required");
      return;
    }
    const totalLen = form.prefix.length + form.suffix.length + String(form.startingNumber).length;
    if (totalLen > 16) {
      toast.error("Total voucher number length cannot exceed 16 characters");
      return;
    }
    try {
      const db = getDB();
      if (editItem) {
        const updated = { ...editItem, ...form };
        if (db.voucherSeriesConfig) await db.voucherSeriesConfig.put(updated);
        setSeries((prev) => prev.map((s) => (s.id === editItem.id ? updated : s)));
        toast.success("Voucher Series updated");
      } else {
        const newItem: VoucherSeriesItem = { ...form, id: `vs-${Date.now()}` };
        if (db.voucherSeriesConfig) await db.voucherSeriesConfig.put(newItem);
        setSeries((prev) => [...prev, newItem]);
        toast.success("Voucher Series added");
      }
      resetForm();
    } catch {
      toast.error("Failed to save");
    }
  };

  const setF = (k: keyof typeof form, v: any) => setForm((prev) => ({ ...prev, [k]: v }));

  const previewVchNo = () => {
    const yr = new Date().getFullYear().toString().slice(-2);
    const num = String(form.startingNumber).padStart(4, "0");
    if (form.embedYearInVchNo === "prefix") return `${form.prefix}${yr}-${num}${form.suffix}`;
    if (form.embedYearInVchNo === "suffix") return `${form.prefix}${num}-${yr}${form.suffix}`;
    return `${form.prefix}${num}${form.suffix}`;
  };

  const featureToggles = [
    {
      key: "enableSettlement",
      label: "Enable Settlement Details",
      desc: "Settlement window at save (cash/cheque/card at billing time)",
    },
    {
      key: "autoRoundOff",
      label: "Auto Round Off Final Amount",
      desc: "Automatically round invoice total",
    },
    {
      key: "itemwiseDescription",
      label: "Item-wise Description",
      desc: "Multiple description lines per item",
    },
    {
      key: "itemwiseDiscount",
      label: "Item-wise Discount",
      desc: "Discount % and amount columns in item grid",
    },
    {
      key: "separateBillingShipping",
      label: "Separate Billing/Shipping Details",
      desc: "Billing To and Shipping To addresses for GST Place of Supply",
    },
    {
      key: "billSundryNarration",
      label: "Bill Sundry-wise Narration",
      desc: "Narration per bill sundry line",
    },
    {
      key: "enableAdvancedPOS",
      label: "Enable Advanced POS Data Entry",
      desc: "Barcode-based fast billing",
    },
    {
      key: "pickItemFromBarcode",
      label: "Pick Item Names from Barcode",
      desc: "Scan barcode to auto-pick item",
    },
    {
      key: "consolidateItemsOnSave",
      label: "Consolidate Items While Saving",
      desc: "Merge duplicate items",
    },
    {
      key: "sendSMSEmail",
      label: "Send SMS/Email After Saving",
      desc: "Auto communication to party",
    },
    {
      key: "sendBNSNotification",
      label: "Send Notification to BNS App",
      desc: "Push notification to owner's mobile",
    },
    {
      key: "generateEInvoice",
      label: "Generate E-Invoice After Saving",
      desc: "Auto-push to GST portal",
    },
    {
      key: "showStockDuringEntry",
      label: "Show Stock During Entry",
      desc: "Stock balance visible in item dropdown",
    },
    {
      key: "allowPurchaseReturnInPurchase",
      label: "Allow Purchase Return in Purchase",
      desc: "Enter negative quantity for returns",
    },
  ];

  const renderFeatureBadges = (item: VoucherSeriesItem) => {
    const badges: { label: string; cls: string }[] = [];
    if (item.enableSettlement)
      badges.push({ label: "Settlement", cls: "bg-blue-100 text-blue-700" });
    if (item.autoRoundOff) badges.push({ label: "Round-off", cls: "bg-green-100 text-green-700" });
    if (item.itemwiseDiscount)
      badges.push({ label: "Item disc.", cls: "bg-amber-100 text-amber-700" });
    if (item.generateEInvoice)
      badges.push({ label: "E-Invoice", cls: "bg-blue-100 text-blue-700" });
    if (item.enableAdvancedPOS) badges.push({ label: "POS", cls: "bg-gray-100 text-gray-700" });
    if (badges.length === 0) return <span className="text-gray-400">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {badges.map((b) => (
          <span
            key={b.label}
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${b.cls}`}
          >
            {b.label}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      {/* Voucher type nav */}
      <div className="w-52 shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="px-3 py-2.5 border-b border-gray-200 bg-[#f5f6fa] text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          Voucher types
        </div>
        <div className="flex-1 overflow-y-auto">
          {VOUCHER_TYPES.map((vt) => {
            const count = series.filter((s) => s.voucherType === vt).length;
            const active = selectedType === vt;
            return (
              <button
                key={vt}
                type="button"
                onClick={() => {
                  setSelectedType(vt);
                  setSearch("");
                }}
                className={`w-full text-left px-3 py-2 text-[12px] flex items-center justify-between border-b border-gray-100 transition-colors ${
                  active
                    ? "bg-[#1557b0] text-white border-l-[3px] border-l-[#0f4a96]"
                    : "text-gray-700 hover:bg-gray-50 border-l-[3px] border-l-transparent"
                }`}
              >
                <span className="truncate pr-1">{vt}</span>
                <span
                  className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Series list */}
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">
                Voucher Series Configuration
              </h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Numbering, features, settlement, and round-off per voucher type and series
              </p>
            </div>
            <button type="button" className={btnPrimary} onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add series
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                placeholder={`Search ${selectedType} series...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputCls} pl-8`}
              />
            </div>
            <span className="text-[11px] text-gray-500">{selectedType}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filteredSeries.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message={
                  search
                    ? "No series match your search"
                    : `No series configured for ${selectedType}`
                }
                hint={
                  search
                    ? "Try a different search term."
                    : 'Click "Add series" to create a new voucher series.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Series name</th>
                    <th className={th}>Description</th>
                    <th className={th}>Prefix</th>
                    <th className={`${th} text-right`}>Current #</th>
                    <th className={th}>Numbering</th>
                    <th className={th}>Features</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSeries.map((item) => (
                    <tr
                      key={item.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0]"
                      onClick={() => openEdit(item)}
                    >
                      <td className={`${td} font-medium text-gray-800`}>{item.seriesName}</td>
                      <td className={`${td} text-gray-500 max-w-[180px] truncate`}>
                        {item.description || "—"}
                      </td>
                      <td className={`${td} font-mono`}>{item.prefix || "—"}</td>
                      <td className={`${td} text-right font-mono`}>#{item.currentNumber}</td>
                      <td className={td}>{item.numberingType}</td>
                      <td className={td}>{renderFeatureBadges(item)}</td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(item);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {filteredSeries.length} series for {selectedType}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-in form panel */}
      {showForm && (
        <div className="w-[min(640px,100%)] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <div>
              <span className="text-[13px] font-semibold text-gray-800">
                {editItem ? "Edit" : "Add"} voucher series — {form.voucherType}
              </span>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Preview:{" "}
                <span className="font-mono font-semibold text-[#1557b0]">{previewVchNo()}</span>
              </p>
            </div>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex border-b border-gray-200 shrink-0">
            {(["numbering", "features"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-[#1557b0] text-[#1557b0]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "numbering" ? "Numbering & basic" : "Features & options"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "numbering" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Series name *</label>
                    <input
                      value={form.seriesName}
                      onChange={(e) => setF("seriesName", e.target.value)}
                      className={inputCls}
                      placeholder="e.g. Tax Invoice, Retail Sale"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <input
                      value={form.description}
                      onChange={(e) => setF("description", e.target.value)}
                      className={inputCls}
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Numbering type</label>
                    <select
                      value={form.numberingType}
                      onChange={(e) => setF("numberingType", e.target.value)}
                      className={inputCls}
                    >
                      <option value={NumberingType.AUTOMATIC}>Automatic</option>
                      <option value={NumberingType.MANUAL}>Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Renumbering frequency</label>
                    <select
                      value={form.renumberingFrequency}
                      onChange={(e) => setF("renumberingFrequency", e.target.value)}
                      className={inputCls}
                    >
                      <option value={RenumberingFrequency.NEVER}>Never</option>
                      <option value={RenumberingFrequency.DAILY}>Daily</option>
                      <option value={RenumberingFrequency.MONTHLY}>Monthly</option>
                      <option value={RenumberingFrequency.YEARLY}>Yearly</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Prefix</label>
                    <input
                      value={form.prefix}
                      onChange={(e) => setF("prefix", e.target.value)}
                      className={inputCls}
                      placeholder="e.g. SI-, TAX/"
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Suffix</label>
                    <input
                      value={form.suffix}
                      onChange={(e) => setF("suffix", e.target.value)}
                      className={inputCls}
                      placeholder="Optional suffix"
                      maxLength={4}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Starting number</label>
                    <input
                      type="number"
                      value={form.startingNumber}
                      onChange={(e) => setF("startingNumber", +e.target.value)}
                      className={`${inputCls} font-mono`}
                      min={1}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Embed year in voucher number</label>
                  <select
                    value={form.embedYearInVchNo}
                    onChange={(e) => setF("embedYearInVchNo", e.target.value)}
                    className={inputCls}
                  >
                    <option value="no">No</option>
                    <option value="prefix">As prefix (year before number)</option>
                    <option value="suffix">As suffix (year after number)</option>
                  </select>
                </div>
                <div
                  className={`p-3 rounded-md text-[12px] border ${
                    previewVchNo().length > 16
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-green-50 text-green-700 border-green-200"
                  }`}
                >
                  <strong>Preview:</strong>{" "}
                  <span className="font-mono font-bold">{previewVchNo()}</span>
                  <span className="text-[10px] ml-2 opacity-80">
                    ({previewVchNo().length} chars, max 16)
                  </span>
                  {previewVchNo().length > 16 && (
                    <span className="ml-2 font-medium">Exceeds 16 character limit</span>
                  )}
                </div>
              </div>
            )}

            {activeTab === "features" && (
              <div className="space-y-2">
                {featureToggles.map(({ key, label, desc }) => (
                  <div
                    key={key}
                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      id={key}
                      checked={!!(form as any)[key]}
                      onChange={(e) => setF(key as any, e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    <label htmlFor={key} className="cursor-pointer flex-1">
                      <div className="text-[12px] font-medium text-gray-800">{label}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{desc}</div>
                    </label>
                  </div>
                ))}
                {form.autoRoundOff && (
                  <div className="p-3 border border-gray-200 bg-gray-50 rounded-md">
                    <label className={labelCls}>Round off mode</label>
                    <select
                      value={form.roundOffMode}
                      onChange={(e) => setF("roundOffMode", e.target.value)}
                      className={inputCls}
                    >
                      <option value={RoundOffMode.AUTOMATIC}>Automatic (nearest)</option>
                      <option value={RoundOffMode.ALWAYS_UPPER}>Always upper (ceiling)</option>
                      <option value={RoundOffMode.ALWAYS_LOWER}>Always lower (floor)</option>
                    </select>
                  </div>
                )}
                {form.itemwiseDescription && (
                  <div className="p-3 border border-gray-200 bg-gray-50 rounded-md">
                    <label className={labelCls}>Description lines per item</label>
                    <input
                      type="number"
                      value={form.itemwiseDescriptionLines}
                      onChange={(e) => setF("itemwiseDescriptionLines", +e.target.value)}
                      className={`${inputCls} w-32 font-mono`}
                      min={1}
                      max={5}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200 shrink-0">
            <button type="button" className={btnPrimary} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              {editItem ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
