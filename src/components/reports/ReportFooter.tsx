// @ts-nocheck
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
    <div className="mt-8 pt-2 border-t border-[#9DC07A] flex items-center justify-between text-[10px] text-[#000000] print-only hidden">
      <div>Printed on: {timestamp}</div>
      <div>{companyName} — Powered by Sutra ERP</div>
      <div>Page 1</div>
    </div>
  );
};

