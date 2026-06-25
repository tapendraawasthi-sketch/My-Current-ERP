import React, { useState } from "react";
import { AuditAction } from "@/types";
import { useAccountingStore } from "@/store/accountingStore";
import { today } from "@/utils/accounting";

export function PeriodLockSettings() {
  const { fiscalYears, periodLocks, setPeriodLock, auditLogs, currentUserId } = useAccountingStore();

  const activeFY = fiscalYears.find((fy) => fy.isActive);
  const activeLock = periodLocks.find((pl) => pl.fiscalYearId === activeFY?.id);

  const [hardLockDate, setHardLockDate] = useState(activeLock?.hardLockDate || "");
  const [softLockDate, setSoftLockDate] = useState(activeLock?.softLockDate || "");
  const [softLockPassword, setSoftLockPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitMsg, setSubmitMsg] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSave = () => {
    setError("");
    if (hardLockDate && softLockDate && hardLockDate > softLockDate) return setError("Hard lock date cannot be later than soft lock date.");
    if (softLockPassword && softLockPassword !== confirmPassword) return setError("Passwords do not match.");
    if (!activeFY) return setError("No active fiscal year found.");

    setPeriodLock({ hardLockDate: hardLockDate || undefined, softLockDate: softLockDate || undefined, softLockPassword: softLockPassword || undefined, fiscalYearId: activeFY.id, createdBy: currentUserId });
    setSubmitMsg("✓ Period lock settings saved.");
    setTimeout(() => setSubmitMsg(""), 3000);
  };

  const lockAuditLogs = auditLogs.filter((log) => log.action === AuditAction.LOCK || log.action === AuditAction.UNLOCK).slice(0, 10);

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <h1 className="text-[15px] font-semibold text-gray-800">Period Lock Settings</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Control which accounting periods are open for posting</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 shadow-sm">
            <div className="bg-[#f5f6fa] border-b border-gray-200 px-6 py-3">
              <h2 className="text-[12px] font-semibold text-gray-700 uppercase tracking-wide">Lock Configuration — {activeFY?.name || "No Active FY"}</h2>
            </div>
            <div className="px-6 py-4 space-y-6">
              <div className="border border-red-200 p-4 bg-red-50">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-xl mt-0.5">🔒</div>
                  <div>
                    <h3 className="text-[12px] font-semibold text-red-800">Hard Lock Date</h3>
                    <p className="text-[11px] text-red-600 mt-0.5">All journal entries dated on or before this date are permanently rejected. No override is possible.</p>
                  </div>
                </div>
                <input type="date" value={hardLockDate} onChange={(e) => setHardLockDate(e.target.value)} max={activeFY?.endDate} className="w-full h-8 px-2.5 text-[12px] border border-red-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-red-400" />
                {hardLockDate && <div className="mt-2 text-[11px] text-red-700 bg-red-100 border border-red-200 px-2 py-1 rounded">⚠ Locked up to <strong>{hardLockDate}</strong>.</div>}
                {hardLockDate && <button onClick={() => setHardLockDate("")} className="mt-2 text-[11px] font-medium text-red-600 hover:underline">Clear hard lock</button>}
              </div>

              <div className="border border-amber-200 p-4 bg-amber-50">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-xl mt-0.5">🔑</div>
                  <div>
                    <h3 className="text-[12px] font-semibold text-amber-800">Soft Lock Date</h3>
                    <p className="text-[11px] text-amber-700 mt-0.5">Entries before this date require an override password.</p>
                  </div>
                </div>
                <input type="date" value={softLockDate} onChange={(e) => setSoftLockDate(e.target.value)} max={activeFY?.endDate} className="w-full h-8 px-2.5 text-[12px] border border-amber-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3" />
                
                <div className="space-y-2">
                  <label className="block text-[11px] font-medium text-amber-800">Override Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={softLockPassword} onChange={(e) => setSoftLockPassword(e.target.value)} placeholder="Set override password" className="w-full h-8 px-2.5 text-[12px] pr-10 border border-amber-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2 text-amber-700 text-[10px] font-semibold uppercase">{showPassword ? "Hide" : "Show"}</button>
                  </div>
                  <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm override password" className="w-full h-8 px-2.5 text-[12px] border border-amber-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                {softLockDate && <button onClick={() => { setSoftLockDate(""); setSoftLockPassword(""); }} className="mt-2 text-[11px] font-medium text-amber-700 hover:underline">Clear soft lock</button>}
              </div>

              {error && <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}
              {submitMsg && <div className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-2 text-center">{submitMsg}</div>}

              <button onClick={handleSave} className="w-full h-8 text-[12px] font-medium bg-[#1557b0] hover:bg-[#0f4a96] text-white rounded-md">Save Period Lock Settings</button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <h2 className="text-[12px] font-semibold text-gray-700 uppercase tracking-wide mb-3">Current Period Status</h2>
              <div className="space-y-0">
                {[
                  { label: "Fiscal Year", value: activeFY?.name || "None", icon: "📅" },
                  { label: "FY Start", value: activeFY?.startDate || "—", icon: "🏁" },
                  { label: "FY End", value: activeFY?.endDate || "—", icon: "🏁" },
                  { label: "Hard Lock Up To", value: activeLock?.hardLockDate || "Not set", icon: "🔒", color: activeLock?.hardLockDate ? "text-red-700" : "text-gray-500" },
                  { label: "Soft Lock Up To", value: activeLock?.softLockDate || "Not set", icon: "🔑", color: activeLock?.softLockDate ? "text-amber-700" : "text-gray-500" },
                  { label: "Today", value: today(), icon: "📆", color: "text-[#1557b0]" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <span className="text-[11px] text-gray-600 flex items-center gap-1.5"><span className="text-[12px]">{item.icon}</span> {item.label}</span>
                    <span className={`text-[12px] font-semibold ${item.color || "text-gray-800"}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 shadow-sm p-4">
              <h2 className="text-[12px] font-semibold text-gray-700 uppercase tracking-wide mb-3">Test Period Status</h2>
              <PeriodTester activeLock={activeLock} />
            </div>

            <div className="bg-white border border-gray-200 shadow-sm">
              <div className="bg-[#f5f6fa] border-b border-gray-200 px-4 py-2">
                <h2 className="text-[12px] font-semibold text-gray-700 uppercase tracking-wide">Lock Audit History</h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {lockAuditLogs.length === 0 ? <div className="text-center py-4 text-gray-500 text-[11px]">No lock events recorded.</div> : lockAuditLogs.map((log) => (
                  <div key={log.id} className="px-4 py-2">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-700">{log.action}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{new Date(log.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[11px] text-gray-600">By: <span className="font-medium text-gray-800">{log.userName || log.userId}</span></div>
                    {log.afterState && (
                      <div className="text-[10px] text-gray-500 mt-0.5 font-mono">
                        Hard: {(log.afterState.hardLockDate as string) || "—"} | Soft: {(log.afterState.softLockDate as string) || "—"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PeriodTester({ activeLock }: { activeLock: { hardLockDate?: string; softLockDate?: string } | undefined }) {
  const [testDate, setTestDate] = useState(today());
  const check = (() => {
    if (!activeLock) return { locked: false, type: null as null, message: "No lock configured — all periods open." };
    if (activeLock.hardLockDate && testDate <= activeLock.hardLockDate) return { locked: true, type: "hard" as const, message: `🔒 Hard locked. No entries allowed.` };
    if (activeLock.softLockDate && testDate <= activeLock.softLockDate) return { locked: true, type: "soft" as const, message: `🔑 Soft locked. Override password required.` };
    return { locked: false, type: null as null, message: "✅ Open — posting is allowed." };
  })();

  return (
    <div>
      <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] mb-2" />
      <div className={`text-[11px] font-medium px-3 py-2 border ${!check.locked ? "bg-green-50 text-green-700 border-green-200" : check.type === "hard" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
        {check.message}
      </div>
    </div>
  );
}
