// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { Download, Printer, AlertTriangle, FileText, ChevronDown, ChevronUp, Users, Clock, AlertCircle } from "lucide-react";

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

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function isSalesType(type: string) {
  return ["sales-invoice", "sales"].includes(String(type || ""));
}

function getPartyBillwiseOutstanding(
  partyId: string,
  type: "sales" | "purchase",
  invoices: any[],
  vouchers: any[],
  parties: any[],
) {
  const invType = type === "sales" ? ["sales-invoice", "sales"] : ["purchase-invoice", "purchase"];

  const partyInvoices = (invoices || []).filter(
    (i) =>
      invType.includes(i.type) &&
      i.partyId === partyId &&
      i.status === "posted" &&
      (i.paymentStatus === "unpaid" || i.paymentStatus === "partial"),
  );

  return partyInvoices
    .map((inv) => {
      const paid = (vouchers || [])
        .filter(
          (v) =>
            (v.linkedInvoiceId === inv.id ||
              (v.billWiseDetails || []).some((b: any) => b.invoiceId === inv.id)) &&
            v.status === "posted",
        )
        .reduce((s: number, v: any) => s + Number(v.grandTotal || v.amount || 0), 0);

      const balance = Math.max(0, Number(inv.grandTotal || 0) - paid);
      const party = (parties || []).find((p: any) => p.id === partyId);
      const creditDays = Number(party?.creditDays || 30);

      const invoiceDate = new Date(inv.date);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + creditDays);

      const daysOverdue = Math.max(
        0,
        Math.floor((new Date().getTime() - dueDate.getTime()) / 86400000),
      );

      const interestRate = Number(party?.interestRate || 0);
      const interest =
        balance > 0 && daysOverdue > 0 ? balance * (interestRate / 100 / 365) * daysOverdue : 0;

      const dueDateStr = dueDate.toISOString().split("T")[0];

      return {
        ...inv,
        paid,
        balance,
        dueDate: dueDateStr,
        daysOverdue,
        interest,
        invoiceDate: inv.date,
      };
    })
    .filter((i) => i.balance > 0);
}

export default function DebtorsAging() {
  const {
    invoices = [],
    parties = [],
    vouchers = [],
    companySettings = {},
    accounts = [],
    currentFiscalYear = {},
    addVoucher,
    currentUser = {},
  } = useStore();

  const [asOfDate, setAsOfDate] = useState(todayISO());
  const [partyGroup, setPartyGroup] = useState("All");
  const [minAmount, setMinAmount] = useState("");
  const [showInterest, setShowInterest] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedPartyId, setExpandedPartyId] = useState("");
  const [printing, setPrinting] = useState(false);

  const agingData = useMemo(() => {
    const rows = (parties || [])
      .filter(
        (p) =>
          p.type === "customer" ||
          p.type === "debtor" ||
          p.type === "both" ||
          !p.type ||
          String(p.type || "").toLowerCase().includes("customer"),
      )
      .map((party) => {
        const bills = getPartyBillwiseOutstanding(party.id, "sales", invoices, vouchers, parties);
        const total = bills.reduce((s, b) => s + Number(b.balance || 0), 0);
        const interest = bills.reduce((s, b) => s + Number(b.interest || 0), 0);

        const d30 = bills
          .filter((b) => b.daysOverdue >= 0 && b.daysOverdue <= 30)
          .reduce((s, b) => s + b.balance, 0);

        const d60 = bills
          .filter((b) => b.daysOverdue > 30 && b.daysOverdue <= 60)
          .reduce((s, b) => s + b.balance, 0);

        const d90 = bills
          .filter((b) => b.daysOverdue > 60 && b.daysOverdue <= 90)
          .reduce((s, b) => s + b.balance, 0);

        const d180 = bills
          .filter((b) => b.daysOverdue > 90 && b.daysOverdue <= 180)
          .reduce((s, b) => s + b.balance, 0);

        const d180plus = bills
          .filter((b) => b.daysOverdue > 180)
          .reduce((s, b) => s + b.balance, 0);

        const overLimit = total > Number(party.creditLimit || 0) && Number(party.creditLimit || 0) > 0;

        return {
          party,
          bills,
          total,
          interest,
          d30,
          d60,
          d90,
          d180,
          d180plus,
          overLimit,
        };
      })
      .filter((r) => r.total > 0);

    return rows;
  }, [invoices, vouchers, parties]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    const min = Number(minAmount || 0);

    return agingData.filter((r) => {
      if (partyGroup !== "All" && String(r.party.type || "") !== partyGroup) return false;
      if (min > 0 && r.total < min) return false;
      if (q && !String(r.party.name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [agingData, partyGroup, minAmount, search]);

  const summary = useMemo(() => {
    const totalOutstanding = filteredRows.reduce((s, r) => s + r.total, 0);
    const current = filteredRows.reduce((s, r) => {
      const currentBills = r.bills.filter((b) => b.daysOverdue === 0).reduce((x, b) => x + b.balance, 0);
      return s + currentBills;
    }, 0);
    const overdue = filteredRows.reduce((s, r) => {
      const overdueBills = r.bills.filter((b) => b.daysOverdue > 0).reduce((x, b) => x + b.balance, 0);
      return s + overdueBills;
    }, 0);

    const paidInvoices = (invoices || []).filter(
      (i) => isSalesType(i.type) && i.status === "posted" && i.paymentStatus === "paid" && i.paidDate,
    );

    const avgDays =
      paidInvoices.length > 0
        ? paidInvoices.reduce((s, i) => {
            const a = new Date(i.date).getTime();
            const b = new Date(i.paidDate).getTime();
            return s + Math.max(0, Math.floor((b - a) / 86400000));
          }, 0) / paidInvoices.length
        : 0;

    const overLimitCount = filteredRows.filter((r) => r.overLimit).length;
    const totalInterest = filteredRows.reduce((s, r) => s + r.interest, 0);

    return {
      totalOutstanding,
      current,
      overdue,
      avgDays,
      overLimitCount,
      totalInterest,
      d30: filteredRows.reduce((s, r) => s + r.d30, 0),
      d60: filteredRows.reduce((s, r) => s + r.d60, 0),
      d90: filteredRows.reduce((s, r) => s + r.d90, 0),
      d180: filteredRows.reduce((s, r) => s + r.d180, 0),
      d180plus: filteredRows.reduce((s, r) => s + r.d180plus, 0),
    };
  }, [filteredRows, invoices]);

  async function createInterestJournalForParty(row: any) {
    if (!row.interest || row.interest <= 0) return toast.error("No interest to post for this party");

    const voucher = {
      id: generateId(),
      type: "journal",
      status: "posted",
      date: todayISO(),
      partyId: row.party.id,
      narration: `Interest on overdue bills - ${row.party.name}`,
      amount: row.interest,
      grandTotal: row.interest,
      lines: [
        {
          id: generateId(),
          accountName: row.party.name,
          partyId: row.party.id,
          debit: row.interest,
          credit: 0,
        },
        {
          id: generateId(),
          accountName: "Interest Received",
          debit: 0,
          credit: row.interest,
        },
      ],
    };

    if (addVoucher) await addVoucher(voucher);
    else await getDB().table("vouchers").put(voucher).catch(() => {});

    toast.success(`Interest journal posted for ${row.party.name}`);
  }

  async function bulkInterestJournals() {
    const rows = filteredRows.filter((r) => r.interest > 0);
    const total = rows.reduce((s, r) => s + r.interest, 0);

    if (!rows.length) return toast.error("No overdue interest found");
    if (!confirm(`Will create ${rows.length} journal entries for NPR ${money(total)} total interest. Proceed?`)) return;

    for (let i = 0; i < rows.length; i++) {
      toast(`Posting ${i + 1}/${rows.length}: ${rows[i].party.name}`);
      await createInterestJournalForParty(rows[i]);
    }

    toast.success("Bulk interest journals completed");
  }

  function exportExcel() {
    const summarySheet = filteredRows.map((r) => ({
      "Party Name": r.party.name,
      PAN: r.party.panNumber || "",
      "Credit Limit": Number(r.party.creditLimit || 0),
      Outstanding: r.total,
      "0-30 Days": r.d30,
      "31-60 Days": r.d60,
      "61-90 Days": r.d90,
      "91-180 Days": r.d180,
      "180+ Days": r.d180plus,
      Interest: r.interest,
      "Over Limit": r.overLimit ? "Yes" : "No",
    }));

    const billSheet = filteredRows.flatMap((r) =>
      r.bills.map((b) => ({
        "Party Name": r.party.name,
        "Invoice No": b.invoiceNo,
        Date: b.invoiceDate,
        "Due Date": b.dueDate,
        "Invoice Amount": b.grandTotal,
        Paid: b.paid,
        Balance: b.balance,
        "Days Overdue": b.daysOverdue,
        Interest: b.interest,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summarySheet), "Aging Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(billSheet), "Bill Wise Details");
    XLSX.writeFile(wb, `Debtors_Aging_${asOfDate}.xlsx`);
    toast.success("Aging report exported");
  }

  function printReport() {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
  }

  const partyTypes = useMemo(() => {
    return ["All", ...Array.from(new Set((parties || []).map((p) => p.type).filter(Boolean)))];
  }, [parties]);

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
            #print-area { position: absolute; left: 0; top: 0; width: 100%; background: white; padding: 20px; }
            .no-print { display: none !important; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
          }
        `}
      </style>

      <div className="no-print flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Users size={18} className="text-[#1557b0]" /> Debtors (Receivables) Aging Report
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Bill-wise receivable aging, overdue interest calculation, and credit limit alerts.
          </p>
        </div>

        <div className="flex gap-2">
          <button className={outlineBtn} onClick={exportExcel}>
            <Download size={14} /> Export to Excel
          </button>
          <button className={primaryBtn} onClick={printReport}>
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      <div className="no-print grid grid-cols-1 md:grid-cols-5 gap-3 mb-6 bg-white p-3 rounded-md border border-gray-200 shadow-sm">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">As of Date</label>
          <input className={inputClass} type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Party Group</label>
          <select className={inputClass} value={partyGroup} onChange={(e) => setPartyGroup(e.target.value)}>
            {partyTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Min. Outstanding (NPR)</label>
          <input className={inputClass} type="number" placeholder="0.00" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Search Party</label>
          <input className={inputClass} placeholder="Search name..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="flex items-center">
          <label className="flex items-center gap-2 cursor-pointer mt-5">
            <input type="checkbox" className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]" checked={showInterest} onChange={(e) => setShowInterest(e.target.checked)} />
            <span className="text-[12px] font-medium text-gray-700">Calculate Interest</span>
          </label>
        </div>
      </div>

      <div className="no-print grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col justify-center">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1"><FileText size={14}/> Total Outstanding</div>
          <div className="text-[20px] font-bold text-gray-800">NPR {money(summary.totalOutstanding)}</div>
        </div>

        <div className="bg-green-50/50 border border-green-200 rounded-md p-4 shadow-sm flex flex-col justify-center">
          <div className="text-[11px] font-medium text-green-700 uppercase tracking-wide flex items-center gap-1.5 mb-1"><CheckCircle size={14}/> Current (Not Due)</div>
          <div className="text-[20px] font-bold text-green-800">NPR {money(summary.current)}</div>
        </div>

        <div className="bg-red-50/50 border border-red-200 rounded-md p-4 shadow-sm flex flex-col justify-center">
          <div className="text-[11px] font-medium text-red-700 uppercase tracking-wide flex items-center gap-1.5 mb-1"><AlertTriangle size={14}/> Overdue Total</div>
          <div className="text-[20px] font-bold text-red-800">NPR {money(summary.overdue)}</div>
        </div>

        <div className="bg-amber-50/50 border border-amber-200 rounded-md p-4 shadow-sm flex flex-col justify-center">
          <div className="text-[11px] font-medium text-amber-700 uppercase tracking-wide flex items-center gap-1.5 mb-1"><Clock size={14}/> Average Collection</div>
          <div className="text-[20px] font-bold text-amber-800">{money(summary.avgDays)} Days</div>
        </div>
      </div>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
           {summary.overLimitCount > 0 && (
             <span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1 text-[11px] font-semibold flex items-center gap-1.5">
               <AlertCircle size={14}/> {summary.overLimitCount} Part{summary.overLimitCount === 1 ? 'y' : 'ies'} Over Limit
             </span>
           )}
        </div>
        
        {showInterest && summary.totalInterest > 0 && (
           <button className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm" onClick={bulkInterestJournals}>
             Generate Interest Journals for All
           </button>
        )}
      </div>

      <div id="print-area" className={cardClass}>
        <div className="hidden print:block mb-6 text-center">
          <h1 className="text-[18px] font-bold text-gray-900">{companySettings?.name || "Company Name"}</h1>
          <div className="text-[12px] text-gray-600">
            {companySettings?.address || "Company Address"} | PAN: {companySettings?.panNumber || "N/A"}
          </div>
          <h2 className="text-[14px] font-bold mt-4 uppercase tracking-wider text-gray-800 border-b border-gray-300 pb-2 inline-block">Debtors Aging Report</h2>
          <div className="text-[11px] text-gray-500 mt-1">As of: {asOfDate}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {[
                  "Party Name",
                  "PAN",
                  "Credit Limit",
                  "Outstanding",
                  "1-30 Days",
                  "31-60 Days",
                  "61-90 Days",
                  "91-180 Days",
                  "180+ Days",
                  ...(showInterest ? ["Int. (NPR)"] : []),
                  "Over Limit",
                  "Action",
                ].map((h) => (
                  <th key={h} className={h === "Action" ? `${tableHeadClass} no-print` : tableHeadClass}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((r) => {
                const expanded = expandedPartyId === r.party.id;

                return (
                  <React.Fragment key={r.party.id}>
                    <tr className={`bg-white hover:bg-gray-50 ${r.overLimit ? "bg-red-50/20" : ""}`}>
                      <td className={tableCellClass}>
                        <button
                          className="font-medium text-[#1557b0] hover:underline no-print flex items-center gap-1.5"
                          onClick={() => setExpandedPartyId(expanded ? "" : r.party.id)}
                        >
                          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                          {r.party.name}
                        </button>
                        <span className="hidden print:inline font-medium">{r.party.name}</span>
                      </td>
                      <td className={tableCellClass}>{r.party.panNumber || r.party.vatNumber || <span className="text-gray-400">-</span>}</td>
                      <td className={tableCellClass}>{r.party.creditLimit > 0 ? money(r.party.creditLimit) : <span className="text-gray-400">-</span>}</td>
                      <td className={`${tableCellClass} font-semibold text-gray-900`}>{money(r.total)}</td>
                      <td className={tableCellClass}>{money(r.d30)}</td>
                      <td className={tableCellClass}>{money(r.d60)}</td>
                      <td className={tableCellClass}>{money(r.d90)}</td>
                      <td className={tableCellClass}>{money(r.d180)}</td>
                      <td className={tableCellClass}>{money(r.d180plus)}</td>
                      {showInterest && <td className={`${tableCellClass} font-medium ${r.interest > 0 ? "text-amber-600" : ""}`}>{money(r.interest)}</td>}
                      <td className={tableCellClass}>
                        {r.overLimit ? (
                           <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Yes</span>
                        ) : (
                           <span className="text-gray-400 font-medium">No</span>
                        )}
                      </td>
                      <td className={`${tableCellClass} no-print`}>
                        {showInterest && r.interest > 0 && (
                          <button className="text-[11px] font-medium text-[#1557b0] hover:underline" onClick={() => createInterestJournalForParty(r)}>
                            Post Interest
                          </button>
                        )}
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="bg-blue-50/30">
                        <td colSpan={showInterest ? 12 : 11} className="p-4 border-b border-gray-200">
                          <div className="bg-white border border-indigo-100 rounded shadow-sm overflow-hidden">
                             <div className="bg-indigo-50/50 px-3 py-2 border-b border-indigo-100 font-semibold text-[12px] text-indigo-900 flex items-center gap-2">
                               <FileText size={14}/> Bill-wise Outstanding for {r.party.name}
                             </div>
                            <table className="w-full border-collapse">
                              <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                  {[
                                    "Invoice No",
                                    "Date",
                                    "Due Date",
                                    "Invoice Amt",
                                    "Paid Amt",
                                    "Balance",
                                    "Days Overdue",
                                    ...(showInterest ? ["Interest (NPR)"] : []),
                                  ].map((h) => (
                                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {r.bills.map((b) => (
                                  <tr key={b.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-[11px] font-mono font-medium">{b.invoiceNo}</td>
                                    <td className="px-3 py-2 text-[11px] text-gray-600">{b.invoiceDate}</td>
                                    <td className="px-3 py-2 text-[11px] text-gray-600">{b.dueDate}</td>
                                    <td className="px-3 py-2 text-[11px] text-gray-800">{money(b.grandTotal)}</td>
                                    <td className="px-3 py-2 text-[11px] text-gray-600">{money(b.paid)}</td>
                                    <td className="px-3 py-2 text-[11px] font-semibold text-gray-900">{money(b.balance)}</td>
                                    <td className="px-3 py-2 text-[11px]">
                                       {b.daysOverdue > 0 ? (
                                         <span className="text-red-600 font-medium">{b.daysOverdue} Days</span>
                                       ) : (
                                         <span className="text-green-600 font-medium">Not Due</span>
                                       )}
                                    </td>
                                    {showInterest && <td className="px-3 py-2 text-[11px] text-amber-600 font-medium">{money(b.interest)}</td>}
                                  </tr>
                                ))}
                                <tr className="bg-indigo-50/30">
                                  <td className="px-3 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wide" colSpan={5}>Subtotal Balance</td>
                                  <td className="px-3 py-2 text-[11px] font-bold text-gray-900">{money(r.total)}</td>
                                  <td className="px-3 py-2 text-[11px]"></td>
                                  {showInterest && <td className="px-3 py-2 text-[11px] font-bold text-amber-700">{money(r.interest)}</td>}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredRows.length > 0 && (
                <tr className="bg-gray-100/80 border-t-2 border-gray-300">
                  <td className={`${tableCellClass} font-bold text-gray-800 uppercase tracking-wide`} colSpan={3}>Grand Total</td>
                  <td className={`${tableCellClass} font-bold text-gray-900`}>{money(summary.totalOutstanding)}</td>
                  <td className={`${tableCellClass} font-bold text-gray-700`}>{money(summary.d30)}</td>
                  <td className={`${tableCellClass} font-bold text-gray-700`}>{money(summary.d60)}</td>
                  <td className={`${tableCellClass} font-bold text-gray-700`}>{money(summary.d90)}</td>
                  <td className={`${tableCellClass} font-bold text-gray-700`}>{money(summary.d180)}</td>
                  <td className={`${tableCellClass} font-bold text-gray-700`}>{money(summary.d180plus)}</td>
                  {showInterest && <td className={`${tableCellClass} font-bold text-amber-700`}>{money(summary.totalInterest)}</td>}
                  <td className={tableCellClass}></td>
                  <td className={`${tableCellClass} no-print`}></td>
                </tr>
              )}

              {!filteredRows.length && (
                <tr>
                  <td colSpan={showInterest ? 12 : 11} className="text-center p-10 text-gray-500 text-[12px] bg-gray-50/50 border-t border-gray-100">
                     No outstanding receivables found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="hidden print:flex justify-between mt-16 text-[11px] font-medium text-gray-600 px-8">
          <div className="text-center w-48 border-t border-gray-400 pt-2">Prepared By</div>
          <div className="text-center w-48 border-t border-gray-400 pt-2">Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
}