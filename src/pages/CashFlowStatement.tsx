// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cash Flow Statement report page.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, Table, NepaliDatePicker } from "../components/ui";
import { FileSpreadsheet, Printer, Activity } from "lucide-react";
import { computeCashFlow } from "../lib/accounting";
import { formatNumber, dateToAD } from "../lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

interface FlowRow {
  id: string;
  label: string;
  amount: number;
}

const CashFlowStatement: React.FC = () => {
  const { accounts, vouchers, companySettings, currentFiscalYear } = useStore();
  const [startDate, setStartDate] = useState<string>(
    currentFiscalYear?.startDate || dateToAD(new Date()),
  );
  const [endDate, setEndDate] = useState<string>(
    currentFiscalYear?.endDate || dateToAD(new Date()),
  );

  useEffect(() => {
    if (currentFiscalYear) {
      setStartDate(currentFiscalYear.startDate);
      setEndDate(currentFiscalYear.endDate);
    }
  }, [currentFiscalYear]);

  const cashFlow = useMemo(() => {
    return computeCashFlow(accounts, vouchers, startDate, endDate);
  }, [accounts, vouchers, startDate, endDate]);

  const verifiedClosing = useMemo(() => {
    const expected = round2(cashFlow.openingCash + cashFlow.netChange);
    return round2(cashFlow.closingCash) === expected;
  }, [cashFlow]);

  const verificationDifference = useMemo(() => {
    return round2(cashFlow.closingCash - round2(cashFlow.openingCash + cashFlow.netChange));
  }, [cashFlow]);

  const operatingRows: FlowRow[] = [
    {
      id: "net-profit-before-tax",
      label: "Net Profit Before Tax",
      amount: cashFlow.operating.items[0]?.amount || 0,
    },
    {
      id: "depreciation",
      label: "Add: Depreciation",
      amount: cashFlow.operating.items[1]?.amount || 0,
    },
    {
      id: "loss-on-sale",
      label: "Add: Loss on Sale of Assets",
      amount: cashFlow.operating.items[2]?.amount || 0,
    },
    {
      id: "gain-on-sale",
      label: "Less: Gain on Sale of Assets",
      amount: cashFlow.operating.items[3]?.amount || 0,
    },
    {
      id: "operating-profit-before-wcms",
      label: "Operating Profit Before Working Capital Changes",
      amount: cashFlow.operating.total,
    },
  ];

  const workingCapitalRows: FlowRow[] = [
    {
      id: "debtors",
      label: "Decrease/(Increase) in Debtors",
      amount: cashFlow.operating.items[4]?.amount || 0,
    },
    {
      id: "stock",
      label: "Decrease/(Increase) in Stock",
      amount: cashFlow.operating.items[5]?.amount || 0,
    },
    {
      id: "advances",
      label: "Decrease/(Increase) in Advances",
      amount: cashFlow.operating.items[6]?.amount || 0,
    },
    {
      id: "creditors",
      label: "Increase/(Decrease) in Creditors",
      amount: cashFlow.operating.items[7]?.amount || 0,
    },
    {
      id: "outstanding-expenses",
      label: "Increase/(Decrease) in Outstanding Expenses",
      amount: cashFlow.operating.items[8]?.amount || 0,
    },
    {
      id: "net-cash-operations",
      label: "Net Cash from Operations",
      amount: round2(
        cashFlow.operating.total +
          (cashFlow.operating.items[4]?.amount || 0) +
          (cashFlow.operating.items[5]?.amount || 0) +
          (cashFlow.operating.items[6]?.amount || 0) +
          (cashFlow.operating.items[7]?.amount || 0) +
          (cashFlow.operating.items[8]?.amount || 0),
      ),
    },
  ];

  const investingRows: FlowRow[] = [
    {
      id: "purchase-fixed-assets",
      label: "Purchase of Fixed Assets",
      amount: cashFlow.investing.items[0]?.amount || 0,
    },
    {
      id: "sale-fixed-assets",
      label: "Sale of Fixed Assets",
      amount: cashFlow.investing.items[1]?.amount || 0,
    },
    {
      id: "net-cash-investing",
      label: "Net Cash from Investing",
      amount: cashFlow.investing.total,
    },
  ];

  const financingRows: FlowRow[] = [
    {
      id: "proceeds-loans",
      label: "Proceeds from Loans",
      amount: cashFlow.financing.items[0]?.amount || 0,
    },
    {
      id: "repayment-loans",
      label: "Repayment of Loans",
      amount: cashFlow.financing.items[1]?.amount || 0,
    },
    {
      id: "capital-introduced",
      label: "Capital Introduced",
      amount: cashFlow.financing.items[2]?.amount || 0,
    },
    { id: "drawings", label: "Drawings", amount: cashFlow.financing.items[3]?.amount || 0 },
    {
      id: "net-cash-financing",
      label: "Net Cash from Financing",
      amount: cashFlow.financing.total,
    },
  ];

  const columns = [
    { key: "label", header: "Particulars", width: "65%" },
    {
      key: "amount",
      header: "Amount (Rs.)",
      align: "right",
      render: (value: number) => <span className="font-mono">{formatNumber(value)}</span>,
    },
  ];

  const handleExportExcel = () => {
    try {
      exportCashFlowToExcel(cashFlow, startDate, endDate);
      toast.success("Cash Flow Statement exported to Excel.");
    } catch (error: any) {
      toast.error(error?.message || "Could not export Cash Flow Statement.");
    }
  };

  const handlePrintPDF = () => {
    try {
      const blob = generateCashFlowPDF(cashFlow, companySettings, startDate, endDate);
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch (error: any) {
      toast.error(error?.message || "Could not generate PDF.");
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-[#000000]">Cash Flow Statement</h1>
          <p className="text-[11px] text-[#000000] mt-0.5">
            Operating, investing and financing activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<FileSpreadsheet className="h-4 w-4" />}
            onClick={handleExportExcel}
          >
            Export Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Printer className="h-4 w-4" />}
            onClick={handlePrintPDF}
          >
            Print PDF
          </Button>
        </div>
      </div>

      <Card border padding="md" className="no-print">
        <div className="grid gap-4 lg:grid-cols-3">
          <NepaliDatePicker label="From Date" value={startDate} onChange={setStartDate} />
          <NepaliDatePicker label="To Date" value={endDate} onChange={setEndDate} />
          <div className="rounded-xl border border-[#9DC07A] bg-[#EBF5E2] p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#000000]">
              Verification
            </div>
            <div className="mt-3 text-sm font-bold text-[#000000]">
              {verifiedClosing ? (
                <Badge variant="success">VERIFIED ✓</Badge>
              ) : (
                <Badge variant="danger">WARNING</Badge>
              )}
            </div>
            {!verifiedClosing && (
              <div className="mt-2 text-[11px] text-rose-600">
                Difference: Rs. {formatNumber(verificationDifference)}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card border padding="md" className="bg-[#EBF5E2]">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#9DC07A] bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#000000]">
              Net Cash from Operations
            </div>
            <div className="mt-3 text-lg font-bold text-[#000000]">
              Rs. {formatNumber(cashFlow.operating.total)}
            </div>
          </div>
          <div className="rounded-xl border border-[#9DC07A] bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#000000]">
              Net Cash from Investing
            </div>
            <div className="mt-3 text-lg font-bold text-[#000000]">
              Rs. {formatNumber(cashFlow.investing.total)}
            </div>
          </div>
          <div className="rounded-xl border border-[#9DC07A] bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#000000]">
              Net Cash from Financing
            </div>
            <div className="mt-3 text-lg font-bold text-[#000000]">
              Rs. {formatNumber(cashFlow.financing.total)}
            </div>
          </div>
        </div>
      </Card>

      <Card border padding="md" className="grid gap-5">
        <div>
          <div className="px-4 py-2 bg-[#f0f4ff] text-[11px] font-bold text-[#1557b0] uppercase tracking-wide mb-3">
            A. CASH FLOWS FROM OPERATING ACTIVITIES
          </div>
          <Table columns={columns} data={operatingRows} rowKey="id" stickyHeader compact />
          <div className="mt-3 text-right text-sm font-bold text-[#000000]">
            Operating Profit Before Working Capital Changes: Rs.{" "}
            {formatNumber(cashFlow.operating.total)}
          </div>
        </div>

        <div>
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[#000000]">
            Working Capital Changes
          </div>
          <Table columns={columns} data={workingCapitalRows} rowKey="id" stickyHeader compact />
          <div className="mt-3 text-right text-sm font-bold text-[#000000]">
            Net Cash from Operations: Rs.{" "}
            {formatNumber(
              workingCapitalRows.find((row) => row.id === "net-cash-operations")?.amount || 0,
            )}
          </div>
        </div>

        <div>
          <div className="px-4 py-2 bg-[#f0f4ff] text-[11px] font-bold text-[#1557b0] uppercase tracking-wide mb-3">
            B. CASH FLOWS FROM INVESTING ACTIVITIES
          </div>
          <Table columns={columns} data={investingRows} rowKey="id" stickyHeader compact />
          <div className="mt-3 text-right text-sm font-bold text-[#000000]">
            Net Cash from Investing: Rs. {formatNumber(cashFlow.investing.total)}
          </div>
        </div>

        <div>
          <div className="px-4 py-2 bg-[#f0f4ff] text-[11px] font-bold text-[#1557b0] uppercase tracking-wide mb-3">
            C. CASH FLOWS FROM FINANCING ACTIVITIES
          </div>
          <Table columns={columns} data={financingRows} rowKey="id" stickyHeader compact />
          <div className="mt-3 text-right text-sm font-bold text-[#000000]">
            Net Cash from Financing: Rs. {formatNumber(cashFlow.financing.total)}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 bg-[#EBF5E2] rounded-xl p-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#000000]">
              Net Increase/(Decrease) in Cash
            </div>
            <div className="mt-2 text-lg font-bold text-[#000000]">
              Rs. {formatNumber(cashFlow.netChange)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#000000]">
              Opening Cash &amp; Cash Equivalents
            </div>
            <div className="mt-2 text-lg font-bold text-[#000000]">
              Rs. {formatNumber(cashFlow.openingCash)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#000000]">
              Closing Cash &amp; Cash Equivalents
            </div>
            <div className="mt-2 text-lg font-bold text-[#000000]">
              Rs. {formatNumber(cashFlow.closingCash)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

function exportCashFlowToExcel(
  data: any,
  startDate: string,
  endDate: string,
  filename: string = "Cash_Flow_Statement.xlsx",
) {
  const headers = ["Section", "Particulars", "Amount (Rs.)"];
  const rows: any[] = [];

  rows.push(["Period", `${startDate} to ${endDate}`, ""]);
  rows.push([]);

  rows.push(["A. OPERATING ACTIVITIES", "", ""]);
  data.operating.items.forEach((item: any) => rows.push(["", item.label, item.amount]));
  rows.push(["", "Operating Profit Before Working Capital Changes", data.operating.total]);
  rows.push([]);

  rows.push(["A. WORKING CAPITAL CHANGES", "", ""]);
  rows.push(["", "Net Cash from Operations", data.operating.total]);
  rows.push([]);

  rows.push(["B. INVESTING ACTIVITIES", "", ""]);
  data.investing.items.forEach((item: any) => rows.push(["", item.label, item.amount]));
  rows.push(["", "Net Cash from Investing", data.investing.total]);
  rows.push([]);

  rows.push(["C. FINANCING ACTIVITIES", "", ""]);
  data.financing.items.forEach((item: any) => rows.push(["", item.label, item.amount]));
  rows.push(["", "Net Cash from Financing", data.financing.total]);
  rows.push([]);

  rows.push(["", "Net Increase/(Decrease) in Cash", data.netChange]);
  rows.push(["", "Opening Cash & Cash Equivalents", data.openingCash]);
  rows.push(["", "Closing Cash & Cash Equivalents", data.closingCash]);
  rows.push([
    "",
    "Verified Closing Cash",
    data.openingCash + data.netChange === data.closingCash ? "VERIFIED" : "WARNING",
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cash Flow Statement");
  XLSX.writeFile(wb, filename);
}

function generateCashFlowPDF(data: any, company: any, startDate: string, endDate: string): Blob {
  const doc = new jsPDF();
  let y = 18;

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text(company.name || "Company Name", 105, y, { align: "center" });
  y += 6;
  if (company.address) {
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text(company.address, 105, y, { align: "center" });
    y += 5;
  }
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Cash Flow Statement", 105, y, { align: "center" });
  y += 5;
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Period: ${startDate} to ${endDate}`, 105, y, { align: "center" });
  y += 8;

  const drawSection = (title: string, rows: any[], totalLabel: string, totalValue: number) => {
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, 15, y);
    y += 5;
    doc.setLineWidth(0.25);
    doc.line(15, y, 195, y);
    y += 6;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    rows.forEach((row) => {
      doc.text(row.label, 18, y);
      doc.text(formatNumber(row.amount), 195, y, { align: "right" });
      y += 5;
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
    });

    doc.setFont("Helvetica", "bold");
    doc.text(totalLabel, 18, y);
    doc.text(formatNumber(totalValue), 195, y, { align: "right" });
    y += 10;
  };

  drawSection(
    "A. CASH FLOWS FROM OPERATING ACTIVITIES",
    data.operating.items,
    "Operating Profit Before Working Capital Changes",
    data.operating.total,
  );
  drawSection(
    "B. CASH FLOWS FROM INVESTING ACTIVITIES",
    data.investing.items,
    "Net Cash from Investing",
    data.investing.total,
  );
  drawSection(
    "C. CASH FLOWS FROM FINANCING ACTIVITIES",
    data.financing.items,
    "Net Cash from Financing",
    data.financing.total,
  );

  doc.setFont("Helvetica", "bold");
  doc.text("NET INCREASE/(DECREASE) IN CASH:", 15, y);
  doc.text(formatNumber(data.netChange), 195, y, { align: "right" });
  y += 6;
  doc.text("Opening Cash & Cash Equivalents:", 15, y);
  doc.text(formatNumber(data.openingCash), 195, y, { align: "right" });
  y += 6;
  doc.text("CLOSING CASH & CASH EQUIVALENTS:", 15, y);
  doc.text(formatNumber(data.closingCash), 195, y, { align: "right" });
  y += 8;

  const verifiedText =
    round2(data.openingCash + data.netChange) === round2(data.closingCash)
      ? "VERIFIED ✓"
      : "WARNING: Reconciliation mismatch";
  doc.setFont("Helvetica", "normal");
  doc.text(verifiedText, 15, y);

  return doc.output("blob");
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export default CashFlowStatement;

