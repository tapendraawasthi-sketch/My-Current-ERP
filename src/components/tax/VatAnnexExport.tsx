// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useStore } from "../../store/useStore";
import { getDB, generateId } from "../../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { Download, AlertTriangle, CheckCircle, FileSpreadsheet } from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

function normalizePAN(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function isBSDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
}

function defaultPreviousMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return String(d.getMonth() + 1).padStart(2, "0");
}

function parseInvoiceNoNumber(no: string) {
  const n = String(no || "").match(/\d+/g);
  if (!n) return null;
  return Number(n[n.length - 1]);
}

export default function VatAnnexExport() {
  const {
    invoices = [],
    parties = [],
    companySettings = {},
    currentFiscalYear = {},
  } = useStore();

  const [monthBS, setMonthBS] = useState(defaultPreviousMonth());
  const [fiscalYear, setFiscalYear] = useState(
    currentFiscalYear?.fiscalYearBS || currentFiscalYear?.name || "2081-82",
  );
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    setFiscalYear(currentFiscalYear?.fiscalYearBS || currentFiscalYear?.name || fiscalYear);
  }, [currentFiscalYear]);

  const periodInvoices = useMemo(() => {
    return (invoices || []).filter((i: any) => {
      const bs = i.dateNepali || i.invoiceDateBS || "";
      if (bs && isBSDate(bs)) return bs.slice(5, 7) === monthBS;
      return true;
    });
  }, [invoices, monthBS]);

  const annexA = useMemo(() => {
    return periodInvoices
      .filter((i: any) => i.type === "sales-invoice" || i.type === "sales")
      .map((i: any, idx: number) => {
        const party = parties.find((p: any) => p.id === i.partyId) || {};
        const taxable = Number(i.taxableAmount || 0);
        const vat = Number(i.vatAmount || 0);
        const total = Number(i.grandTotal || taxable + vat || 0);
        const taxRate = taxable > 0 ? Math.round((vat / taxable) * 100) : 0;

        return {
          "S.No": idx + 1,
          "Fiscal Year (BS)": fiscalYear,
          "Period (month BS)": monthBS,
          "Buyer Name": party.name || i.partyName || "Unknown",
          "Buyer PAN": party.panNumber || party.vatNumber || i.partyPan || "",
          "Invoice Date (BS)": i.dateNepali || i.invoiceDateBS || i.date || "",
          "Invoice No": i.invoiceNo || i.voucherNo || i.id,
          "Taxable Amount": taxable,
          "Tax Rate %": taxRate,
          "VAT Amount": vat,
          "Total Amount": total,
          "Invoice Type (01=Tax Invoice, 02=Zero Rate, 03=Exempt)":
            vat > 0 ? "01" : taxable > 0 ? "02" : "03",
          raw: i,
        };
      });
  }, [periodInvoices, parties, fiscalYear, monthBS]);

  const annexB = useMemo(() => {
    return periodInvoices
      .filter((i: any) => i.type === "purchase-invoice" || i.type === "purchase")
      .map((i: any, idx: number) => {
        const party = parties.find((p: any) => p.id === i.partyId) || {};
        const taxable = Number(i.taxableAmount || 0);
        const vat = Number(i.vatAmount || 0);
        const total = Number(i.grandTotal || taxable + vat || 0);
        const taxRate = taxable > 0 ? Math.round((vat / taxable) * 100) : 0;

        return {
          "S.No": idx + 1,
          "Fiscal Year (BS)": fiscalYear,
          Period: monthBS,
          "Supplier Name": party.name || i.partyName || "Unknown",
          "Supplier PAN": party.panNumber || party.vatNumber || i.partyPan || "",
          "Invoice Date (BS)": i.dateNepali || i.invoiceDateBS || i.date || "",
          "Invoice No": i.invoiceNo || i.voucherNo || i.id,
          "Taxable Amount": taxable,
          "Tax Rate %": taxRate,
          "VAT Amount": vat,
          "Total Amount": total,
          "Is Claimed (1=Yes, 0=No)": i.isVatClaimed === false ? 0 : 1,
          raw: i,
        };
      });
  }, [periodInvoices, parties, fiscalYear, monthBS]);

  const annexC = useMemo(() => {
    return [];
  }, []);

  function validate() {
    const list = [];

    annexB.forEach((r: any) => {
      const pan = normalizePAN(r["Supplier PAN"]);
      if (pan.length !== 9) {
        list.push({
          type: "error",
          invoiceNo: r["Invoice No"],
          description: `Supplier PAN must be exactly 9 digits. Found "${r["Supplier PAN"] || ""}".`,
        });
      }
    });

    const allInvoiceNos = [...annexA, ...annexB]
      .map((r: any) => ({
        invoiceNo: r["Invoice No"],
        n: parseInvoiceNoNumber(r["Invoice No"]),
      }))
      .filter((x) => x.n !== null)
      .sort((a, b) => a.n - b.n);

    for (let i = 1; i < allInvoiceNos.length; i++) {
      const prev = allInvoiceNos[i - 1].n;
      const curr = allInvoiceNos[i].n;
      if (curr - prev > 1) {
        list.push({
          type: "warning",
          invoiceNo: allInvoiceNos[i].invoiceNo,
          description: `Invoice sequence gap detected between ${prev} and ${curr}.`,
        });
      }
    }

    [...annexA, ...annexB].forEach((r: any) => {
      const taxable = Number(r["Taxable Amount"] || 0);
      const vat = Number(r["VAT Amount"] || 0);
      if (taxable > 0 && Math.abs(taxable * 0.13 - vat) > 1) {
        list.push({
          type: "warning",
          invoiceNo: r["Invoice No"],
          description: `VAT mismatch. Taxable × 13% = NPR ${money(taxable * 0.13)}, VAT shown NPR ${money(vat)}.`,
        });
      }

      const date =
        r["Invoice Date (BS)"] ||
        r["Invoice Date"] ||
        r["Date"] ||
        "";

      if (!isBSDate(date)) {
        list.push({
          type: "error",
          invoiceNo: r["Invoice No"],
          description: `Invoice date must be BS format YYYY-MM-DD. Found "${date}".`,
        });
      }
    });

    setIssues(list);

    if (list.some((i) => i.type === "error")) {
      toast.error("Validation found errors. Export blocked.");
    } else if (list.length > 0) {
      toast("Validation completed with warnings.");
    } else {
      toast.success("Validation passed.");
    }

    return list;
  }

  function exportExcel() {
    const currentIssues = validate();
    if (currentIssues.some((i) => i.type === "error")) return;

    const cleanA = annexA.map(({ raw, ...r }) => r);
    const cleanB = annexB.map(({ raw, ...r }) => r);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cleanA), "Annex A");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cleanB), "Annex B");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(annexC), "Annex C (Export)");
    XLSX.writeFile(wb, `VAT_Return_${fiscalYear}_${monthBS}.xlsx`);
    toast.success("VAT annex workbook exported");
  }

  const errorCount = issues.filter((i) => i.type === "error").length;
  const warningCount = issues.filter((i) => i.type === "warning").length;

  function PreviewTable({ title, rows }: { title: string; rows: any[] }) {
    const cleanRows = rows.map(({ raw, ...r }) => r);
    const headers = cleanRows[0] ? Object.keys(cleanRows[0]) : [];

    return (
      <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
          <h3 className="text-[13px] font-bold text-gray-800">{title}</h3>
          <span className="text-[11px] text-gray-500">Showing {Math.min(20, rows.length)} of {rows.length}</span>
        </div>

        {rows.length === 0 ? (
          <div className="text-[12px] py-6 text-center text-gray-500">No records for this period.</div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-md">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {headers.map((h) => (
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap" key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cleanRows.slice(0, 20).map((r: any, idx: number) => (
                  <tr key={idx} className="bg-white hover:bg-gray-50 text-[12px] transition-colors">
                    {headers.map((h) => {
                      const val = r[h];
                      const isNum = typeof val === "number";
                      return (
                        <td className={`px-3 py-2 whitespace-nowrap ${isNum ? 'text-right' : 'text-left'} ${h.includes('Amount') ? 'font-medium text-gray-800' : 'text-gray-600'}`} key={h}>
                          {isNum ? money(val) : String(val ?? "")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white text-gray-800 p-4 rounded-md">
      <div className="flex flex-col md:flex-row md:items-end gap-4 mb-5 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-[14px] font-bold text-gray-800">IRD Annex Export</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Export VAT Annex A, B and C in IRD-ready Excel format.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:ml-auto">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Fiscal Year</label>
            <input 
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full shadow-sm" 
              value={fiscalYear} 
              onChange={(e) => setFiscalYear(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Month BS</label>
            <select 
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full shadow-sm" 
              value={monthBS} 
              onChange={(e) => setMonthBS(e.target.value)}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                  {String(i + 1).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-5 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 text-[12px]">
            <span className="text-red-700 font-medium flex items-center gap-1">
              Errors: <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-red-200">{errorCount}</span>
            </span>
            <span className="text-amber-700 font-medium flex items-center gap-1">
              Warnings: <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-amber-200">{warningCount}</span>
            </span>
            {issues.length === 0 && <span className="text-green-700 font-medium flex items-center gap-1">Validation not run</span>}
          </div>

          <div className="flex gap-2">
            <button 
              className="h-8 px-3 bg-white text-gray-700 border border-gray-300 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm" 
              onClick={validate}
            >
              <CheckCircle size={14} /> Validate
            </button>
            <button 
              className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors flex items-center gap-1.5 shadow-sm" 
              onClick={exportExcel}
            >
              <Download size={14} /> Export To Excel
            </button>
          </div>
        </div>

        {issues.length > 0 && (
          <div className="mt-4 bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[12px] font-bold text-gray-800 mb-2 border-b border-gray-100 pb-1">Validation Issues Found</div>
            <ul className="list-disc pl-5 text-[12px] space-y-1">
              {issues.map((i, idx) => (
                <li key={idx} className={i.type === "error" ? "text-red-600" : "text-amber-600"}>
                  <span className="font-medium">Invoice {i.invoiceNo}:</span> {i.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <PreviewTable title="Annex A Preview — Sales" rows={annexA} />
        <PreviewTable title="Annex B Preview — Purchases" rows={annexB} />
        <PreviewTable title="Annex C Preview — Export" rows={annexC} />
      </div>
    </div>
  );
}
