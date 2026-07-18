import React from "react";
import { X, Printer, Download } from "lucide-react";

interface Voucher {
  id: string;
  voucherNo: string;
  voucherType: "Payment" | "Receipt" | "Journal" | "Contra";
  date: string;
  entries: VoucherEntry[];
  narration: string;
  totalDebit: number;
  totalCredit: number;
}

interface VoucherEntry {
  id: string;
  ledger: string;
  debit: number;
  credit: number;
}

interface CompanySettings {
  companyNameEn: string;
  companyNameNe?: string;
  address: string;
  city: string;
  phone: string;
  panNumber: string;
  logo?: string;
  signatoryName?: string;
}

interface Props {
  voucher: Voucher;
  company: CompanySettings;
  onClose?: () => void;
}

export default function VoucherPrint({ voucher, company, onClose }: Props) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:relative print:bg-white">
      <div className="bg-white w-full max-w-4xl max-h-[95vh] overflow-auto print:max-w-none print:max-h-none print:overflow-visible">
        {/* Non-print controls */}
        <div className="flex justify-between items-center p-4 border-b print:hidden">
          <h2 className="text-xl font-bold">Voucher Preview</h2>
          <div className="flex space-x-2">
            <button onClick={handlePrint} className="btn-primary flex items-center space-x-2">
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button onClick={handleDownloadPDF} className="btn-primary flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            {onClose && (
              <button onClick={onClose} className="text-[#000000] hover:text-[#000000]">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Printable content */}
        <div className="p-8 print:p-12">
          {/* Header Section */}
          <div className="flex items-start justify-between mb-6">
            <div className="w-20">
              {company.logo && (
                <img src={company.logo} alt="Company Logo" className="w-full h-auto" />
              )}
            </div>
            <div className="text-center flex-1 mx-8">
              <h1 className="text-2xl font-bold text-[#000000]">{company.companyNameEn}</h1>
              {company.companyNameNe && (
                <h2 className="text-lg text-[#000000] mb-2">{company.companyNameNe}</h2>
              )}
              <p className="text-sm text-[#000000]">
                {company.address}, {company.city}
              </p>
              <p className="text-sm text-[#000000]">
                Phone: {company.phone} | PAN: {company.panNumber}
              </p>
            </div>
            <div className="text-right">
              <div className="border-2 border-[var(--ds-border-default)] px-4 py-2">
                <h3 className="text-lg font-bold">{voucher.voucherType.toUpperCase()}</h3>
                <p className="text-xs">VOUCHER</p>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-[var(--ds-border-default)] mb-4"></div>

          {/* Voucher Details */}
          <div className="flex justify-between mb-6">
            <div>
              <p className="text-sm">
                <span className="font-semibold">Voucher No: </span>
                <span className="text-[15px] font-bold text-[var(--ds-action-primary)]">{voucher.voucherNo}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm">
                <span className="font-semibold">Date: </span>
                <span className="text-[#000000]">
                  {new Date(voucher.date).toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>

          {/* Entries Table */}
          <table className="w-full mb-6 border border-[var(--ds-border-default)]">
            <thead className="bg-[#f5f6fa] border-b border-[var(--ds-border-default)]">
              <tr>
                <th className="border border-[var(--ds-border-default)] px-4 py-2 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">
                  S.N.
                </th>
                <th className="border border-[var(--ds-border-default)] px-4 py-2 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">
                  Ledger Account
                </th>
                <th className="border border-[var(--ds-border-default)] px-4 py-2 text-right text-[10px] font-semibold text-[var(--ds-action-primary)] uppercase">
                  Debit
                </th>
                <th className="border border-[var(--ds-border-default)] px-4 py-2 text-right text-[10px] font-semibold text-red-600 uppercase">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {voucher.entries.map((entry, index) => (
                <tr key={entry.id}>
                  <td className="border border-[var(--ds-border-default)] px-4 py-2 text-[12px]">{index + 1}</td>
                  <td className="border border-[var(--ds-border-default)] px-4 py-2 text-[12px]">{entry.ledger}</td>
                  <td className="border border-[var(--ds-border-default)] px-4 py-2 text-right font-mono text-[12px]">
                    {entry.debit > 0 ? entry.debit.toFixed(2) : "-"}
                  </td>
                  <td className="border border-[var(--ds-border-default)] px-4 py-2 text-right font-mono text-[12px]">
                    {entry.credit > 0 ? entry.credit.toFixed(2) : "-"}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe]">
                <td
                  colSpan={2}
                  className="border border-[var(--ds-border-default)] px-4 py-2 text-right text-[12px] font-semibold text-[#000000] uppercase tracking-wide"
                >
                  TOTAL:
                </td>
                <td className="border border-[var(--ds-border-default)] px-4 py-2 text-right font-mono text-[12px]">
                  Rs. {voucher.totalDebit.toFixed(2)}
                </td>
                <td className="border border-[var(--ds-border-default)] px-4 py-2 text-right font-mono text-[12px]">
                  Rs. {voucher.totalCredit.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Narration */}
          <div className="mb-6">
            <p className="text-sm">
              <span className="font-semibold">Narration: </span>
              <span className="text-[#000000]">
                {voucher.narration || "Being the payment made"}
              </span>
            </p>
          </div>

          {/* Amount in Words */}
          <div className="mb-8 p-3 bg-[var(--ds-surface-muted)] border border-[var(--ds-border-default)]">
            <p className="text-sm">
              <span className="font-semibold">Amount in Words: </span>
              <span className="italic">{numberToWords(Math.floor(voucher.totalDebit))}</span>
            </p>
          </div>

          {/* Stamp Box */}
          <div className="mb-8">
            <div className="border-2 border-dashed border-[var(--ds-border-default)] p-6 text-center">
              <p className="text-xs text-[#000000]">STAMP BOX</p>
            </div>
          </div>

          {/* Signature Boxes */}
          <div className="grid grid-cols-4 gap-6 mt-16">
            <div className="text-center">
              <div className="border-t border-[var(--ds-border-default)] pt-2">
                <p className="text-sm font-semibold">Prepared By</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-[var(--ds-border-default)] pt-2">
                <p className="text-sm font-semibold">Checked By</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-[var(--ds-border-default)] pt-2">
                <p className="text-sm font-semibold">Approved By</p>
                {company.signatoryName && (
                  <p className="text-xs text-[#000000]">{company.signatoryName}</p>
                )}
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-[var(--ds-border-default)] pt-2">
                <p className="text-sm font-semibold">Received By</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-[var(--ds-border-default)] pt-4 text-center mt-8">
            <p className="text-xs text-[#000000]">Fiscal Year: 2083/84</p>
            <p className="text-xs text-[#000000] italic mt-1">
              This is a computer generated voucher
            </p>
          </div>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:relative,
          .print\\:relative * {
            visibility: visible;
          }
          .print\\:relative {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4;
            margin: 0.5cm;
          }
        }
      `}</style>
    </div>
  );
}
