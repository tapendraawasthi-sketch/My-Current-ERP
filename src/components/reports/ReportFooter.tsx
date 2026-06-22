import React from "react";

interface ReportFooterProps {
  generatedBy?: string;
  generatedAt?: string;
  note?: string;
}

export const ReportFooter: React.FC<ReportFooterProps> = ({
  companyName = "Your Company",
  generatedAt,
}) => {
  const timestamp = generatedAt || new Date().toLocaleString();

  return (
    <div className="mt-8 pt-2 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-400 print-only hidden">
      <div>Printed on: {timestamp}</div>
      <div>{companyName} — Powered by Sutra ERP</div>
      <div>Page 1</div>
    </div>
  );
};
