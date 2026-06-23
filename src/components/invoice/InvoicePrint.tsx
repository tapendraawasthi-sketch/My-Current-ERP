import React from "react";
import { X, Printer, Download } from "lucide-react";

interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  dueDate?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxable: number;
  vat: number;
  total: number;
  paymentMode?: string;
  notes?: string;
}

interface InvoiceItem {
  id: string;
  name: string;
  hsn?: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  taxable: number;
  vat: number;
  total: number;
}

interface CompanySettings {
  companyNameEn: string;
  companyNameNe?: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  panNumber: string;
  vatNumber?: string;
  logo?: string;
  printBankDetails?: boolean;
  termsConditions?: string;
  invoiceFooter?: string;
  signatoryName?: string;
}

interface Party {
  name: string;
  address?: string;
  phone?: string;
  pan?: string;
}

interface Props {
  invoice: Invoice;
  company: CompanySettings;
  party: Party;
  printMode?: "A4" | "thermal";
  onClose?: () => void;
}

export default function InvoicePrint({
  invoice,
  company,
  party,
  printMode = "A4",
  onClose,
}: Props) {
  const handlePrint = () => {
    window.print();
  };

  const numberToWords = (num: number): string => {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    const teens = [
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];

    if (num === 0) return "Zero";

    const convertLessThanThousand = (n: number): string => {
      if (n === 0) return "";
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
      return (
        ones[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 !== 0 ? " " + convertLessThanThousand(n % 100) : "")
      );
    };

    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const remainder = num % 1000;

    let words = "";
    if (crore > 0) words += convertLessThanThousand(crore) + " Crore ";
    if (lakh > 0) words += convertLessThanThousand(lakh) + " Lakh ";
    if (thousand > 0) words += convertLessThanThousand(thousand) + " Thousand ";
    if (remainder > 0) words += convertLessThanThousand(remainder);

    return words.trim() + " Rupees Only";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4 print:p-0 print:relative print:bg-white print:block">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl overflow-hidden flex flex-col my-4 print:my-0 print:shadow-none print:rounded-none border border-gray-200 print:border-0">
        {/* On-screen Controls (Hidden in Print) */}
        <div className="no-print flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-250 select-none">
          <div>
            <h2 className="text-[13px] font-bold text-gray-800">Print Preview ({printMode})</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="h-8 w-8 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 bg-white print:p-0 text-gray-800 select-text overflow-x-auto print:overflow-visible">
          <div className="min-w-[650px] print:min-w-0">
            {/* Professional Company Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
              <div className="flex items-start gap-4">
                {company.logo && (
                  <img
                    src={company.logo}
                    alt="Company Logo"
                    className="w-16 h-16 object-contain shrink-0"
                  />
                )}
                <div>
                  <h1 className="text-[18px] font-bold text-gray-900 leading-tight uppercase">
                    {company.companyNameEn}
                  </h1>
                  {company.companyNameNe && (
                    <h2 className="text-[14px] text-gray-700 font-semibold mt-0.5 font-nepali">
                      {company.companyNameNe}
                    </h2>
                  )}
                  <p className="text-[11px] text-gray-600 mt-1">
                    {company.address}, {company.city}
                  </p>
                  <p className="text-[11px] text-gray-600">
                    Phone: {company.phone} | Email: {company.email}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-[#1557b0]/5 border border-[#1557b0]/20 rounded-md p-2 text-right">
                  <p className="text-[11px] font-semibold text-gray-600">PAN / VAT NO.</p>
                  <p className="text-[15px] font-mono font-bold text-[#1557b0]">
                    {company.panNumber}
                  </p>
                </div>
              </div>
            </div>

            {/* TAX INVOICE Title Strip */}
            <div className="text-center bg-gray-100 border border-gray-250 py-1.5 mb-5 rounded">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-gray-800">
                TAX INVOICE
              </h2>
            </div>

            {/* Two-Column Details Layout */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="border border-gray-200 rounded p-3 bg-gray-50/50">
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1.5">
                  Buyer / Billed To:
                </p>
                <p className="text-[12px] font-bold text-gray-900">{party.name}</p>
                {party.address && (
                  <p className="text-[11px] text-gray-600 mt-0.5">{party.address}</p>
                )}
                {party.phone && <p className="text-[11px] text-gray-600">Phone: {party.phone}</p>}
                {party.pan && (
                  <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-gray-150">
                    <span className="text-[10px] font-semibold text-gray-500">BUYER'S PAN:</span>
                    <span className="text-[11px] font-mono font-bold text-gray-800">
                      {party.pan}
                    </span>
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded p-3 bg-gray-50/50 flex flex-col justify-between">
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Invoice Number:</span>
                    <span className="font-mono font-bold text-gray-900">{invoice.invoiceNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Invoice Date:</span>
                    <span className="font-medium text-gray-850">
                      {new Date(invoice.date).toLocaleDateString()}
                    </span>
                  </div>
                  {invoice.dueDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Due Date:</span>
                      <span className="font-medium text-gray-850">
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {invoice.paymentMode && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Payment Mode:</span>
                      <span className="font-semibold text-[#15803d] uppercase">
                        {invoice.paymentMode}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse border border-gray-300 text-[11px] mb-6">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="border border-gray-300 p-2 text-center w-[30px] font-bold text-gray-700 uppercase">
                    S.N.
                  </th>
                  <th className="border border-gray-300 p-2 text-left font-bold text-gray-700 uppercase">
                    Product Description
                  </th>
                  <th className="border border-gray-300 p-2 text-center w-[60px] font-bold text-gray-700 uppercase">
                    HSN
                  </th>
                  <th className="border border-gray-300 p-2 text-right w-[60px] font-bold text-gray-700 uppercase">
                    Qty
                  </th>
                  <th className="border border-gray-300 p-2 text-center w-[50px] font-bold text-gray-700 uppercase">
                    Unit
                  </th>
                  <th className="border border-gray-300 p-2 text-right w-[80px] font-bold text-gray-700 uppercase">
                    Rate
                  </th>
                  <th className="border border-gray-300 p-2 text-right w-[70px] font-bold text-gray-700 uppercase">
                    Disc
                  </th>
                  <th className="border border-gray-300 p-2 text-right w-[90px] font-bold text-gray-700 uppercase">
                    Taxable Amt
                  </th>
                  <th className="border border-gray-300 p-2 text-right w-[70px] font-bold text-gray-700 uppercase">
                    VAT
                  </th>
                  <th className="border border-gray-300 p-2 text-right w-[100px] font-bold text-gray-700 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="border border-gray-300 p-2 text-center font-mono">
                      {index + 1}
                    </td>
                    <td className="border border-gray-300 p-2 font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="border border-gray-300 p-2 text-center font-mono text-gray-500">
                      {item.hsn || "-"}
                    </td>
                    <td className="border border-gray-300 p-2 text-right font-mono">
                      {item.quantity}
                    </td>
                    <td className="border border-gray-300 p-2 text-center text-gray-600">
                      {item.unit}
                    </td>
                    <td className="border border-gray-300 p-2 text-right font-mono">
                      {item.rate.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 p-2 text-right font-mono text-gray-500">
                      {item.discount.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 p-2 text-right font-mono">
                      {item.taxable.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 p-2 text-right font-mono text-gray-500">
                      {item.vat.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 p-2 text-right font-mono font-bold text-gray-900">
                      {item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Bottom Section: Terms vs. Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Left Side: Remarks & Conditions */}
              <div className="space-y-4">
                {/* Amount in Words */}
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded text-[11px]">
                  <p className="text-gray-500 uppercase tracking-wider font-bold text-[9px] mb-0.5">
                    Amount in Words:
                  </p>
                  <p className="italic font-semibold text-gray-800">
                    {numberToWords(Math.floor(invoice.total))}
                  </p>
                </div>

                {/* Bank Details */}
                {company.printBankDetails && (
                  <div className="p-2.5 border border-gray-200 rounded text-[11px] bg-white">
                    <p className="text-gray-500 uppercase tracking-wider font-bold text-[9px] mb-1">
                      Bank Payment Details:
                    </p>
                    <div className="grid grid-cols-3 gap-1">
                      <span className="text-gray-500">Bank:</span>
                      <span className="col-span-2 font-medium text-gray-800">Nepal Bank Ltd.</span>
                      <span className="text-gray-500">Account:</span>
                      <span className="col-span-2 font-mono font-bold text-gray-800">
                        00123456789
                      </span>
                      <span className="text-gray-500">Branch:</span>
                      <span className="col-span-2 font-medium text-gray-800">Kathmandu</span>
                    </div>
                  </div>
                )}

                {/* Terms */}
                {company.termsConditions && (
                  <div className="text-[10px] text-gray-650">
                    <p className="font-bold text-gray-700 uppercase tracking-wider text-[9px] mb-1">
                      Terms & Conditions:
                    </p>
                    <p className="whitespace-pre-line leading-relaxed">{company.termsConditions}</p>
                  </div>
                )}
              </div>

              {/* Right Side: Totals Summary */}
              <div className="flex justify-end items-start">
                <div className="w-full max-w-sm border border-gray-250 rounded overflow-hidden">
                  <div className="p-2.5 space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-mono font-semibold">
                        Rs. {invoice.subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-650">Discount:</span>
                      <span className="font-mono text-gray-700">
                        (-) Rs. {invoice.discount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-150">
                      <span className="text-gray-600">Taxable Value:</span>
                      <span className="font-mono font-bold text-gray-900">
                        Rs. {invoice.taxable.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">VAT (13%):</span>
                      <span className="font-mono">Rs. {invoice.vat.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="bg-[#1557b0] text-white px-3 py-2 flex justify-between items-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      Grand Total:
                    </span>
                    <span className="font-mono text-[14px] font-bold">
                      Rs. {invoice.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Section */}
            <div className="grid grid-cols-3 gap-8 mt-12 mb-6 text-center text-[10px] text-gray-500">
              <div className="flex flex-col items-center">
                <div className="w-32 border-b border-gray-300 h-10 mb-1"></div>
                <p>Prepared By</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-32 border-b border-gray-300 h-10 mb-1"></div>
                <p>Checked By</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-32 border-b border-gray-350 h-10 mb-1"></div>
                <p className="font-bold text-gray-700">Authorized Signatory</p>
              </div>
            </div>

            {/* Print Footer */}
            <div className="border-t border-gray-300 pt-3 text-center text-[10px] text-gray-500 space-y-0.5 mt-8">
              <p>Thank you for your business!</p>
              <p className="italic">
                This is a system generated tax invoice. No physical signature is required.
              </p>
              {company.invoiceFooter && (
                <p className="font-semibold text-gray-600 mt-1">{company.invoiceFooter}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print CSS Override */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .fixed {
            position: relative !important;
            background: transparent !important;
            padding: 0 !important;
            inset: auto !important;
            display: block !important;
            overflow: visible !important;
          }
          .bg-white {
            background-color: white !important;
          }
          @page {
            size: A4;
            margin: 1.5cm 1cm;
          }
        }
      `}</style>
    </div>
  );
}
