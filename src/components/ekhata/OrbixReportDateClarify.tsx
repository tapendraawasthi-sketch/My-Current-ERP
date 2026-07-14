import React, { useState } from "react";
import { Calendar, ChevronRight } from "lucide-react";
import type { PendingOrbixReport } from "@/lib/ekhata/orbixReportTypes";

interface OrbixReportDateClarifyProps {
  pending: PendingOrbixReport;
  parties: { id: string; name: string }[];
  disabled?: boolean;
  onSubmit: (pending: PendingOrbixReport) => void;
}

const OrbixReportDateClarify: React.FC<OrbixReportDateClarifyProps> = ({
  pending,
  parties,
  disabled,
  onSubmit,
}) => {
  const [fromDate, setFromDate] = useState(pending.fromDate || "");
  const [toDate, setToDate] = useState(pending.toDate || "");
  const [partyName, setPartyName] = useState(pending.partyName || "");

  const needsParty = pending.kind === "party_ledger";

  return (
    <div className="mt-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <Calendar className="h-3.5 w-3.5 text-cyan-400" />
        <p className="text-[12px] font-semibold uppercase tracking-wide text-cyan-300/80">
          Select date range
        </p>
      </div>

      {needsParty && (
        <div className="mb-2">
          <label className="text-[12px] text-slate-500 mb-1 block">Party</label>
          <select
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            className="w-full h-8 rounded-md border border-white/10 bg-white/5 px-2 text-[12px] text-slate-200 focus:border-cyan-500/40 focus:outline-none"
          >
            <option value="">— Select party —</option>
            {parties.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[12px] text-slate-500 mb-1 block">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full h-8 rounded-md border border-white/10 bg-white/5 px-2 text-[12px] text-slate-200 focus:border-cyan-500/40 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[12px] text-slate-500 mb-1 block">
            {pending.kind === "balance_sheet" ? "As at" : "To"}
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full h-8 rounded-md border border-white/10 bg-white/5 px-2 text-[12px] text-slate-200 focus:border-cyan-500/40 focus:outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={disabled || !fromDate || !toDate || (needsParty && !partyName)}
        onClick={() =>
          onSubmit({
            ...pending,
            fromDate,
            toDate,
            partyName: needsParty ? partyName : pending.partyName,
          })
        }
        className="mt-2.5 w-full h-8 rounded-md bg-gradient-to-r from-cyan-600 to-blue-600 text-[12px] font-medium text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 flex items-center justify-center gap-1.5"
      >
        Generate report
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default OrbixReportDateClarify;
