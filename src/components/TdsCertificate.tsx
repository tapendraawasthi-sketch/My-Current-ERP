import React from "react";
import { getNepalTdsRate } from "../lib/tdsNepal";

interface TdsCertificatePayment {
  id: string;
  date: string;
  dateNepali: string;
  voucherNo: string;
  tdsSection: string;
  grossAmount: number;
  tdsRate: number;
  tdsAmount: number;
}

interface PartyInfo {
  name: string;
  pan?: string;
  address?: string;
}

interface CompanyInfo {
  name: string;
  nameNepali?: string;
  panNumber?: string;
  address?: string;
}

interface TdsCertificateProps {
  company: CompanyInfo;
  deductee: PartyInfo;
  payments: TdsCertificatePayment[];
  fiscalYearBS: string;
  authorizedPersonName: string;
  authorizedPersonDesignation: string;
  certificateDateBS: string;
}

import { formatMoney } from "@/lib/currency";

function money(value: number): string {
  return formatMoney(value);
}

const TdsCertificate: React.FC<TdsCertificateProps> = ({
  company,
  deductee,
  payments,
  fiscalYearBS,
  authorizedPersonName,
  authorizedPersonDesignation,
  certificateDateBS,
}) => {
  const totalGross = payments.reduce((sum, p) => sum + (p.grossAmount || 0), 0);
  const totalTds = payments.reduce((sum, p) => sum + (p.tdsAmount || 0), 0);

  return (
    <div className="bg-white text-black p-4">
      <div className="no-print flex justify-end mb-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md"
        >
          Print Certificate
        </button>
      </div>

      <div className="tds-certificate mx-auto bg-white border border-black p-8 max-w-[210mm] min-h-[297mm]">
        <div className="text-center border-b border-black pb-4 mb-4">
          <h1 className="text-[18px] font-bold">Certificate of Tax Deduction at Source</h1>
          <h2 className="text-[17px] font-bold mt-1">स्रोतमा कर कट्टी प्रमाण-पत्र</h2>
          <p className="text-[12px] mt-2">
            Fiscal Year / आर्थिक वर्ष: <strong>{fiscalYearBS}</strong>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 text-[12px] mb-5">
          <div className="border border-black p-3">
            <h3 className="font-bold text-[13px] mb-2">
              Deductor Details / कर कट्टी गर्नेको विवरण
            </h3>
            <p>
              <strong>Name:</strong> {company.name}
            </p>
            {company.nameNepali && (
              <p>
                <strong>नाम:</strong> {company.nameNepali}
              </p>
            )}
            <p>
              <strong>PAN:</strong> {company.panNumber || "—"}
            </p>
            <p>
              <strong>Address:</strong> {company.address || "—"}
            </p>
          </div>

          <div className="border border-black p-3">
            <h3 className="font-bold text-[13px] mb-2">Deductee Details / कर कट्टी हुनेको विवरण</h3>
            <p>
              <strong>Name:</strong> {deductee.name}
            </p>
            <p>
              <strong>PAN:</strong> {deductee.pan || "—"}
            </p>
            <p>
              <strong>Address:</strong> {deductee.address || "—"}
            </p>
          </div>
        </div>

        <table className="w-full border-collapse text-[11px] mb-5">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1">S.N.</th>
              <th className="border border-black px-2 py-1">Date (BS)</th>
              <th className="border border-black px-2 py-1">Voucher No.</th>
              <th className="border border-black px-2 py-1">Nature of Payment</th>
              <th className="border border-black px-2 py-1 text-right">Gross Amount</th>
              <th className="border border-black px-2 py-1 text-right">TDS Rate</th>
              <th className="border border-black px-2 py-1 text-right">TDS Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment, index) => {
              const section = getNepalTdsRate(payment.tdsSection);
              return (
                <tr key={payment.id}>
                  <td className="border border-black px-2 py-1 text-center">{index + 1}</td>
                  <td className="border border-black px-2 py-1">{payment.dateNepali}</td>
                  <td className="border border-black px-2 py-1">{payment.voucherNo}</td>
                  <td className="border border-black px-2 py-1">
                    {section
                      ? `${section.sectionCode} - ${section.description}`
                      : payment.tdsSection}
                  </td>
                  <td className="border border-black px-2 py-1 text-right">
                    {money(payment.grossAmount)}
                  </td>
                  <td className="border border-black px-2 py-1 text-right">{payment.tdsRate}%</td>
                  <td className="border border-black px-2 py-1 text-right">
                    {money(payment.tdsAmount)}
                  </td>
                </tr>
              );
            })}

            <tr>
              <td className="border border-black px-2 py-1 font-bold text-right" colSpan={4}>
                Total
              </td>
              <td className="border border-black px-2 py-1 font-bold text-right">
                {money(totalGross)}
              </td>
              <td className="border border-black px-2 py-1" />
              <td className="border border-black px-2 py-1 font-bold text-right">
                {money(totalTds)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-[12px] leading-6 mb-10">
          This is to certify that tax deducted at source amounting to{" "}
          <strong>Rs. {money(totalTds)}</strong> has been deducted from payments made to the
          deductee during the fiscal year <strong>{fiscalYearBS}</strong>.
        </div>

        <div className="grid grid-cols-2 gap-10 text-[12px] mt-16">
          <div>
            <div className="border-t border-black pt-2">
              <p>
                <strong>Authorized Person:</strong> {authorizedPersonName}
              </p>
              <p>
                <strong>Designation:</strong> {authorizedPersonDesignation}
              </p>
              <p>
                <strong>Date:</strong> {certificateDateBS}
              </p>
            </div>
          </div>

          <div>
            <div className="border-t border-black pt-2">
              <p>
                <strong>Signature & Seal</strong>
              </p>
              <p>हस्ताक्षर तथा छाप</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            background: white !important;
          }

          .tds-certificate {
            border: none !important;
            box-shadow: none !important;
            width: 210mm;
            min-height: 297mm;
            padding: 12mm;
          }

          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
};

export default TdsCertificate;
