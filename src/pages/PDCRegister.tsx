import React from "react";
import ReportShell from "../components/reporting/ReportShell";

export default function PDCRegister() {
  return (
    <ReportShell
      title="Post Dated Cheques Register"
      subtitle="Track PDCs received and issued"
      hasData={false}
    >
      <div className="p-4 text-gray-500 text-sm">PDC Register module is under construction.</div>
    </ReportShell>
  );
}
