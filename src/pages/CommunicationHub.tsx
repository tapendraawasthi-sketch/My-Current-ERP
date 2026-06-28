// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  Mail,
  MessageSquare,
  Copy,
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  FileText,
  Save,
  Link as LinkIcon,
  Bell,
  RefreshCw,
  Building,
  FileSpreadsheet
} from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const cardClass = "bg-white border border-gray-200 rounded-md shadow-sm p-4";
const tableHeadClass = "bg-[#f5f6fa] border-b border-gray-200 px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const tableCellClass = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";

const primaryBtn = "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm";
const outlineBtn = "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm";
const inputClass = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-shadow";

const BANK_FORMATS: Record<
  string,
  { dateCol: string; narrationCol: string; debitCol: string; creditCol: string; balanceCol: string; dateFormat: string }
> = {
  NMB: { dateCol: "Date", narrationCol: "Particular", debitCol: "Dr", creditCol: "Cr", balanceCol: "Balance", dateFormat: "DD/MM/YYYY" },
  Nabil: { dateCol: "Transaction Date", narrationCol: "Description", debitCol: "Debit", creditCol: "Credit", balanceCol: "Balance", dateFormat: "YYYY-MM-DD" },
  Everest: { dateCol: "Value Date", narrationCol: "Narration", debitCol: "Withdrawal", creditCol: "Deposit", balanceCol: "Balance", dateFormat: "DD-MM-YYYY" },
  "Global IME": { dateCol: "Date", narrationCol: "Particular", debitCol: "Withdrawal Amount", creditCol: "Deposit Amount", balanceCol: "Balance Amount", dateFormat: "DD/MM/YYYY" },
  Siddhartha: { dateCol: "Trans Date", narrationCol: "Description", debitCol: "Dr Amount", creditCol: "Cr Amount", balanceCol: "Closing Balance", dateFormat: "MM/DD/YYYY" },
  "Standard Chartered": { dateCol: "Date", narrationCol: "Description", debitCol: "Debit", creditCol: "Credit", balanceCol: "Balance", dateFormat: "DD/MM/YYYY" },
  Himalayan: { dateCol: "Date", narrationCol: "Narration", debitCol: "Debit", creditCol: "Credit", balanceCol: "Balance", dateFormat: "DD/MM/YYYY" },
  Other: { dateCol: "Date", narrationCol: "Description", debitCol: "Debit", creditCol: "Credit", balanceCol: "Balance", dateFormat: "DD/MM/YYYY" },
};

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function parseAmount(v: any) {
  if (typeof v === "number") return v;
  return Number(String(v || "").replace(/,/g, "").trim()) || 0;
}

function normalizePhone(v: string) {
  let p = String(v || "").replace(/\D/g, "");
  if (p.length === 10 && p.startsWith("9")) p = "977" + p;
  return p;
}

function daysBetween(a: string, b: string) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function parseExcelFile(file: File, callback: (rows: any[]) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target?.result;
    const wb = XLSX.read(data, { type: "binary" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    callback(rows);
  };
  reader.readAsBinaryString(file);
}

function downloadTemplate(name: string, rows: any[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Template");
  XLSX.writeFile(wb, name);
}

export default function CommunicationHub() {
  const {
    invoices = [],
    parties = [],
    companySettings = {},
    accounts = [],
    vouchers = [],
    addVoucher,
  } = useStore();

  const [activeTab, setActiveTab] = useState("Invoice Delivery");

  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("");

  const [reminderDays, setReminderDays] = useState("30");
  const [reminderGroup, setReminderGroup] = useState("All");
  const [reminderMin, setReminderMin] = useState("");
  const [selectedReminderParties, setSelectedReminderParties] = useState([]);
  const [templateType, setTemplateType] = useState("Polite");
  const [templateText, setTemplateText] = useState("");

  const [tallyPreview, setTallyPreview] = useState({ ledgers: [], vouchers: [] });
  const [tallyIssues, setTallyIssues] = useState([]);

  const [voucherImportRows, setVoucherImportRows] = useState([]);
  const [voucherImportErrors, setVoucherImportErrors] = useState([]);
  const [validVoucherRows, setValidVoucherRows] = useState([]);

  const [selectedBank, setSelectedBank] = useState("NMB");
  const [bankRows, setBankRows] = useState([]);
  const [bankMatches, setBankMatches] = useState([]);

  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === selectedInvoiceId),
    [invoices, selectedInvoiceId],
  );

  const selectedParty = useMemo(
    () => parties.find((p) => p.id === selectedInvoice?.partyId),
    [parties, selectedInvoice],
  );

  const recentSalesInvoices = useMemo(() => {
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    return invoices.filter(
      (i) =>
        (i.type === "sales-invoice" || i.type === "sales") &&
        i.status === "posted" &&
        i.date >= cutoff,
    );
  }, [invoices]);

  useEffect(() => {
    if (!selectedInvoice) return;

    const party = selectedParty || {};
    const invNo = selectedInvoice.invoiceNo || selectedInvoice.voucherNo || selectedInvoice.id;
    const amount = money(selectedInvoice.grandTotal || 0);
    const dueDate = selectedInvoice.dueDate || "";

    setEmailTo(party.email || "");
    setEmailSubject(`Invoice ${invNo} from ${companySettings?.name || "Company"} — NPR ${amount}`);
    setEmailBody(
      `Dear ${party.name || "Customer"},\n\nPlease find herewith Invoice No. ${invNo} dated ${selectedInvoice.date} for NPR ${amount}.\n\nPayment is due by ${dueDate}. For any queries, contact us at ${companySettings?.phone || ""}.\n\nThank you for your business.\n\nBest regards,\n${companySettings?.name || ""}\nPAN: ${companySettings?.panNumber || ""}`,
    );

    setWaPhone(party.phone || "");
    setWaMessage(
      `Dear ${party.name || "Customer"}, Invoice ${invNo} dated ${selectedInvoice.date} for NPR ${amount} is due on ${dueDate}. Please arrange payment. - ${companySettings?.name || ""}`,
    );
  }, [selectedInvoice, selectedParty, companySettings]);

  useEffect(() => {
    const templates = {
      Polite:
        "Dear {partyName}, this is a gentle reminder that invoices totaling NPR {amount} are overdue. Kindly arrange payment at your convenience.",
      Firm:
        "Dear {partyName}, invoices totaling NPR {amount} are overdue by {days} days. Please arrange payment immediately.",
      "Final Notice":
        "Dear {partyName}, despite previous reminders, invoices totaling NPR {amount} remain overdue. Please clear payment immediately to avoid further action.",
    };
    setTemplateText(templates[templateType]);
  }, [templateType]);

  const overdueReminderRows = useMemo(() => {
    const threshold = Number(reminderDays || 30);
    const min = Number(reminderMin || 0);
    const today = todayISO();

    const partyMap = {};

    invoices
      .filter(
        (i) =>
          (i.type === "sales-invoice" || i.type === "sales") &&
          i.status === "posted" &&
          (i.paymentStatus === "unpaid" || i.paymentStatus === "partial") &&
          i.dueDate &&
          daysBetween(i.dueDate, today) >= threshold,
      )
      .forEach((i) => {
        const p = parties.find((x) => x.id === i.partyId) || {};
        if (reminderGroup !== "All" && String(p.type || "") !== reminderGroup) return;

        const amount = Number(i.grandTotal || 0);
        if (!partyMap[i.partyId]) {
          partyMap[i.partyId] = {
            party: p,
            total: 0,
            oldestDays: 0,
            invoices: [],
          };
        }

        const days = daysBetween(i.dueDate, today);
        partyMap[i.partyId].total += amount;
        partyMap[i.partyId].oldestDays = Math.max(partyMap[i.partyId].oldestDays, days);
        partyMap[i.partyId].invoices.push(i);
      });

    return Object.values(partyMap).filter((r: any) => r.total >= min);
  }, [invoices, parties, reminderDays, reminderGroup, reminderMin]);

  function sendEmail() {
    if (!emailTo) return toast.error("Email address required");
    const url =
      `mailto:${emailTo}` +
      `?cc=${encodeURIComponent(emailCc)}` +
      `&bcc=${encodeURIComponent(emailBcc)}` +
      `&subject=${encodeURIComponent(emailSubject)}` +
      `&body=${encodeURIComponent(emailBody)}`;
    window.open(url, "_blank");
  }

  function sendWhatsApp() {
    const phone = normalizePhone(waPhone);
    if (!phone) return toast.error("Phone number required");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`, "_blank");
  }

  const paymentLink = useMemo(() => {
    if (!selectedInvoice) return "";
    const invNo = selectedInvoice.invoiceNo || selectedInvoice.voucherNo || selectedInvoice.id;
    const amount = Number(selectedInvoice.grandTotal || 0).toFixed(2);
    const merchantCode = companySettings?.vatNumber || companySettings?.panNumber || "MERCHANT";
    const successUrl = encodeURIComponent(window.location.origin + "/payment-success");
    const failureUrl = encodeURIComponent(window.location.origin + "/payment-failed");
    return `https://esewa.com.np/epay/main?amt=${amount}&scd=${merchantCode}&pid=${invNo}&su=${successUrl}&fu=${failureUrl}`;
  }, [selectedInvoice, companySettings]);

  async function copyPaymentLink() {
    if (!paymentLink) return;
    await navigator.clipboard.writeText(paymentLink);
    toast.success("Payment link copied");
  }

  function toggleReminderParty(partyId: string) {
    setSelectedReminderParties((rows) =>
      rows.includes(partyId) ? rows.filter((x) => x !== partyId) : [...rows, partyId],
    );
  }

  function buildReminderMessage(row: any) {
    return templateText
      .split("{partyName}").join(row.party.name || "")
      .split("{amount}").join(money(row.total))
      .split("{days}").join(String(row.oldestDays));
  }

  function sendBulkWhatsApp() {
    const selected = overdueReminderRows.filter((r: any) => selectedReminderParties.includes(r.party.id));
    if (!selected.length) return toast.error("Select at least one party");

    selected.forEach((row: any, i) => {
      setTimeout(() => {
        toast(`Opening WhatsApp for ${row.party.name} ${i + 1}/${selected.length}`);
        const phone = normalizePhone(row.party.phone || "");
        if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildReminderMessage(row))}`, "_blank");
      }, i * 1500);
    });
  }

  function printReminderLetters() {
    const selected = overdueReminderRows.filter((r: any) => selectedReminderParties.includes(r.party.id));
    if (!selected.length) return toast.error("Select at least one party");

    const html = selected
      .map((row: any) => {
        return `
          <div style="page-break-after:always;font-family:Arial;padding:30px;color:#000">
            <h2>${companySettings?.name || ""}</h2>
            <p>${companySettings?.address || ""}</p>
            <hr/>
            <p>Date: ${todayISO()}</p>
            <p>To,<br/><b>${row.party.name || ""}</b><br/>${row.party.address || ""}</p>
            <h3>Payment Reminder</h3>
            <p>${buildReminderMessage(row)}</p>
            <p>Total Overdue: NPR ${money(row.total)}</p>
            <p>Oldest Invoice Days: ${row.oldestDays}</p>
            <p>Regards,<br/>${companySettings?.name || ""}</p>
          </div>
        `;
      })
      .join("");

    const w = window.open("", "_blank");
    w.document.write(`<html><body>${html}</body></html>`);
    w.document.close();
    w.print();
  }

  function handleTallyXML(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const xmlText = String(e.target?.result || "");
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      const ledgers = Array.from(xmlDoc.querySelectorAll("LEDGER")).map((l: any) => ({
        name: l.getAttribute("NAME") || l.querySelector("NAME")?.textContent || "",
        parent: l.querySelector("PARENT")?.textContent || "",
        openingBalance: parseFloat(l.querySelector("OPENINGBALANCE")?.textContent || "0"),
      }));

      const vouchersParsed = Array.from(xmlDoc.querySelectorAll("VOUCHER")).map((v: any) => ({
        voucherNo: v.querySelector("VOUCHERNUMBER")?.textContent || v.getAttribute("VCHKEY") || generateId(),
        date: v.querySelector("DATE")?.textContent || "",
        type: v.querySelector("VOUCHERTYPENAME")?.textContent || "journal",
        narration: v.querySelector("NARRATION")?.textContent || "",
        amount: parseAmount(v.querySelector("AMOUNT")?.textContent || 0),
      }));

      setTallyPreview({ ledgers, vouchers: vouchersParsed });
      setTallyIssues([]);
      toast.success("Tally XML parsed");
    };
    reader.readAsText(file);
  }

  function validateTallyData() {
    const issues = [];
    const existingAccountNames = new Set(accounts.map((a) => String(a.name || "").toLowerCase()));

    tallyPreview.ledgers.forEach((l) => {
      if (!l.name) issues.push(`Ledger missing name`);
      if (existingAccountNames.has(String(l.name).toLowerCase())) {
        issues.push(`Ledger already exists: ${l.name}`);
      }
    });

    tallyPreview.vouchers.forEach((v) => {
      if (!v.date) issues.push(`Voucher ${v.voucherNo} missing date`);
      if (!v.type) issues.push(`Voucher ${v.voucherNo} missing type`);
    });

    setTallyIssues(issues);
    if (issues.length) toast.error(`${issues.length} issues found`);
    else toast.success("Tally data validation passed");
  }

  async function importTallyAccounts() {
    const db = getDB();
    const mapped = tallyPreview.ledgers.map((l) => ({
      id: generateId(),
      name: l.name,
      group: l.parent,
      type: inferAccountType(l.parent),
      openingBalanceDr: l.openingBalance > 0 ? l.openingBalance : 0,
      openingBalanceCr: l.openingBalance < 0 ? Math.abs(l.openingBalance) : 0,
      createdAt: new Date().toISOString(),
    }));

    if (db.accounts?.bulkAdd) await db.accounts.bulkAdd(mapped).catch((e) => console.error(e));
    else for (const row of mapped) await db.table("accounts").put(row).catch(() => {});
    toast.success(`${mapped.length} accounts imported`);
  }

  async function importTallyVouchers() {
    const db = getDB();
    const mapped = tallyPreview.vouchers.map((v) => ({
      id: generateId(),
      type: String(v.type || "journal").toLowerCase(),
      voucherNo: v.voucherNo,
      date: normalizeTallyDate(v.date),
      status: "posted",
      narration: v.narration,
      amount: v.amount,
      lines: [],
      createdAt: new Date().toISOString(),
    }));

    for (const row of mapped) await db.table("vouchers").put(row).catch(() => {});
    toast.success(`${mapped.length} vouchers imported`);
  }

  async function importTallyAll() {
    await importTallyAccounts();
    await importTallyVouchers();
  }

  function inferAccountType(parent: string) {
    const p = String(parent || "").toLowerCase();
    if (p.includes("sales") || p.includes("income")) return "income";
    if (p.includes("purchase") || p.includes("expense")) return "expense";
    if (p.includes("liabil") || p.includes("creditor") || p.includes("capital")) return "liability";
    return "asset";
  }

  function normalizeTallyDate(v: string) {
    const s = String(v || "");
    if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return s;
  }

  function downloadJournalTemplate() {
    downloadTemplate("Journal_Entry_Template.xlsx", [
      { Date: "2025-01-01", "Dr Account Name": "Cash", "Cr Account Name": "Sales", "Amount NPR": 1000, Narration: "Sample" },
    ]);
  }

  function downloadSalesInvoiceTemplate() {
    downloadTemplate("Sales_Invoice_Template.xlsx", [
      { Date: "2025-01-01", "Party Name": "Customer A", "Item Name": "Item A", Qty: 1, Rate: 1000, "VAT%": 13, Narration: "Sample" },
    ]);
  }

  function downloadOpeningTemplate() {
    downloadTemplate("Opening_Balance_Template.xlsx", [
      { "Account Code": "1001", "Account Name": "Cash", "Dr Balance": 1000, "Cr Balance": 0 },
    ]);
  }

  function validateVoucherImport() {
    const errors = [];
    const valid = [];
    const accountNames = new Set(accounts.map((a) => String(a.name || "").toLowerCase()));

    voucherImportRows.forEach((row, idx) => {
      const rowNo = idx + 2;
      const date = row.Date || row.date;
      const amount = parseAmount(row["Amount NPR"] || row.Amount || row.amount || 0);
      const dr = row["Dr Account Name"] || row["Account Name"] || "";
      const cr = row["Cr Account Name"] || "";

      if (!date) errors.push(`Row ${rowNo}: Date is required`);
      if (!amount) errors.push(`Row ${rowNo}: Amount must be numeric`);
      if (dr && !accountNames.has(String(dr).toLowerCase())) errors.push(`Row ${rowNo}: Account '${dr}' not found`);
      if (cr && !accountNames.has(String(cr).toLowerCase())) errors.push(`Row ${rowNo}: Account '${cr}' not found`);

      if (date && amount && (!dr || accountNames.has(String(dr).toLowerCase())) && (!cr || accountNames.has(String(cr).toLowerCase()))) {
        valid.push(row);
      }
    });

    setVoucherImportErrors(errors);
    setValidVoucherRows(valid);

    if (errors.length) toast.error(`${errors.length} rows with errors`);
    else toast.success(`${valid.length} valid rows ready`);
  }

  async function importValidRows() {
    if (!validVoucherRows.length) return toast.error("No valid rows ready");

    const db = getDB();

    for (const row of validVoucherRows) {
      const amount = parseAmount(row["Amount NPR"] || row.Amount || row.amount || 0);
      const voucher = {
        id: generateId(),
        type: "journal",
        status: "posted",
        date: row.Date || row.date,
        narration: row.Narration || "",
        amount,
        lines: [
          { id: generateId(), accountName: row["Dr Account Name"] || row["Account Name"], debit: amount, credit: 0 },
          { id: generateId(), accountName: row["Cr Account Name"] || "Suspense", debit: 0, credit: amount },
        ],
      };

      if (addVoucher) await addVoucher(voucher);
      else await db.table("vouchers").put(voucher).catch(() => {});
    }

    toast.success(`${validVoucherRows.length} voucher rows imported`);
  }

  function parseBankFile(file: File) {
    parseExcelFile(file, (rows) => {
      const fmt = BANK_FORMATS[selectedBank];
      const parsed = rows.map((r, idx) => ({
        id: generateId(),
        date: r[fmt.dateCol],
        description: r[fmt.narrationCol],
        debit: parseAmount(r[fmt.debitCol]),
        credit: parseAmount(r[fmt.creditCol]),
        balance: parseAmount(r[fmt.balanceCol]),
        raw: r,
      }));
      setBankRows(parsed);
      setBankMatches(autoMatchBank(parsed));
      toast.success(`${parsed.length} bank transactions parsed`);
    });
  }

  function autoMatchBank(rows: any[]) {
    return rows.map((row) => {
      const amount = Number(row.debit || row.credit || 0);
      const date = new Date(row.date);
      const candidates = vouchers.filter((v) => {
        const vAmount = Number(v.amount || v.grandTotal || 0);
        const diff = Math.abs(vAmount - amount);
        const dayDiff = Math.abs((new Date(v.date).getTime() - date.getTime()) / 86400000);
        return diff <= 1 && dayDiff <= 3;
      });

      if (candidates.length === 1) return { rowId: row.id, status: "Matched", voucher: candidates[0] };
      if (candidates.length > 1) return { rowId: row.id, status: "Possible Match", voucher: candidates[0] };
      return { rowId: row.id, status: "Unmatched", voucher: null };
    });
  }

  async function createBankEntry(row: any) {
    const amount = Number(row.debit || row.credit || 0);
    if (!amount) return toast.error("Invalid amount");

    const voucher = {
      id: generateId(),
      type: "journal",
      status: "posted",
      date: row.date || todayISO(),
      narration: row.description,
      amount,
      lines:
        row.credit > 0
          ? [
              { id: generateId(), accountName: "Bank Account", debit: amount, credit: 0 },
              { id: generateId(), accountName: "Unclassified", debit: 0, credit: amount },
            ]
          : [
              { id: generateId(), accountName: "Unclassified", debit: amount, credit: 0 },
              { id: generateId(), accountName: "Bank Account", debit: 0, credit: amount },
            ],
    };

    if (addVoucher) await addVoucher(voucher);
    else await getDB().table("vouchers").put(voucher).catch(() => {});
    toast.success("Bank entry created");
  }

  const tabs = [
    { id: "Invoice Delivery", label: "Invoice Delivery", icon: <Mail size={14}/> },
    { id: "Bulk Reminders", label: "Bulk Reminders", icon: <Bell size={14}/> },
    { id: "Tally Data Import", label: "Tally Import", icon: <Upload size={14}/> },
    { id: "Excel Voucher Import", label: "Excel Import", icon: <FileSpreadsheet size={14}/> },
    { id: "Bank Statement Import", label: "Bank Import", icon: <Building size={14}/> },
  ];

  const tallyConflictCounts = useMemo(() => {
    const names = new Set(accounts.map((a) => String(a.name || "").toLowerCase()));
    const ledgerConflicts = tallyPreview.ledgers.filter((l) => names.has(String(l.name).toLowerCase())).length;
    return { ledgerConflicts };
  }, [tallyPreview, accounts]);

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <MessageSquare size={18} className="text-[#1557b0]" /> Communication Hub
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Invoice delivery, payment reminders and external data import utilities.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? "border-[#1557b0] text-[#1557b0]"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "Invoice Delivery" && (
        <div className="space-y-4">
          <div className={cardClass}>
            <label className="block text-[11px] font-medium text-gray-600 mb-2 uppercase tracking-wide">Select Invoice to Share</label>
            <select className={`${inputClass} w-full md:w-1/2`} value={selectedInvoiceId} onChange={(e) => setSelectedInvoiceId(e.target.value)}>
              <option value="">-- Choose an invoice --</option>
              {recentSalesInvoices.map((inv) => {
                const p = parties.find((x) => x.id === inv.partyId);
                return (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNo || inv.voucherNo || inv.id} | {inv.date} | {p?.name || "Party"} | NPR {money(inv.grandTotal || 0)} | {String(inv.paymentStatus || "").toUpperCase()}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedInvoice && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={`${cardClass} border-t-4 border-t-blue-500`}>
                <h2 className="text-[14px] font-semibold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Mail size={16} className="text-blue-500" /> Send via Email
                </h2>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">To</label>
                    <input className={inputClass} value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="customer@example.com" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">CC</label>
                      <input className={inputClass} value={emailCc} onChange={(e) => setEmailCc(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">BCC</label>
                      <input className={inputClass} value={emailBcc} onChange={(e) => setEmailBcc(e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Subject</label>
                    <input className={inputClass} value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Message Body</label>
                    <textarea className={`${inputClass} min-h-[160px] py-2`} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
                  </div>

                  <div className="pt-2">
                    <button className={`${primaryBtn} w-full`} onClick={sendEmail}><Mail size={14}/> Open in Default Mail Client</button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className={`${cardClass} border-t-4 border-t-green-500`}>
                  <h2 className="text-[14px] font-semibold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                    <MessageSquare size={16} className="text-green-500" /> Send via WhatsApp
                  </h2>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">WhatsApp Number</label>
                      <input className={inputClass} value={waPhone} onChange={(e) => setWaPhone(e.target.value)} placeholder="e.g. 9779812345678" />
                      <p className="text-[10px] text-gray-400 mt-1">Include country code without '+'. Assumes 977 if 10 digits starting with 9.</p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">Message</label>
                      <textarea className={`${inputClass} min-h-[120px] py-2`} value={waMessage} onChange={(e) => setWaMessage(e.target.value)} />
                    </div>

                    <div className="pt-2">
                      <button className="w-full h-8 px-3 bg-green-600 hover:bg-green-700 text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm" onClick={sendWhatsApp}>
                        <MessageSquare size={14}/> Open in WhatsApp Web
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`${cardClass} border-t-4 border-t-indigo-500 bg-indigo-50/10`}>
                  <h2 className="text-[14px] font-semibold text-indigo-900 mb-3 flex items-center gap-2 border-b border-indigo-100 pb-2">
                    <LinkIcon size={16} className="text-indigo-500" /> eSewa Payment Link (Template)
                  </h2>
                  <div className="bg-white border border-gray-200 rounded p-3 mb-3 text-[11px] text-gray-600 break-all font-mono leading-relaxed">
                    {paymentLink}
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] text-gray-500 italic max-w-[60%]">Configure your merchant ID in settings to activate real payments.</p>
                    <button className={outlineBtn} onClick={copyPaymentLink}>
                      <Copy size={13} /> Copy Link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "Bulk Reminders" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className={`${cardClass} lg:col-span-1 space-y-4`}>
            <h2 className="text-[13px] font-semibold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-2">Reminder Settings</h2>
            
            <div>
               <label className="block text-[11px] font-medium text-gray-600 mb-1">Aging Threshold</label>
               <select className={inputClass} value={reminderDays} onChange={(e) => setReminderDays(e.target.value)}>
                 <option value="15">15+ Days Overdue</option>
                 <option value="30">30+ Days Overdue</option>
                 <option value="60">60+ Days Overdue</option>
                 <option value="90">90+ Days Overdue</option>
               </select>
            </div>

            <div>
               <label className="block text-[11px] font-medium text-gray-600 mb-1">Customer Group</label>
               <select className={inputClass} value={reminderGroup} onChange={(e) => setReminderGroup(e.target.value)}>
                 <option>All</option>
                 {Array.from(new Set(parties.map((p) => p.type).filter(Boolean))).map((t) => (
                   <option key={t}>{t}</option>
                 ))}
               </select>
            </div>

            <div>
               <label className="block text-[11px] font-medium text-gray-600 mb-1">Min. Amount Overdue</label>
               <input className={inputClass} type="number" placeholder="0.00" value={reminderMin} onChange={(e) => setReminderMin(e.target.value)} />
            </div>

            <div className="pt-4 border-t border-gray-100">
               <label className="block text-[11px] font-medium text-gray-600 mb-1">Message Tone</label>
               <select className={inputClass} value={templateType} onChange={(e) => setTemplateType(e.target.value)}>
                 <option>Polite</option>
                 <option>Firm</option>
                 <option>Final Notice</option>
               </select>
            </div>
            
            <div>
               <label className="block text-[11px] font-medium text-gray-600 mb-1">Message Template</label>
               <textarea className={`${inputClass} min-h-[140px] py-2 leading-relaxed text-[11px] text-gray-600`} value={templateText} onChange={(e) => setTemplateText(e.target.value)} />
            </div>
          </div>

          <div className={`${cardClass} lg:col-span-3`}>
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <h2 className="text-[14px] font-semibold text-gray-800">
                 Overdue Parties <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[11px] ml-2">{overdueReminderRows.length} Found</span>
              </h2>
              <div className="flex gap-2">
                <button className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm" onClick={sendBulkWhatsApp}>
                  <MessageSquare size={14}/> WhatsApp Selected ({selectedReminderParties.length})
                </button>
                <button className={outlineBtn} onClick={printReminderLetters}>
                   <Printer size={14}/> Print Letters
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={`${tableHeadClass} w-10 text-center`}>
                       <input 
                         type="checkbox" 
                         className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                         checked={overdueReminderRows.length > 0 && selectedReminderParties.length === overdueReminderRows.length}
                         onChange={(e) => {
                            if (e.target.checked) setSelectedReminderParties(overdueReminderRows.map((r:any) => r.party.id));
                            else setSelectedReminderParties([]);
                         }}
                       />
                    </th>
                    {["Party Name", "Contact", "Total Overdue", "Oldest Due", "Status"].map((h) => <th key={h} className={tableHeadClass}>{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {overdueReminderRows.map((row: any) => (
                    <tr key={row.party.id} className="bg-white hover:bg-gray-50">
                      <td className={`${tableCellClass} text-center`}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                          checked={selectedReminderParties.includes(row.party.id)}
                          onChange={() => toggleReminderParty(row.party.id)}
                        />
                      </td>
                      <td className={`${tableCellClass} font-medium`}>{row.party.name}</td>
                      <td className={tableCellClass}>
                         <div className="flex flex-col gap-0.5 text-[11px]">
                           {row.party.phone && <span className="flex items-center gap-1 text-gray-600"><MessageSquare size={10}/> {row.party.phone}</span>}
                           {row.party.email && <span className="flex items-center gap-1 text-gray-500"><Mail size={10}/> {row.party.email}</span>}
                           {!row.party.phone && !row.party.email && <span className="text-gray-400 italic">No contact info</span>}
                         </div>
                      </td>
                      <td className={`${tableCellClass} font-semibold text-red-600`}>NPR {money(row.total)}</td>
                      <td className={tableCellClass}>{row.oldestDays} Days</td>
                      <td className={tableCellClass}>
                         {row.oldestDays > 90 ? (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Critical</span>
                         ) : row.oldestDays > 60 ? (
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Severe</span>
                         ) : (
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Warning</span>
                         )}
                      </td>
                    </tr>
                  ))}
                  {!overdueReminderRows.length && (
                    <tr>
                      <td colSpan={6} className="text-center p-10 text-gray-500 text-[12px] bg-gray-50/50">
                        No overdue invoices match the current filters. Your receivables are looking good!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Tally Data Import" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={cardClass}>
            <div className="flex items-center gap-3 mb-6">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                 <Upload size={24}/>
               </div>
               <div>
                 <h2 className="text-[14px] font-bold text-gray-800">Upload Tally XML Export</h2>
                 <p className="text-[11px] text-gray-500">Import masters and vouchers directly from Tally ERP9 / Prime.</p>
               </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative cursor-pointer group">
              <input
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                type="file"
                accept=".xml,.txt"
                onChange={(e) => e.target.files?.[0] && handleTallyXML(e.target.files[0])}
              />
              <Upload size={32} className="mx-auto text-gray-400 group-hover:text-[#1557b0] mb-3 transition-colors"/>
              <p className="text-[13px] font-medium text-gray-700">Click to browse or drag and drop XML file</p>
              <p className="text-[11px] text-gray-500 mt-1">Supports standard Tally XML export format</p>
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="text-[14px] font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">Import Preview</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
                 <div className="text-[24px] font-bold text-[#1557b0]">{tallyPreview.ledgers.length}</div>
                 <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Ledgers Found</div>
                 {tallyConflictCounts.ledgerConflicts > 0 && (
                   <div className="text-[10px] text-red-600 font-medium mt-1">{tallyConflictCounts.ledgerConflicts} conflicts</div>
                 )}
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
                 <div className="text-[24px] font-bold text-green-600">{tallyPreview.vouchers.length}</div>
                 <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Vouchers Found</div>
              </div>
            </div>

            {tallyIssues.length > 0 && (
              <div className="border border-red-200 rounded-md p-3 bg-red-50 mb-6 max-h-40 overflow-y-auto">
                <div className="text-[12px] font-bold text-red-800 mb-2 flex items-center gap-1.5"><AlertTriangle size={14}/> Validation Issues</div>
                <ul className="list-disc pl-4 text-[11px] text-red-700 space-y-1">
                  {tallyIssues.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button className={`${outlineBtn} w-full`} onClick={validateTallyData} disabled={!tallyPreview.ledgers.length && !tallyPreview.vouchers.length}>
                <CheckCircle size={14}/> 1. Validate Data
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button className={outlineBtn} onClick={importTallyAccounts} disabled={!tallyPreview.ledgers.length}>Import Ledgers Only</button>
                <button className={outlineBtn} onClick={importTallyVouchers} disabled={!tallyPreview.vouchers.length}>Import Vouchers Only</button>
              </div>
              <button className={`${primaryBtn} w-full`} onClick={importTallyAll} disabled={!tallyPreview.ledgers.length && !tallyPreview.vouchers.length}>
                 <Upload size={14}/> 2. Import All Verified Data
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Excel Voucher Import" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`${cardClass} md:col-span-1 space-y-6`}>
            <div>
               <h2 className="text-[13px] font-semibold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-2 mb-4">1. Download Template</h2>
               <div className="flex flex-col gap-2">
                 <button className="h-9 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center justify-start gap-2 shadow-sm" onClick={downloadJournalTemplate}>
                    <FileSpreadsheet size={16} className="text-green-600"/> Journal Entry Template
                 </button>
                 <button className="h-9 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center justify-start gap-2 shadow-sm" onClick={downloadSalesInvoiceTemplate}>
                    <FileSpreadsheet size={16} className="text-blue-600"/> Sales Invoice Template
                 </button>
                 <button className="h-9 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center justify-start gap-2 shadow-sm" onClick={downloadOpeningTemplate}>
                    <FileSpreadsheet size={16} className="text-purple-600"/> Opening Balance Template
                 </button>
               </div>
            </div>

            <div>
               <h2 className="text-[13px] font-semibold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-2 mb-4">2. Upload File</h2>
               <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 relative cursor-pointer group">
                 <input
                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                   type="file"
                   accept=".xlsx,.xls,.csv"
                   onChange={(e) => e.target.files?.[0] && parseExcelFile(e.target.files[0], setVoucherImportRows)}
                 />
                 <Upload size={24} className="mx-auto text-gray-400 group-hover:text-[#1557b0] mb-2 transition-colors"/>
                 <p className="text-[12px] font-medium text-gray-700">Browse Excel/CSV</p>
               </div>
               
               {voucherImportRows.length > 0 && (
                 <div className="mt-3 text-center text-[12px] text-green-700 font-medium">
                   Loaded {voucherImportRows.length} rows successfully.
                 </div>
               )}
            </div>

            <div>
               <h2 className="text-[13px] font-semibold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-2 mb-4">3. Action</h2>
               <div className="flex flex-col gap-2">
                 <button className={`${outlineBtn} w-full`} onClick={validateVoucherImport} disabled={!voucherImportRows.length}>
                   Validate Data
                 </button>
                 <button className={`${primaryBtn} w-full`} onClick={importValidRows} disabled={!validVoucherRows.length}>
                   Import {validVoucherRows.length} Valid Rows
                 </button>
               </div>
               <div className="flex justify-between items-center text-[11px] mt-2 px-1">
                 <span className="text-green-600 font-medium">{validVoucherRows.length} Ready</span>
                 <span className="text-red-600 font-medium">{voucherImportErrors.length} Errors</span>
               </div>
            </div>
          </div>

          <div className={`${cardClass} md:col-span-2`}>
            <h2 className="text-[14px] font-semibold text-gray-800 mb-4">Data Preview</h2>
            
            {voucherImportErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 max-h-32 overflow-y-auto">
                <div className="text-[11px] font-bold text-red-800 uppercase tracking-wide mb-1">Validation Errors</div>
                <ul className="list-disc pl-4 text-[11px] text-red-700 space-y-0.5">
                  {voucherImportErrors.map((e, idx) => <li key={idx}>{e}</li>)}
                </ul>
              </div>
            )}

            {voucherImportRows.length > 0 ? (
              <div className="overflow-x-auto border border-gray-200 rounded-md">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {Object.keys(voucherImportRows[0]).slice(0,6).map((h) => (
                        <th key={h} className={tableHeadClass}>{h}</th>
                      ))}
                      {Object.keys(voucherImportRows[0]).length > 6 && <th className={tableHeadClass}>...</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {voucherImportRows.slice(0, 12).map((row, idx) => (
                      <tr key={idx} className="bg-white hover:bg-gray-50">
                        {Object.keys(voucherImportRows[0]).slice(0,6).map((h) => (
                          <td key={h} className={`${tableCellClass} truncate max-w-[150px]`}>{String(row[h] || "")}</td>
                        ))}
                         {Object.keys(voucherImportRows[0]).length > 6 && <td className={tableCellClass}>...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {voucherImportRows.length > 12 && (
                   <div className="text-center text-[11px] text-gray-500 p-2 bg-gray-50">
                     Showing 12 of {voucherImportRows.length} rows
                   </div>
                )}
              </div>
            ) : (
               <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-md bg-gray-50">
                 <FileSpreadsheet size={32} className="mb-2 opacity-50"/>
                 <p className="text-[13px] font-medium text-gray-600">No data loaded</p>
                 <p className="text-[11px]">Upload a template file to preview data here.</p>
               </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "Bank Statement Import" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className={`${cardClass} lg:col-span-1 space-y-6`}>
            <div>
               <h2 className="text-[13px] font-semibold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">1. Select Bank Format</h2>
               <div className="flex gap-2 flex-wrap">
                 {Object.keys(BANK_FORMATS).map((b) => (
                   <button
                     key={b}
                     className={`px-3 py-1.5 text-[11px] font-medium rounded-full border transition-colors ${
                       selectedBank === b ? "bg-[#1557b0] text-white border-[#1557b0]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                     }`}
                     onClick={() => setSelectedBank(b)}
                   >
                     {b}
                   </button>
                 ))}
               </div>
            </div>

            <div>
               <h2 className="text-[13px] font-semibold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">2. Upload Statement</h2>
               <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 relative cursor-pointer group">
                 <input
                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                   type="file"
                   accept=".xlsx,.xls,.csv"
                   onChange={(e) => e.target.files?.[0] && parseBankFile(e.target.files[0])}
                 />
                 <Upload size={24} className="mx-auto text-gray-400 group-hover:text-[#1557b0] mb-2 transition-colors"/>
                 <p className="text-[12px] font-medium text-gray-700">Browse Bank Statement</p>
               </div>
               
               {bankRows.length > 0 && (
                 <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
                   <div className="flex justify-between items-center text-[11px] mb-1">
                     <span className="text-gray-600">Total Rows:</span>
                     <span className="font-bold text-gray-900">{bankRows.length}</span>
                   </div>
                   <div className="flex justify-between items-center text-[11px] mb-1">
                     <span className="text-gray-600">Auto-Matched:</span>
                     <span className="font-bold text-green-600">{bankMatches.filter(m=>m.status==="Matched").length}</span>
                   </div>
                   <div className="flex justify-between items-center text-[11px]">
                     <span className="text-gray-600">Unmatched:</span>
                     <span className="font-bold text-red-600">{bankMatches.filter(m=>m.status==="Unmatched").length}</span>
                   </div>
                 </div>
               )}
            </div>
          </div>

          <div className={`${cardClass} lg:col-span-3`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-800">Parsed Transactions</h2>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Date", "Description", "Debit", "Credit", "Match Status", "Action"].map((h) => (
                      <th key={h} className={h === "Debit" || h === "Credit" ? `${tableHeadClass} text-right` : tableHeadClass}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bankRows.map((row) => {
                    const match = bankMatches.find((m) => m.rowId === row.id);
                    return (
                      <tr key={row.id} className="bg-white hover:bg-gray-50">
                        <td className={`${tableCellClass} whitespace-nowrap`}>{row.date}</td>
                        <td className={`${tableCellClass} max-w-[250px] truncate`}>{row.description}</td>
                        <td className={`${tableCellClass} text-right text-red-600`}>{row.debit > 0 ? money(row.debit) : ""}</td>
                        <td className={`${tableCellClass} text-right text-green-600`}>{row.credit > 0 ? money(row.credit) : ""}</td>
                        <td className={tableCellClass}>
                           {match?.status === "Matched" ? (
                              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 w-max">
                                <CheckCircle size={10}/> Matched
                              </span>
                           ) : match?.status === "Possible Match" ? (
                              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 w-max">
                                <AlertTriangle size={10}/> Verify
                              </span>
                           ) : (
                              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 w-max">
                                Unmatched
                              </span>
                           )}
                           {match?.voucher && <div className="text-[10px] text-gray-400 mt-1">{match.voucher.voucherNo || match.voucher.id}</div>}
                        </td>
                        <td className={tableCellClass}>
                          {match?.status === "Unmatched" && (
                            <button className="text-[11px] font-medium text-[#1557b0] hover:underline" onClick={() => createBankEntry(row)}>
                              Create Journal
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!bankRows.length && (
                    <tr>
                      <td colSpan={6} className="text-center p-10 text-gray-500 text-[12px] bg-gray-50/50">
                        <Building size={24} className="mx-auto text-gray-400 mb-2 opacity-50"/>
                        <div>No bank statement loaded.</div>
                        <div className="mt-1">Select a bank format and upload an excel/csv file to begin reconciliation.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
