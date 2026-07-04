// src/pages/VoucherTypeMaster.tsx
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Plus, Edit2, Settings, ChevronRight } from "lucide-react";
import { NumberingType, RenumberingFrequency, RoundOffMode } from "../lib/busyTypes";
import { getDB } from "../lib/db";

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
  // Features
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

export default function VoucherTypeMaster() {
  const [series, setSeries] = useState<VoucherSeriesItem[]>([]);
  const [selectedType, setSelectedType] = useState<string>("Sales");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<VoucherSeriesItem | null>(null);
  const [activeTab, setActiveTab] = useState<"numbering" | "features">("numbering");
  const [form, setForm] = useState<Omit<VoucherSeriesItem, "id">>({
    voucherType: "Sales",
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

  const filteredSeries = series.filter((s) => s.voucherType === selectedType);

  const openAdd = () => {
    setEditItem(null);
    setForm({
      ...form,
      voucherType: selectedType,
      seriesName: `${selectedType} ${filteredSeries.length + 1}`,
      prefix: selectedType.substring(0, 3).toUpperCase() + "-",
    });
    setActiveTab("numbering");
    setShowModal(true);
  };

  const openEdit = (item: VoucherSeriesItem) => {
    setEditItem(item);
    const { id, ...rest } = item;
    setForm(rest);
    setActiveTab("numbering");
    setShowModal(true);
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
      setShowModal(false);
    } catch {
      toast.error("Failed to save");
    }
  };

  const setF = (k: keyof typeof form, v: any) => setForm((prev) => ({ ...prev, [k]: v }));
  const inputCls =
    "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

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

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Voucher Series Configuration</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Configure voucher numbering, features, settlement, round-off for each voucher type and
            series
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Left: Voucher Types */}
        <div className="w-56 bg-white border border-gray-200 rounded-lg overflow-hidden shrink-0">
          <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Voucher Types
          </div>
          {VOUCHER_TYPES.map((vt) => (
            <button
              key={vt}
              onClick={() => setSelectedType(vt)}
              className={`w-full text-left px-3 py-2 text-[12px] flex items-center justify-between border-b border-gray-100 last:border-0 transition-colors ${selectedType === vt ? "bg-[#1557b0] text-white" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <span>{vt}</span>
              <div className="flex items-center gap-1">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${selectedType === vt ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}
                >
                  {series.filter((s) => s.voucherType === vt).length}
                </span>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </div>
            </button>
          ))}
        </div>

        {/* Right: Series List */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-gray-800">
              {selectedType} — Series Configuration
            </h2>
            <button
              onClick={openAdd}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add Series
            </button>
          </div>

          {filteredSeries.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <Settings className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-[13px] font-medium text-gray-500">
                No series configured for {selectedType}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Click "Add Series" to create a new voucher series
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSeries.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-[13px] font-semibold text-gray-800">{item.seriesName}</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">{item.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-600">
                        <span>
                          Prefix: <strong className="font-mono">{item.prefix || "—"}</strong>
                        </span>
                        <span>
                          Current: <strong className="font-mono">#{item.currentNumber}</strong>
                        </span>
                        <span>
                          Numbering: <strong>{item.numberingType}</strong>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {item.enableSettlement && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold border border-blue-100">
                            Settlement
                          </span>
                        )}
                        {item.autoRoundOff && (
                          <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-semibold border border-green-100">
                            Auto Round-off
                          </span>
                        )}
                        {item.itemwiseDiscount && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-semibold border border-amber-100">
                            Item Discount
                          </span>
                        )}
                        {item.generateEInvoice && (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-semibold border border-purple-100">
                            E-Invoice
                          </span>
                        )}
                        {item.enableAdvancedPOS && (
                          <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-[10px] font-semibold border border-orange-100">
                            POS
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => openEdit(item)}
                      className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md hover:bg-gray-50 flex items-center gap-1.5"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Configure
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-[15px] font-semibold text-gray-800">
                  {editItem ? "Modify" : "Add"} Voucher Series — {form.voucherType}
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Preview:{" "}
                  <span className="font-mono font-semibold text-[#1557b0]">{previewVchNo()}</span>
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex border-b border-gray-200 shrink-0">
              {(["numbering", "features"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-[12px] font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? "border-[#1557b0] text-[#1557b0]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  {tab === "numbering" ? "Numbering & Basic" : "Features & Options"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "numbering" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Series Name *</label>
                      <input
                        value={form.seriesName}
                        onChange={(e) => setF("seriesName", e.target.value)}
                        className={`${inputCls} w-full`}
                        placeholder="e.g. Tax Invoice, Retail Sale"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Description</label>
                      <input
                        value={form.description}
                        onChange={(e) => setF("description", e.target.value)}
                        className={`${inputCls} w-full`}
                        placeholder="Optional description"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Numbering Type</label>
                      <select
                        value={form.numberingType}
                        onChange={(e) => setF("numberingType", e.target.value)}
                        className={`${inputCls} w-full`}
                      >
                        <option value={NumberingType.AUTOMATIC}>Automatic</option>
                        <option value={NumberingType.MANUAL}>Manual</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Renumbering Frequency</label>
                      <select
                        value={form.renumberingFrequency}
                        onChange={(e) => setF("renumberingFrequency", e.target.value)}
                        className={`${inputCls} w-full`}
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
                        className={`${inputCls} w-full`}
                        placeholder="e.g. SI-, TAX/"
                        maxLength={8}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Suffix</label>
                      <input
                        value={form.suffix}
                        onChange={(e) => setF("suffix", e.target.value)}
                        className={`${inputCls} w-full`}
                        placeholder="Optional suffix"
                        maxLength={4}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Starting Number</label>
                      <input
                        type="number"
                        value={form.startingNumber}
                        onChange={(e) => setF("startingNumber", +e.target.value)}
                        className={`${inputCls} w-full`}
                        min={1}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Embed Year in Voucher Number</label>
                    <select
                      value={form.embedYearInVchNo}
                      onChange={(e) => setF("embedYearInVchNo", e.target.value)}
                      className={`${inputCls} w-full`}
                    >
                      <option value="no">No</option>
                      <option value="prefix">As Prefix (year before number)</option>
                      <option value="suffix">As Suffix (year after number)</option>
                    </select>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[12px] text-blue-700">
                    <strong>Preview:</strong>{" "}
                    <span className="font-mono font-bold">{previewVchNo()}</span>
                    <span className="text-[10px] ml-2 text-blue-500">
                      (Total: {previewVchNo().length} chars, max 16)
                    </span>
                    {previewVchNo().length > 16 && (
                      <span className="text-red-600 ml-2">⚠ Exceeds 16 character limit!</span>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "features" && (
                <div className="space-y-2">
                  {featureToggles.map(({ key, label, desc }) => (
                    <div
                      key={key}
                      className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        id={key}
                        checked={!!(form as any)[key]}
                        onChange={(e) => setF(key as any, e.target.checked)}
                        className="mt-0.5 rounded"
                      />
                      <label htmlFor={key} className="cursor-pointer flex-1">
                        <div className="text-[12px] font-medium text-gray-800">{label}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{desc}</div>
                      </label>
                    </div>
                  ))}
                  {form.autoRoundOff && (
                    <div className="p-3 border border-green-200 bg-green-50 rounded-lg">
                      <label className={labelCls}>Round Off Mode</label>
                      <select
                        value={form.roundOffMode}
                        onChange={(e) => setF("roundOffMode", e.target.value)}
                        className={`${inputCls} w-full`}
                      >
                        <option value={RoundOffMode.AUTOMATIC}>Automatic (nearest)</option>
                        <option value={RoundOffMode.ALWAYS_UPPER}>Always Upper (ceiling)</option>
                        <option value={RoundOffMode.ALWAYS_LOWER}>Always Lower (floor)</option>
                      </select>
                    </div>
                  )}
                  {form.itemwiseDescription && (
                    <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
                      <label className={labelCls}>Description Lines per Item</label>
                      <input
                        type="number"
                        value={form.itemwiseDescriptionLines}
                        onChange={(e) => setF("itemwiseDescriptionLines", +e.target.value)}
                        className={`${inputCls} w-32`}
                        min={1}
                        max={5}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md hover:bg-gray-50"
              >
                Cancel (Esc)
              </button>
              <button
                onClick={handleSave}
                className="h-8 px-3 bg-[#1557b0] text-white text-[12px] rounded-md hover:bg-[#0f4a96]"
              >
                Save (F2)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
