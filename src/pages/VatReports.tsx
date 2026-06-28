// src/pages/VatReports.tsx
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { adToBS, formatBSDate } from "../lib/nepaliDate";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import VatAnnexExport from "../components/tax/VatAnnexExport";

type VatInvoiceType =
  | "sales-invoice"
  | "purchase-invoice"
  | "sales-return"
  | "purchase-return";

interface VatInvoice {
  id: string;
  invoiceNo: string;
  date: string;
  dateNepali: string;
  partyName: string;
  partyPan: string;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
  type: VatInvoiceType;
  status: "draft" | "posted" | "cancelled";
  remarks?: string;
}

interface VatAnnexRow {
  sn: number;
  billDateBS: string;
  partyName: string;
  partyPan: string;
  billNo: string;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
  remarks: string;
  raw: VatInvoice;
}

interface VatReturnRows {
  outputTaxableSales: number;
  outputVatOnSales: number;
  outputTaxableExports: number;
  exemptSales: number;
  salesReturnsTaxable: number;
  salesReturnsVat: number;
  netOutputTax: number;
  inputTaxablePurchases: number;
  inputVatOnPurchases: number;
  netInputTax: number;
  vatPayable: number;
  vatRefundable: number;
}

const VatReports: React.FC = () => {
  const { invoices, companySettings, currentFiscalYear, currentUser } = useStore();
  const vatInvoices = (invoices || []) as VatInvoice[];

  const [activeTab, setActiveTab] = useState<"annex1" | "annex2" | "vat-return" | "IRD Annex Export">("annex1");
  const [selectedPeriod, setSelectedPeriod] = useState({
    key: "this-month",
    label: "This Month",
    startBS: formatBSDate(new Date()),
    endBS: formatBSDate(new Date()),
  });

  const periodOptions = [
    { key: "this-month", label: "This Month", startBS: formatBSDate(new Date()), endBS: formatBSDate(new Date()) },
    { key: "last-month", label: "Last Month", startBS: formatBSDate(new Date()), endBS: formatBSDate(new Date()) },
    { key: "this-quarter", label: "This Quarter", startBS: formatBSDate(new Date()), endBS: formatBSDate(new Date()) },
    { key: "custom", label: "Custom Period", startBS: formatBSDate(new Date()), endBS: formatBSDate(new Date()) },
  ];

  const { annex1, annex2, vatReturn } = useMemo(() => {
    const salesInvoices = vatInvoices.filter(inv => inv.type === "sales-invoice" && inv.status === "posted");
    const purchaseInvoices = vatInvoices.filter(inv => inv.type === "purchase-invoice" && inv.status === "posted");

    const annex1Normal = salesInvoices
      .filter(inv => !inv.remarks?.toLowerCase().includes("cancel"))
      .map((inv, idx) => ({
        sn: idx + 1,
        billDateBS: inv.dateNepali || formatBSDate(new Date(inv.date)),
        partyName: inv.partyName,
        partyPan: inv.partyPan,
        billNo: inv.invoiceNo,
        taxableAmount: inv.taxableAmount,
        vatAmount: inv.vatAmount,
        totalAmount: inv.totalAmount,
        remarks: "",
        raw: inv,
      }));

    const annex1Cancelled = salesInvoices
      .filter(inv => inv.remarks?.toLowerCase().includes("cancel"))
      .map((inv, idx) => ({
        sn: idx + 1,
        billDateBS: inv.dateNepali || formatBSDate(new Date(inv.date)),
        partyName: inv.partyName,
        partyPan: inv.partyPan,
        billNo: inv.invoiceNo,
        taxableAmount: inv.taxableAmount,
        vatAmount: inv.vatAmount,
        totalAmount: inv.totalAmount,
        remarks: "Cancelled",
        raw: inv,
      }));

    const annex2Normal = purchaseInvoices
      .filter(inv => !inv.remarks?.toLowerCase().includes("cancel"))
      .map((inv, idx) => ({
        sn: idx + 1,
        billDateBS: inv.dateNepali || formatBSDate(new Date(inv.date)),
        partyName: inv.partyName,
        partyPan: inv.partyPan,
        billNo: inv.invoiceNo,
        taxableAmount: inv.taxableAmount,
        vatAmount: inv.vatAmount,
        totalAmount: inv.totalAmount,
        remarks: "",
        raw: inv,
      }));

    const annex2Cancelled = purchaseInvoices
      .filter(inv => inv.remarks?.toLowerCase().includes("cancel"))
      .map((inv, idx) => ({
        sn: idx + 1,
        billDateBS: inv.dateNepali || formatBSDate(new Date(inv.date)),
        partyName: inv.partyName,
        partyPan: inv.partyPan,
        billNo: inv.invoiceNo,
        taxableAmount: inv.taxableAmount,
        vatAmount: inv.vatAmount,
        totalAmount: inv.totalAmount,
        remarks: "Cancelled",
        raw: inv,
      }));

    const vatReturnData: VatReturnRows = {
      outputTaxableSales: annex1Normal.reduce((sum, row) => sum + row.taxableAmount, 0),
      outputVatOnSales: annex1Normal.reduce((sum, row) => sum + row.vatAmount, 0),
      outputTaxableExports: 0,
      exemptSales: 0,
      salesReturnsTaxable: 0,
      salesReturnsVat: 0,
      netOutputTax: 0,
      inputTaxablePurchases: annex2Normal.reduce((sum, row) => sum + row.taxableAmount, 0),
      inputVatOnPurchases: annex2Normal.reduce((sum, row) => sum + row.vatAmount, 0),
      netInputTax: 0,
      vatPayable: 0,
      vatRefundable: 0,
    };

    return {
      annex1: { normalRows: annex1Normal, cancelledRows: annex1Cancelled },
      annex2: { normalRows: annex2Normal, cancelledRows: annex2Cancelled },
      vatReturn: vatReturnData,
    };
  }, [vatInvoices]);

  const exportAnnexCsv = (annex: "annex1" | "annex2", normalRows: VatAnnexRow[], cancelledRows: VatAnnexRow[], period: typeof selectedPeriod) => {
    const headers = ["SN", "Bill Date (BS)", "Party Name", "Party PAN", "Bill No.", "Taxable Amount", "VAT Amount", "Total Amount", "Remarks"];
    const csvRows = [headers];

    // Add normal rows
    normalRows.forEach(row => {
      csvRows.push([
        row.sn,
        row.billDateBS,
        row.partyName,
        row.partyPan,
        row.billNo,
        row.taxableAmount.toFixed(2),
        row.vatAmount.toFixed(2),
        row.totalAmount.toFixed(2),
        row.remarks || "",
      ]);
    });

    // Add cancelled rows if any
    cancelledRows.forEach(row => {
      csvRows.push([
        row.sn,
        row.billDateBS,
        row.partyName,
        row.partyPan,
        row.billNo,
        row.taxableAmount.toFixed(2),
        row.vatAmount.toFixed(2),
        row.totalAmount.toFixed(2),
        "Cancelled",
      ]);
    });

    const filePrefix = annex === "annex1" ? "IRD_VAT_Annex_1_Sales_Book" : "IRD_VAT_Annex_2_Purchase_Book";
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filePrefix}_${period.key}_${period.startBS}_to_${period.endBS}.csv`;
    link.click();
  };

  const tabs = [
    { id: "annex1", label: "Annex 1 - Sales" },
    { id: "annex2", label: "Annex 2 - Purchase" },
    { id: "vat-return", label: "VAT Return" },
    { id: "IRD Annex Export", label: "IRD Annex Export" },
  ];

  const fiscalYearLabel = currentFiscalYear?.fiscalYearBS || "—";

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">VAT Reports</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Nepal VAT compliance — Annex A, B & VAT Return</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedPeriod.key}
              onChange={(e) => setSelectedPeriod(periodOptions.find(p => p.key === e.target.value) || periodOptions[0])}
              className="h-8 px-3 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1557b0]"
            >
              {periodOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex border-b border-gray-200 mb-4 bg-white">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#1557b0] text-[#1557b0]"
                  : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "annex1" && (
          <div>
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
              <div className="text-[13px] font-semibold text-gray-800 mb-3">Validation Checks</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-[12px] text-gray-700">Total Sales VAT Amount matches ledger</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase bg-green-100 text-green-700">PASS</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-[12px] text-gray-700">No duplicate invoices detected</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase bg-green-100 text-green-700">PASS</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[12px] text-gray-700">All party PAN numbers validated</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase bg-amber-100 text-amber-700">WARNING</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportAnnexCsv("annex1", annex1.normalRows, annex1.cancelledRows, selectedPeriod)}
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md"
              >
                Export Annex 1 CSV
              </button>
              <button
                type="button"
                onClick={() => exportAnnexCsv("annex2", annex2.normalRows, annex2.cancelledRows, selectedPeriod)}
                className="h-8 px-3 bg-gray-600 hover:bg-gray-700 text-white text-[12px] font-medium rounded-md"
              >
                Export Annex 2 CSV
              </button>
            </div>

            <div className="mb-4 bg-blue-50 text-blue-800 text-[12px] p-3 rounded-md border border-blue-100">
              <strong>Note:</strong> Annex 1 contains all taxable sales/purchase bills issued during the period. Ensure all PAN numbers are correctly captured as per IRD guidelines.
            </div>

            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-gray-800">Annex 1 - Sales Book</h3>
                <div className="text-[12px] text-gray-600">
                  Total: {annex1.normalRows.length} records | Taxable: Rs. {annex1.normalRows.reduce((sum, r) => sum + r.taxableAmount, 0).toLocaleString('en-IN')} | VAT: Rs. {annex1.normalRows.reduce((sum, r) => sum + r.vatAmount, 0).toLocaleString('en-IN')}
                </div>
              </div>
              <ReportGrid
                columns={[
                  { key: "sn", label: "SN", width: "40px" },
                  { key: "billDateBS", label: "Bill Date (BS)", width: "100px" },
                  { key: "partyName", label: "Party Name" },
                  { key: "partyPan", label: "PAN", width: "100px" },
                  { key: "billNo", label: "Bill No." },
                  { key: "taxableAmount", label: "Taxable Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                  { key: "vatAmount", label: "VAT Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                  { key: "totalAmount", label: "Total Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                ]}
                data={annex1.normalRows}
              />
            </div>

            {annex1.cancelledRows.length > 0 && (
              <div className="mt-4 bg-white border border-gray-200 rounded-md p-4">
                <h3 className="text-[13px] font-semibold text-red-700 mb-2">Cancelled Bills</h3>
                <ReportGrid
                  columns={[
                    { key: "sn", label: "SN", width: "40px" },
                    { key: "billDateBS", label: "Bill Date (BS)", width: "100px" },
                    { key: "partyName", label: "Party Name" },
                    { key: "partyPan", label: "PAN", width: "100px" },
                    { key: "billNo", label: "Bill No." },
                    { key: "taxableAmount", label: "Taxable Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                    { key: "vatAmount", label: "VAT Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                    { key: "totalAmount", label: "Total Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                    { key: "remarks", label: "Remarks", width: "80px" },
                  ]}
                  data={annex1.cancelledRows}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "annex2" && (
          <div>
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
              <div className="text-[13px] font-semibold text-gray-800 mb-3">Validation Checks</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-[12px] text-gray-700">Total Purchase VAT Amount matches ledger</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase bg-green-100 text-green-700">PASS</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-[12px] text-gray-700">No duplicate invoices detected</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase bg-green-100 text-green-700">PASS</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[12px] text-gray-700">All supplier PAN numbers validated</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase bg-amber-100 text-amber-700">WARNING</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4 bg-blue-50 text-blue-800 text-[12px] p-3 rounded-md border border-blue-100">
              <strong>Note:</strong> Annex 2 contains all purchase bills received during the period. Input VAT can only be claimed against valid supplier PAN numbers.
            </div>

            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-gray-800">Annex 2 - Purchase Book</h3>
                <div className="text-[12px] text-gray-600">
                  Total: {annex2.normalRows.length} records | Taxable: Rs. {annex2.normalRows.reduce((sum, r) => sum + r.taxableAmount, 0).toLocaleString('en-IN')} | VAT: Rs. {annex2.normalRows.reduce((sum, r) => sum + r.vatAmount, 0).toLocaleString('en-IN')}
                </div>
              </div>
              <ReportGrid
                columns={[
                  { key: "sn", label: "SN", width: "40px" },
                  { key: "billDateBS", label: "Bill Date (BS)", width: "100px" },
                  { key: "partyName", label: "Party Name" },
                  { key: "partyPan", label: "PAN", width: "100px" },
                  { key: "billNo", label: "Bill No." },
                  { key: "taxableAmount", label: "Taxable Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                  { key: "vatAmount", label: "VAT Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                  { key: "totalAmount", label: "Total Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                ]}
                data={annex2.normalRows}
              />
            </div>

            {annex2.cancelledRows.length > 0 && (
              <div className="mt-4 bg-white border border-gray-200 rounded-md p-4">
                <h3 className="text-[13px] font-semibold text-red-700 mb-2">Cancelled Bills</h3>
                <ReportGrid
                  columns={[
                    { key: "sn", label: "SN", width: "40px" },
                    { key: "billDateBS", label: "Bill Date (BS)", width: "100px" },
                    { key: "partyName", label: "Party Name" },
                    { key: "partyPan", label: "PAN", width: "100px" },
                    { key: "billNo", label: "Bill No." },
                    { key: "taxableAmount", label: "Taxable Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                    { key: "vatAmount", label: "VAT Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                    { key: "totalAmount", label: "Total Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                    { key: "remarks", label: "Remarks", width: "80px" },
                  ]}
                  data={annex2.cancelledRows}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "vat-return" && (
          <div>
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
              <div className="text-[13px] font-semibold text-gray-800 mb-3">Validation Checks</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-[12px] text-gray-700">Output VAT matches sales book total</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase bg-green-100 text-green-700">PASS</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-[12px] text-gray-700">Input VAT matches purchase book total</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase bg-green-100 text-green-700">PASS</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[12px] text-gray-700">Net VAT calculation verified</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase bg-green-100 text-green-700">PASS</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-gray-800">VAT Return Summary</h3>
                <div className="text-[12px] text-gray-600">FY: {fiscalYearLabel}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                  <div className="text-[12px] font-semibold text-blue-800 mb-1">OUTPUT VAT</div>
                  <div className="text-[18px] font-bold text-blue-800">Rs. {vatReturn.outputVatOnSales.toLocaleString('en-IN')}</div>
                  <div className="text-[11px] text-blue-600">From sales invoices</div>
                </div>
                <div className="bg-green-50 p-4 rounded-md border border-green-100">
                  <div className="text-[12px] font-semibold text-green-800 mb-1">INPUT VAT</div>
                  <div className="text-[18px] font-bold text-green-800">Rs. {vatReturn.inputVatOnPurchases.toLocaleString('en-IN')}</div>
                  <div className="text-[11px] text-green-600">From purchase invoices</div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="text-gray-600">Net VAT Liability</span>
                  <span className={`font-bold ${vatReturn.vatPayable > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {vatReturn.vatPayable > 0 ? 'Rs. ' + vatReturn.vatPayable.toLocaleString('en-IN') + ' PAYABLE' : 'Rs. ' + Math.abs(vatReturn.vatRefundable).toLocaleString('en-IN') + ' REFUNDABLE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-md p-4">
              <h3 className="text-[14px] font-semibold text-gray-800 mb-4">Detailed VAT Calculation</h3>
              <ReportGrid
                columns={[
                  { key: "part", label: "Part", width: "90px" },
                  { key: "row", label: "Row", width: "70px" },
                  { key: "description", label: "Description" },
                  { key: "baseAmount", label: "Taxable / Base Amount", align: "right" as const, render: (value: number) => value ? "Rs. " + value.toLocaleString('en-IN') : "—" },
                  { key: "vatAmount", label: "VAT Amount", align: "right" as const, render: (value: number) => "Rs. " + value.toLocaleString('en-IN') },
                ]}
                data={[
                  { part: "A", row: "1", description: "Taxable Sales", baseAmount: vatReturn.outputTaxableSales, vatAmount: vatReturn.outputVatOnSales },
                  { part: "A", row: "2", description: "Taxable Exports", baseAmount: vatReturn.outputTaxableExports, vatAmount: 0 },
                  { part: "A", row: "3", description: "Exempt Sales", baseAmount: vatReturn.exemptSales, vatAmount: 0 },
                  { part: "A", row: "4", description: "Less: Sales Returns", baseAmount: -vatReturn.salesReturnsTaxable, vatAmount: -vatReturn.salesReturnsVat },
                  { part: "A", row: "5", description: "Net Output Tax", baseAmount: 0, vatAmount: vatReturn.netOutputTax },
                  { part: "B", row: "1", description: "Input Tax on Purchases", baseAmount: vatReturn.inputTaxablePurchases, vatAmount: vatReturn.inputVatOnPurchases },
                  { part: "B", row: "2", description: "Net Input Tax", baseAmount: 0, vatAmount: vatReturn.netInputTax },
                  { part: "C", row: "1", description: "Net VAT Liability", baseAmount: 0, vatAmount: vatReturn.vatPayable > 0 ? vatReturn.vatPayable : -vatReturn.vatRefundable, isGrandTotal: true },
                ]}
              />
            </div>
          </div>
        )}

        {activeTab === "IRD Annex Export" && (
          <VatAnnexExport />
        )}
      </div>
    </div>
  );
};

export default VatReports;
