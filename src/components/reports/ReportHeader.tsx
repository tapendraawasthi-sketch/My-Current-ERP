import React from "react";

interface CompanySettings {
  name: string;
  nameNepali?: string;
  address?: string;
  phone?: string;
  email?: string;
  pan?: string;
}

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  period?: string;
  company: CompanySettings;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({ title, period, company }) => {
  return (
    <div className="text-center mb-4 pb-3 border-b-2 border-gray-300 print-only hidden">
      {/* Centered Company Name */}
      <h1 className="text-[15px] font-bold text-gray-800">{company.name}</h1>

      {/* Address / PAN */}
      <p className="text-[11px] text-gray-600 mt-0.5">
        {[company.address, company.pan ? `PAN: ${company.pan}` : ""].filter(Boolean).join(" | ")}
      </p>

      {/* Report Title */}
      <h2 className="text-[13px] font-bold text-[#1557b0] uppercase mt-2">{title}</h2>

      {/* Period Line */}
      {period && <p className="text-[11px] text-gray-500 mt-0.5">Period: {period}</p>}
    </div>
  );
};
