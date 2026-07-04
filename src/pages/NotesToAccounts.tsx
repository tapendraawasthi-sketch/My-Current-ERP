import React from "react";
import ReportShell from "../components/reporting/ReportShell";

export default function NotesToAccounts() {
  return (
    <ReportShell
      title="Notes to Accounts Builder"
      subtitle="Manage notes for financial statements"
      hasData={false}
    >
      <div className="p-4 text-gray-500 text-sm">
        Notes to Accounts module is under construction.
      </div>
    </ReportShell>
  );
}
