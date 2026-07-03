import React from "react";
import ReportShell from "../components/reporting/ReportShell";

export default function EmployeeLoans() {
  return (
    <ReportShell
      title="Employee Loans & Advances"
      subtitle="Track active loans and salary advances"
      hasData={false}
    >
      <div className="p-4 text-gray-500 text-sm">Employee Loans module is under construction.</div>
    </ReportShell>
  );
}
