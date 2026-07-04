// src/pages/QuotationPage.tsx
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { Plus, Search, X, Printer, FileText } from "lucide-react";
import { formatNumber } from "../lib/utils";

interface QuotationLine {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  amount: number;
}

interface Quotation {
  id: string;
  quotationNo: string;
  date: string;
  validUpto: string;
  partyId: string;
  partyName: string;
  lines: QuotationLine[];
  narration: string;
  totalAmount: number;
  status: "open" | "accepted" | "rejected" | "expired";
  terms?: string;
}

interface Props {
  type: "sales_quotation" | "purchase_quotation";
}

export default function QuotationPage({ type }: Props) {
  const { items, parties } = useStore();
  const isSales = type === "sales_quotation";
  const title = isSales ? "Sales Quotation" : "Purchase Quotation";
  const prefix = isSales ? "SQ-" : "PQ-";

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Quotation["status"]>("all");
  const [showForm, setShowForm] = useState(false);
  const [editQuotation, setEditQuotation] = useState<Quotation | null>(null);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUpto, setValidUpto] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [partyId, setPartyId] = useState("");
  const [narration, setNarration] = useState("");
  const [terms, setTerms] = useState("Payment: 30 days credit\nDelivery: Within 7 working days");
  const [lines, setLines] = useState<Omit<QuotationLine, "id">[]>([
    { itemId: "", itemName: "", quantity: 1, unit: "Pcs", rate: 0, discountPercent: 0, amount: 0 },
  ]);

  const partyList = (parties || []).filter((p: any) =>
    isSales
      ? p.type === "customer" || p.type === "both"
      : p.type === "supplier" || p.type === "both",
  );

  const filtered = useMemo(
    () =>
      quotations.filter((q) => {
        const matchSearch =
          q.quotationNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.partyName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === "all" || q.status === statusFilter;
        return matchSearch && matchStatus;
      }),
    [quotations, searchTerm, statusFilter],
  );

  const handleLineChange = (idx: number, field: string, value: any) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const updated: any = { ...l, [field]: value };
        if (field === "itemId") {
          const item = (items || []).find((it: any) => it.id === value);
          if (item) {
            updated.itemName = item.name;
            updated.rate = (item as any).saleRate || (item as any).sellingPrice || 0;
            updated.unit = (item as any).unit || "Pcs";
          }
        }
        const qty = field === "quantity" ? +value : updated.quantity;
        const rate = field === "rate" ? +value : updated.rate;
        const disc = field === "discountPercent" ? +value : updated.discountPercent;
        updated.amount = qty * rate * (1 - disc / 100);
        return updated;
      }),
    );
  };

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      {
        itemId: "",
        itemName: "",
        quantity: 1,
        unit: "Pcs",
        rate: 0,
        discountPercent: 0,
        amount: 0,
      },
    ]);
  const removeLine = (idx: number) => {
    if (lines.length > 1) setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);

  const openAdd = () => {
    setEditQuotation(null);
    setDate(new Date().toISOString().split("T")[0]);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setValidUpto(d.toISOString().split("T")[0]);
    setPartyId("");
    setNarration("");
    setTerms("Payment: 30 days credit\nDelivery: Within 7 working days");
    setLines([
      {
        itemId: "",
        itemName: "",
        quantity: 1,
        unit: "Pcs",
        rate: 0,
        discountPercent: 0,
        amount: 0,
      },
    ]);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!partyId) {
      toast.error("Select a party");
      return;
    }
    if (lines.some((l) => !l.itemId)) {
      toast.error("All rows must have an item selected");
      return;
    }
    const party = partyList.find((p: any) => p.id === partyId);
    const newQuotation: Quotation = {
      id: `q-${Date.now()}`,
      quotationNo: `${prefix}${String(quotations.length + 1).padStart(4, "0")}`,
      date,
      validUpto,
      partyId,
      partyName: (party as any)?.name || "",
      lines: lines.map((l, i) => ({ ...l, id: `ql-${i}` })),
      narration,
      totalAmount,
      status: "open",
      terms,
    };
    setQuotations((prev) =>
      editQuotation
        ? prev.map((q) =>
            q.id === editQuotation.id
              ? { ...newQuotation, id: editQuotation.id, quotationNo: editQuotation.quotationNo }
              : q,
          )
        : [...prev, newQuotation],
    );
    toast.success(`${title} ${editQuotation ? "updated" : "saved"} — ${newQuotation.quotationNo}`);
    setShowForm(false);
  };

  const updateStatus = (id: string, status: Quotation["status"]) => {
    setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    toast.success(`Quotation marked as ${status}`);
  };

  const inputCls =
    "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

  const statusBadge = (status: Quotation["status"]) => {
    const map: Record<Quotation["status"], string> = {
      open: "bg-blue-100 text-blue-700",
      accepted: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
      expired: "bg-gray-100 text-gray-600",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${map[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  // ── FORM VIEW ─────────────────────────────────────────────────────────────
  if (showForm) {
    return (
      <div className="p-4 bg-[#f5f6fa] min-h-screen">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">
              {editQuotation ? "Modify" : "Add"} {title}
            </h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Quotation No:{" "}
              <strong>
                {prefix}
                {String(quotations.length + 1).padStart(4, "0")}
              </strong>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md hover:bg-gray-50"
            >
              ← Back (Esc)
            </button>
            <button
              onClick={handleSave}
              className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96]"
            >
              Save (F2)
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className={labelCls}>Valid Upto *</label>
              <input
                type="date"
                value={validUpto}
                onChange={(e) => setValidUpto(e.target.value)}
                className={`${inputCls} w-full`}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>{isSales ? "Customer" : "Supplier"} *</label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className={`${inputCls} w-full`}
              >
                <option value="">— Select {isSales ? "Customer" : "Supplier"} —</option>
                {partyList.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Item grid */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-[#f5f6fa] flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
              Item Details
            </span>
            <button
              onClick={addLine}
              className="h-7 px-2 text-[11px] bg-[#1557b0] text-white rounded flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add Row (F5)
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#f5f6fa]">
                  {["#", "Item", "Qty", "Unit", "Rate", "Disc %", "Amount", ""].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[11px] text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-1">
                      <select
                        value={line.itemId}
                        onChange={(e) => handleLineChange(idx, "itemId", e.target.value)}
                        className={`${inputCls} w-full`}
                      >
                        <option value="">— Select Item —</option>
                        {(items || [])
                          .filter((i: any) => i.isActive !== false)
                          .map((i: any) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                        className={`${inputCls} w-20 text-right`}
                        min={0.01}
                        step={0.01}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={line.unit}
                        onChange={(e) => handleLineChange(idx, "unit", e.target.value)}
                        className={`${inputCls} w-20`}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        value={line.rate}
                        onChange={(e) => handleLineChange(idx, "rate", e.target.value)}
                        className={`${inputCls} w-28 text-right`}
                        min={0}
                        step={0.01}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        value={line.discountPercent}
                        onChange={(e) => handleLineChange(idx, "discountPercent", e.target.value)}
                        className={`${inputCls} w-20 text-right`}
                        min={0}
                        max={100}
                        step={0.1}
                      />
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right">
                      {formatNumber(line.amount)}
                    </td>
                    <td className="px-2 py-1">
                      <button
                        onClick={() => removeLine(idx)}
                        className="p-1 text-red-400 hover:bg-red-50 rounded"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Total bar */}
          <div className="px-4 py-3 border-t border-gray-200 bg-[#eef2ff] flex justify-end">
            <div className="text-right">
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">
                Quotation Total
              </div>
              <div className="text-[16px] font-bold text-gray-800 font-mono">
                Rs. {formatNumber(totalAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* Narration + Terms */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
            <label className={labelCls}>Narration</label>
            <textarea
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 resize-none"
              rows={2}
              placeholder="e.g. Being quotation submitted as per request"
            />
          </div>
          <div>
            <label className={labelCls}>Terms &amp; Conditions</label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 resize-none font-mono"
              rows={4}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Manage quotations — convert accepted quotations to{" "}
            {isSales ? "sales orders / invoices" : "purchase orders"} via F11
          </p>
        </div>
        <button
          onClick={openAdd}
          className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add {title}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search quotations..."
              className="h-8 pl-8 pr-3 text-[12px] border border-gray-300 rounded-md w-52 focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "open", "accepted", "rejected", "expired"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`h-7 px-3 rounded text-[11px] font-medium capitalize transition-colors ${statusFilter === s ? "bg-[#1557b0] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              {[
                "Quotation No.",
                "Date",
                "Valid Upto",
                isSales ? "Customer" : "Supplier",
                "Items",
                "Total",
                "Status",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] font-mono font-bold text-[#1557b0]">
                  {q.quotationNo}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{q.date}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">
                  <span
                    className={
                      new Date(q.validUpto) < new Date() && q.status === "open"
                        ? "text-red-500 font-semibold"
                        : ""
                    }
                  >
                    {q.validUpto}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{q.partyName}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{q.lines.length} items</td>
                <td className="px-3 py-2.5 text-[12px] font-mono text-right">
                  Rs. {formatNumber(q.totalAmount)}
                </td>
                <td className="px-3 py-2.5">{statusBadge(q.status)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => {
                        setEditQuotation(q);
                        setLines(q.lines.map(({ id, ...rest }) => rest));
                        setDate(q.date);
                        setValidUpto(q.validUpto);
                        setPartyId(q.partyId);
                        setNarration(q.narration);
                        setTerms(q.terms || "");
                        setShowForm(true);
                      }}
                      className="h-7 px-2 text-[11px] border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    {q.status === "open" && (
                      <>
                        <button
                          onClick={() => updateStatus(q.id, "accepted")}
                          className="h-7 px-2 text-[11px] border border-green-200 text-green-700 rounded hover:bg-green-50"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => updateStatus(q.id, "rejected")}
                          className="h-7 px-2 text-[11px] border border-red-200 text-red-600 rounded hover:bg-red-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button className="h-7 px-2 text-[11px] border border-gray-200 text-gray-500 rounded hover:bg-gray-50 flex items-center gap-1">
                      <Printer className="h-3 w-3" /> Print
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[12px] text-gray-500">
                  No quotations found. Click "Add {title}" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
