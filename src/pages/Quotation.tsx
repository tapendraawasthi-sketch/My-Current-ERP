import React, { useMemo, useState } from "react";
import { ArrowRight, Edit2, Eye, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { useStore } from "@/store/useStore";

interface QuotationLine {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  discount: number;
  amount: number;
  vatPct: number;
  vatAmount: number;
}

interface Quotation {
  id: string;
  quotationNo: string;
  date: string;
  dateNepali: string;
  validUpto: string;
  partyId: string;
  partyName: string;
  partyAddress: string;
  partyContact: string;
  subject: string;
  narration: string;
  lines: QuotationLine[];
  subTotal: number;
  discountAmount: number;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
  status: "draft" | "sent" | "accepted" | "rejected" | "converted" | "expired";
  convertedToOrderId?: string;
  convertedToInvoiceId?: string;
  createdAt: string;
  terms: string;
}

const STORAGE_KEY = "sutra_quotations";

function loadQuotations(): Quotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQuotation(q: Quotation): void {
  const all = loadQuotations();
  const idx = all.findIndex((x) => x.id === q.id);
  if (idx >= 0) all[idx] = q;
  else all.push(q);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function deleteQuotation(id: string): void {
  const all = loadQuotations().filter((q) => q.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function generateQuotationNo(): string {
  const max = loadQuotations().reduce((m, q) => {
    const n = parseInt(String(q.quotationNo || "").replace(/\D+/g, ""), 10) || 0;
    return Math.max(m, n);
  }, 0);
  return `QT-${String(max + 1).padStart(4, "0")}`;
}

function createBlankLine(): QuotationLine {
  return {
    id: crypto.randomUUID(),
    itemId: "",
    itemName: "",
    description: "",
    qty: 1,
    unit: "Pcs",
    rate: 0,
    discount: 0,
    amount: 0,
    vatPct: 13,
    vatAmount: 0,
  };
}

function calculateLine(line: QuotationLine): QuotationLine {
  const gross = Number(line.qty || 0) * Number(line.rate || 0);
  const amount = gross * (1 - Number(line.discount || 0) / 100);
  const vatAmount = amount * (Number(line.vatPct || 0) / 100);
  return { ...line, amount, vatAmount };
}

function calculateTotals(lines: QuotationLine[]) {
  const subTotal = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.rate || 0), 0);
  const discountAmount = lines.reduce(
    (s, l) => s + Number(l.qty || 0) * Number(l.rate || 0) * (Number(l.discount || 0) / 100),
    0,
  );
  const taxableAmount = subTotal - discountAmount;
  const vatAmount = lines.reduce((s, l) => s + Number(l.vatAmount || 0), 0);
  const totalAmount = taxableAmount + vatAmount;
  return { subTotal, discountAmount, taxableAmount, vatAmount, totalAmount };
}

function newQuotation(): Quotation {
  return {
    id: "",
    quotationNo: generateQuotationNo(),
    date: new Date().toISOString().split("T")[0],
    dateNepali: "",
    validUpto: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    partyId: "",
    partyName: "",
    partyAddress: "",
    partyContact: "",
    subject: "Quotation for Supply of Goods",
    narration: "",
    lines: [createBlankLine()],
    subTotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    vatAmount: 0,
    totalAmount: 0,
    status: "draft",
    createdAt: new Date().toISOString(),
    terms: "Payment due within 30 days. Prices valid for 30 days from date of quotation.",
  };
}

function money(n: number) {
  return Number(n || 0).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusClass(status: Quotation["status"]) {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-700";
    case "sent":
      return "bg-blue-100 text-blue-700";
    case "accepted":
      return "bg-green-100 text-green-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    case "converted":
      return "bg-purple-100 text-purple-700";
    case "expired":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function Quotation() {
  const store = useStore() as any;
  const accounts = store.accounts ?? [];
  const items = store.items ?? [];
  const currentCompany = store.currentCompany ?? store.companySettings ?? {};

  const [quotations, setQuotations] = useState<Quotation[]>(() => loadQuotations());
  const [view, setView] = useState<"list" | "form" | "view">("list");
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<Quotation>(() => newQuotation());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const parties = useMemo(
    () =>
      accounts.filter((a: any) => {
        const group = String(a.group ?? a.groupName ?? "").toLowerCase();
        return group.includes("debtor") || group.includes("customer");
      }),
    [accounts],
  );

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase();
    return quotations.filter((x) => {
      const matchSearch =
        !q || x.quotationNo.toLowerCase().includes(q) || x.partyName.toLowerCase().includes(q);
      const matchStatus = filterStatus === "ALL" || x.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [quotations, searchText, filterStatus]);

  const refresh = () => setQuotations(loadQuotations());

  const startNew = () => {
    const q = newQuotation();
    setEditingQuotation(null);
    setFormData(q);
    setFormErrors({});
    setView("form");
  };

  const startEdit = (q: Quotation) => {
    setEditingQuotation(q);
    setFormData(q);
    setFormErrors({});
    setView("form");
  };

  const updateLine = (id: string, field: keyof QuotationLine, value: any) => {
    const lines = formData.lines.map((line) =>
      line.id === id ? calculateLine({ ...line, [field]: value }) : line,
    );
    setFormData({ ...formData, ...calculateTotals(lines), lines });
  };

  const addLine = () => {
    const lines = [...formData.lines, createBlankLine()];
    setFormData({ ...formData, ...calculateTotals(lines), lines });
  };

  const removeLine = (id: string) => {
    if (formData.lines.length <= 1) return;
    const lines = formData.lines.filter((l) => l.id !== id);
    setFormData({ ...formData, ...calculateTotals(lines), lines });
  };

  const saveForm = (status: Quotation["status"] = formData.status) => {
    const errors: Record<string, string> = {};
    if (!formData.partyName.trim()) errors.partyName = "Party name is required";
    if (!formData.lines.some((l) => l.itemName.trim() && l.qty > 0 && l.rate > 0)) {
      errors.lines = "At least one valid line is required";
    }
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    const lines = formData.lines.map(calculateLine);
    const totals = calculateTotals(lines);
    const q: Quotation = {
      ...formData,
      ...totals,
      lines,
      status,
      id: formData.id || crypto.randomUUID(),
      quotationNo: formData.quotationNo || generateQuotationNo(),
      createdAt: formData.createdAt || new Date().toISOString(),
    };

    saveQuotation(q);
    refresh();
    setEditingQuotation(null);
    setView("list");
  };

  const deleteRow = (id: string) => {
    deleteQuotation(id);
    setShowDeleteConfirm(null);
    refresh();
  };

  const setStatus = (q: Quotation, status: Quotation["status"]) => {
    const next = { ...q, status };
    saveQuotation(next);
    setSelectedQuotation(next);
    refresh();
  };

  const convertToInvoice = (q: Quotation) => {
    if (!window.confirm("This will be converted to Sales Invoice. Proceed?")) return;
    const next = { ...q, status: "converted" as const };
    saveQuotation(next);
    setSelectedQuotation(next);
    refresh();
    alert("Converted! Please create sales invoice manually with reference: " + q.quotationNo);
  };

  if (view === "form") {
    return (
      <div className="p-6 bg-[#f5f6fa] min-h-screen">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">
              {editingQuotation ? `Edit Quotation #${formData.quotationNo}` : "New Quotation"}
            </h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Prepare quotation / pro-forma invoice</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveForm("draft")} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save as Draft
            </button>
            <button onClick={() => setView("list")} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-3">Quotation Info</h2>
          <div className="grid grid-cols-3 gap-4">
            <input readOnly value={formData.quotationNo} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-gray-50 text-gray-700" />
            <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            <input type="date" value={formData.validUpto} onChange={(e) => setFormData({ ...formData, validUpto: e.target.value })} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />

            <select
              value={formData.partyId}
              onChange={(e) => {
                const p = parties.find((x: any) => x.id === e.target.value);
                setFormData({
                  ...formData,
                  partyId: e.target.value,
                  partyName: p?.name ?? formData.partyName,
                  partyAddress: p?.address ?? formData.partyAddress,
                  partyContact: p?.phone ?? p?.mobile ?? formData.partyContact,
                });
              }}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="">Select Party</option>
              {parties.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input placeholder="Party Name" value={formData.partyName} onChange={(e) => setFormData({ ...formData, partyName: e.target.value })} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            <input placeholder="Subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            <input placeholder="Party Address" value={formData.partyAddress} onChange={(e) => setFormData({ ...formData, partyAddress: e.target.value })} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] col-span-2" />
            <input placeholder="Party Contact" value={formData.partyContact} onChange={(e) => setFormData({ ...formData, partyContact: e.target.value })} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
          </div>
          {formErrors.partyName && <p className="text-[11px] text-red-600 mt-2">{formErrors.partyName}</p>}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 overflow-x-auto">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-3">Line Items</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                {["#", "Item Name", "Description", "Qty", "Unit", "Rate", "Disc%", "Amount", "VAT%", "VAT Amt", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formData.lines.map((l, i) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{i + 1}</td>
                  <td className="px-3 py-2.5"><input list="quotation-items" value={l.itemName} onChange={(e) => updateLine(l.id, "itemName", e.target.value)} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-40" /></td>
                  <td className="px-3 py-2.5"><input value={l.description} onChange={(e) => updateLine(l.id, "description", e.target.value)} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-48" /></td>
                  <td className="px-3 py-2.5"><input type="number" value={l.qty} onChange={(e) => updateLine(l.id, "qty", Number(e.target.value))} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-20 text-right" /></td>
                  <td className="px-3 py-2.5"><input value={l.unit} onChange={(e) => updateLine(l.id, "unit", e.target.value)} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-20" /></td>
                  <td className="px-3 py-2.5"><input type="number" value={l.rate} onChange={(e) => updateLine(l.id, "rate", Number(e.target.value))} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-24 text-right" /></td>
                  <td className="px-3 py-2.5"><input type="number" value={l.discount} onChange={(e) => updateLine(l.id, "discount", Number(e.target.value))} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-20 text-right" /></td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{money(l.amount)}</td>
                  <td className="px-3 py-2.5">
                    <select value={l.vatPct} onChange={(e) => updateLine(l.id, "vatPct", Number(e.target.value))} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white">
                      <option value={0}>0</option>
                      <option value={13}>13</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{money(l.vatAmount)}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => removeLine(l.id)} className="h-7 w-7 border border-red-200 text-red-600 rounded hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 mx-auto" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="quotation-items">
            {items.map((it: any) => <option key={it.id} value={it.name} />)}
          </datalist>
          {formErrors.lines && <p className="text-[11px] text-red-600 mt-2">{formErrors.lines}</p>}
          <button onClick={addLine} className="mt-3 h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Line
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-800 mb-3">Terms & Notes</h2>
            <textarea value={formData.terms} onChange={(e) => setFormData({ ...formData, terms: e.target.value })} rows={3} className="w-full px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white mb-3" />
            <textarea value={formData.narration} onChange={(e) => setFormData({ ...formData, narration: e.target.value })} rows={2} placeholder="Narration" className="w-full px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white" />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            {[
              ["Sub Total:", formData.subTotal],
              ["Discount:", formData.discountAmount],
              ["Taxable Amount:", formData.taxableAmount],
              ["VAT (13%):", formData.vatAmount],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between py-1 text-[12px] text-gray-700">
                <span>{label}</span><span className="font-mono">{money(Number(value))}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 mt-2 border-t border-gray-200 text-[15px] font-semibold text-gray-800">
              <span>TOTAL AMOUNT:</span><span className="font-mono">{money(formData.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "view" && selectedQuotation) {
    const q = selectedQuotation;
    return (
      <div className="p-6 bg-[#f5f6fa] min-h-screen">
        <div className="no-print flex justify-between mb-4">
          <button onClick={() => setView("list")} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Back</button>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Print</button>
            <button onClick={() => setStatus(q, "sent")} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md">Mark as Sent</button>
            <button onClick={() => setStatus(q, "accepted")} className="h-8 px-3 bg-green-600 text-white text-[12px] font-medium rounded-md">Mark as Accepted</button>
            <button onClick={() => setStatus(q, "rejected")} className="h-8 px-3 bg-red-600 text-white text-[12px] font-medium rounded-md">Mark as Rejected</button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-4xl mx-auto text-gray-800">
          <div className="flex justify-between border-b pb-4 mb-4">
            <div>
              <h1 className="text-[18px] font-semibold">{currentCompany?.name || currentCompany?.companyNameEn || "Sutra ERP"}</h1>
              <p className="text-[12px] text-gray-600">{currentCompany?.address || ""}</p>
            </div>
            <div className="text-right">
              <h2 className="text-[18px] font-semibold">QUOTATION</h2>
              <p className="text-[12px] text-gray-600">PRO-FORMA INVOICE</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-[12px] mb-5">
            <div>
              <p className="font-semibold">To:</p>
              <p>{q.partyName}</p>
              <p>{q.partyAddress}</p>
              <p>{q.partyContact}</p>
            </div>
            <div className="text-right">
              <p>Quotation No: <b>{q.quotationNo}</b></p>
              <p>Date: {q.dateNepali || q.date}</p>
              <p>Valid Upto: {q.validUpto}</p>
              <p>Status: {q.status}</p>
            </div>
          </div>

          <p className="text-[13px] font-semibold mb-3">{q.subject}</p>

          <table className="w-full border-collapse mb-4">
            <thead>
              <tr className="bg-[#f5f6fa]">
                {["#", "Item", "Description", "Qty", "Rate", "Amount", "VAT", "Total"].map((h) => (
                  <th key={h} className="border px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.lines.map((l, i) => (
                <tr key={l.id}>
                  <td className="border px-2 py-2 text-[12px]">{i + 1}</td>
                  <td className="border px-2 py-2 text-[12px]">{l.itemName}</td>
                  <td className="border px-2 py-2 text-[12px]">{l.description}</td>
                  <td className="border px-2 py-2 text-[12px] text-right">{l.qty} {l.unit}</td>
                  <td className="border px-2 py-2 text-[12px] text-right">{money(l.rate)}</td>
                  <td className="border px-2 py-2 text-[12px] text-right">{money(l.amount)}</td>
                  <td className="border px-2 py-2 text-[12px] text-right">{money(l.vatAmount)}</td>
                  <td className="border px-2 py-2 text-[12px] text-right">{money(l.amount + l.vatAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto w-72 text-[12px]">
            <div className="flex justify-between py-1"><span>Sub Total</span><span>{money(q.subTotal)}</span></div>
            <div className="flex justify-between py-1"><span>Discount</span><span>{money(q.discountAmount)}</span></div>
            <div className="flex justify-between py-1"><span>VAT</span><span>{money(q.vatAmount)}</span></div>
            <div className="flex justify-between py-2 border-t font-semibold"><span>Total</span><span>{money(q.totalAmount)}</span></div>
          </div>

          <div className="mt-6 text-[12px]">
            <p className="font-semibold">Terms:</p>
            <p>{q.terms}</p>
          </div>

          <div className="mt-16 flex justify-end">
            <div className="border-t border-gray-400 pt-2 text-[12px] w-48 text-center">Authorized Signature</div>
          </div>
        </div>
      </div>
    );
  }

  const pending = quotations.filter((q) => q.status === "draft" || q.status === "sent").length;
  const converted = quotations.filter((q) => q.status === "converted").length;

  return (
    <div className="p-6 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Quotations / Pro-forma Invoices</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage sales quotations and convert to orders/invoices</p>
        </div>
        <button onClick={startNew} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Quotation
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3 flex gap-3">
        <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search party / quotation no" className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-64" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white">
          {["ALL", "draft", "sent", "accepted", "rejected", "converted", "expired"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <p className="text-[11px] text-gray-500 mb-3">{quotations.length} quotations | {pending} pending | {converted} converted</p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-gray-400">No quotations found</div>
        ) : (
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#f5f6fa] border-b border-gray-200">
              {["Quotation No", "Date (BS)", "Valid Upto", "Party", "Subject", "Amount", "Status", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono">{q.quotationNo}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{q.dateNepali || q.date}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{q.validUpto}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{q.partyName}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{q.subject}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{money(q.totalAmount)}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${statusClass(q.status)}`}>{q.status}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedQuotation(q); setView("view"); }} className="h-7 w-7 border rounded"><Eye className="h-3.5 w-3.5 mx-auto" /></button>
                      {(q.status === "draft" || q.status === "sent") && <button onClick={() => startEdit(q)} className="h-7 w-7 border rounded text-[#1557b0]"><Edit2 className="h-3.5 w-3.5 mx-auto" /></button>}
                      {q.status === "draft" && <button onClick={() => setShowDeleteConfirm(q.id)} className="h-7 w-7 border rounded text-red-600"><Trash2 className="h-3.5 w-3.5 mx-auto" /></button>}
                      {q.status === "accepted" && <button onClick={() => convertToInvoice(q)} className="h-7 px-2 border rounded text-[11px] text-[#1557b0] flex items-center gap-1"><ArrowRight className="h-3.5 w-3.5" /> Convert</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg border p-4 w-full max-w-sm">
            <h2 className="text-[14px] font-semibold text-gray-800 mb-2">Delete quotation?</h2>
            <p className="text-[12px] text-gray-600 mb-4">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md">Cancel</button>
              <button onClick={() => deleteRow(showDeleteConfirm)} className="h-8 px-3 bg-red-600 text-white text-[12px] rounded-md">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
