import React from "react";
import { Printer } from "lucide-react";
import { Voucher } from "@/lib/tallyVoucher";
import { formatMoney, formatDate, formatDateBS, amountInWords } from "@/lib/tallyFormat";
import { voucherTypeLabel } from "@/lib/tallyVoucher";

interface Props {
  voucher: Voucher;
  companyName?: string;
  companyAddress?: string;
  onClose?: () => void;
}

export const TallyVoucherPrint: React.FC<Props> = ({
  voucher,
  companyName = "Sutra ERP Pvt. Ltd.",
  companyAddress = "Kathmandu, Nepal",
  onClose,
}) => {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[200] overflow-auto bg-white p-4 tally-print">
      <div className="no-print flex justify-end gap-2 mb-4">
        <button
          className="tally-btn tally-btn-primary flex items-center gap-1"
          onClick={handlePrint}
        >
          <Printer size={14} /> Print
        </button>
        {onClose && (
          <button className="tally-btn" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <div className="mx-auto max-w-[210mm] border border-black p-6 text-sm">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold uppercase">{companyName}</h2>
          <p className="text-xs">{companyAddress}</p>
          <h3 className="text-lg font-bold mt-2 underline">
            {voucherTypeLabel[voucher.voucherType]}
          </h3>
        </div>

        <div className="flex justify-between mb-4">
          <div>
            <p>
              <strong>Voucher No:</strong> {voucher.voucherNumber || "Auto"}
            </p>
            <p>
              <strong>Reference:</strong> {voucher.reference || "-"}
            </p>
          </div>
          <div className="text-right">
            <p>
              <strong>Date (AD):</strong> {formatDate(voucher.date)}
            </p>
            <p>
              <strong>Date (BS):</strong> {formatDateBS(voucher.date)}
            </p>
          </div>
        </div>

        <table className="w-full border border-black border-collapse mb-4">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-1 text-left w-12">S.N.</th>
              <th className="border border-black p-1 text-left">Particulars</th>
              <th className="border border-black p-1 text-right">Debit (Rs.)</th>
              <th className="border border-black p-1 text-right">Credit (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((line, idx) => (
              <tr key={line.id}>
                <td className="border border-black p-1">{idx + 1}</td>
                <td className="border border-black p-1">
                  {line.accountName}
                  {line.narration && (
                    <div className="text-xs italic text-gray-700 ml-4">{line.narration}</div>
                  )}
                </td>
                <td className="border border-black p-1 text-right">
                  {line.debit ? formatMoney(line.debit) : ""}
                </td>
                <td className="border border-black p-1 text-right">
                  {line.credit ? formatMoney(line.credit) : ""}
                </td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="border border-black p-1" colSpan={2}>
                Total
              </td>
              <td className="border border-black p-1 text-right">
                {formatMoney(voucher.totalDebit)}
              </td>
              <td className="border border-black p-1 text-right">
                {formatMoney(voucher.totalCredit)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mb-4">
          <strong>Amount in words:</strong>{" "}
          {amountInWords(voucher.totalDebit || voucher.totalCredit)}
        </div>

        <div className="mb-8">
          <strong>Narration:</strong> {voucher.narration || "-"}
        </div>

        <div className="flex justify-between mt-12">
          <div className="w-40 border-t border-black text-center pt-1">Prepared By</div>
          <div className="w-40 border-t border-black text-center pt-1">Authorized By</div>
        </div>
      </div>
    </div>
  );
};

export default TallyVoucherPrint;
