import React, { useEffect, useState } from "react";
import { Lock, Unlock, Calendar, AlertTriangle, CheckCircle, Shield } from "lucide-react";
import {
  savePeriodLock,
  getPeriodLocks,
  unlockPeriod,
  type PeriodLock,
} from "@/lib/periodLock";
import { useStore } from "@/store/useStore";

const NEPALI_MONTHS = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

function generateBSMonths(fiscalYear: string): string[] {
  const startYear = Number.parseInt(String(fiscalYear).split("-")[0], 10) || 2081;
  const nextYear = startYear + 1;

  return [
    `${startYear}-04`,
    `${startYear}-05`,
    `${startYear}-06`,
    `${startYear}-07`,
    `${startYear}-08`,
    `${startYear}-09`,
    `${startYear}-10`,
    `${startYear}-11`,
    `${startYear}-12`,
    `${nextYear}-01`,
    `${nextYear}-02`,
    `${nextYear}-03`,
  ];
}

function formatBSMonth(yyyymm?: string): string {
  if (!yyyymm) return "—";

  const [year, month] = yyyymm.split("-");
  const monthNum = Number.parseInt(month, 10);

  if (!year || monthNum < 1 || monthNum > 12) return yyyymm;

  return `${NEPALI_MONTHS[monthNum - 1]} ${year}`;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function PeriodLockPage() {
  const store = useStore() as any;
  const currentCompany = store.currentCompany;
  const currentFiscalYear = store.currentFiscalYear;

  const companyId = currentCompany?.id ?? "default";
  const fiscalYear = currentFiscalYear?.name ?? "2081-82";

  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedLock, setSelectedLock] = useState<PeriodLock | null>(null);
  const [lockMonth, setLockMonth] = useState("");
  const [lockReason, setLockReason] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [loading, setLoading] = useState(false);

  const months = generateBSMonths(fiscalYear);

  const loadLocks = async () => {
    try {
      setLoading(true);
      const data = await getPeriodLocks(companyId, fiscalYear);
      setLocks(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocks();
  }, [companyId, fiscalYear]);

  const handleLock = async () => {
    if (!lockMonth) {
      alert("Please select a month");
      return;
    }

    if (!lockReason.trim()) {
      alert("Please enter lock reason");
      return;
    }

    const alreadyLocked = locks.find(
      (lock) => lock.lockedMonth === lockMonth && !lock.isUnlocked,
    );

    if (alreadyLocked) {
      alert("This month is already locked");
      return;
    }

    await savePeriodLock({
      companyId,
      fiscalYear,
      lockedMonth: lockMonth,
      lockedBy: "Current User",
      lockReason,
    });

    await loadLocks();
    setShowLockModal(false);
    setLockMonth("");
    setLockReason("");
    alert("Period locked successfully");
  };

  const handleUnlock = async () => {
    if (!selectedLock) return;

    if (!unlockReason.trim()) {
      alert("Please enter unlock reason");
      return;
    }

    await unlockPeriod(selectedLock.id, "Current User", unlockReason);

    await loadLocks();
    setShowUnlockModal(false);
    setSelectedLock(null);
    setUnlockReason("");
    alert("Period unlocked");
  };

  const openLockModalForMonth = (month: string) => {
    setLockMonth(month);
    setLockReason("");
    setShowLockModal(true);
  };

  const openUnlockModal = (lock: PeriodLock) => {
    setSelectedLock(lock);
    setUnlockReason("");
    setShowUnlockModal(true);
  };

  return (
    <div className="p-6 bg-[#f5f6fa] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#1557b0]" />
            Period Lock Management
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Lock accounting periods to prevent unauthorized backdated entries
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setLockMonth("");
            setLockReason("");
            setShowLockModal(true);
          }}
          className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
        >
          <Lock className="h-3.5 w-3.5" />
          Lock a Period
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-2">
        <AlertTriangle className="h-4 w-4 text-[#d97706] shrink-0 mt-0.5" />
        <p className="text-[12px] text-amber-800">
          Locked periods cannot receive new voucher entries. Only authorized users can unlock
          periods.
        </p>
      </div>

      <div className="inline-flex bg-white rounded border border-gray-200 px-3 py-1 text-[12px] text-gray-700 mb-4">
        Fiscal Year: <span className="font-semibold ml-1">{fiscalYear}</span>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {months.map((month) => {
          const locked = locks.find(
            (lock) => lock.lockedMonth === month && lock.isUnlocked === false,
          );

          if (locked) {
            return (
              <div key={month} className="rounded-lg border border-red-300 bg-red-50 p-3">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[12px] font-medium text-gray-700">
                      {formatBSMonth(month)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Locked by: {locked.lockedBy}
                    </p>
                  </div>
                  <Lock className="h-4 w-4 text-red-600" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-100 text-red-700">
                    Locked
                  </span>
                  <button
                    type="button"
                    onClick={() => openUnlockModal(locked)}
                    className="h-7 px-2 text-[11px] border border-red-300 text-red-700 bg-white rounded hover:bg-red-50"
                  >
                    Unlock
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={month} className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[12px] font-medium text-gray-700">{formatBSMonth(month)}</p>
                  <p className="text-[10px] text-gray-500 mt-1">Open for entries</p>
                </div>
                <Unlock className="h-4 w-4 text-[#059669]" />
              </div>

              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-green-100 text-green-700">
                  Open
                </span>
                <button
                  type="button"
                  onClick={() => openLockModalForMonth(month)}
                  className="text-[11px] text-[#1557b0] hover:underline"
                >
                  Lock
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#1557b0]" />
          <h2 className="text-[13px] font-semibold text-gray-800">Lock History</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[12px] text-gray-500">Loading locks...</div>
        ) : locks.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-[12px] text-gray-400">No period locks recorded</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Month
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Locked By
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Locked At
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Locked Reason
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {locks.map((lock) => (
                <tr key={lock.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {formatBSMonth(lock.lockedMonth)}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{lock.lockedBy}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {formatDate(lock.lockedAt)}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {lock.isUnlocked ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-green-100 text-green-700">
                        Unlocked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-100 text-red-700">
                        Locked
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    <div>{lock.lockReason}</div>
                    {lock.isUnlocked && lock.unlockReason && (
                      <div className="text-[10px] text-gray-500 mt-1">
                        Unlock reason: {lock.unlockReason}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">
                    {!lock.isUnlocked ? (
                      <button
                        type="button"
                        onClick={() => openUnlockModal(lock)}
                        className="h-7 px-2 text-[11px] border border-red-300 text-red-700 bg-white rounded hover:bg-red-50"
                      >
                        Unlock
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showLockModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-[14px] font-semibold text-gray-800">Lock Accounting Period</h2>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Month</label>
                <select
                  value={lockMonth}
                  onChange={(event) => setLockMonth(event.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="">Select Month</option>
                  {months.map((month) => (
                    <option key={month} value={month}>
                      {formatBSMonth(month)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Lock Reason
                </label>
                <textarea
                  value={lockReason}
                  onChange={(event) => setLockReason(event.target.value)}
                  rows={3}
                  className="w-full px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  placeholder="Enter reason for locking this period"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-[11px] text-amber-800">
                Once locked, no new vouchers can be entered for this period.
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLockModal(false)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLock}
                className="bg-red-600 hover:bg-red-700 text-white h-8 px-4 rounded-md text-[12px] font-medium"
              >
                Lock Period
              </button>
            </div>
          </div>
        </div>
      )}

      {showUnlockModal && selectedLock && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-[14px] font-semibold text-gray-800">
                Unlock Period: {formatBSMonth(selectedLock.lockedMonth)}
              </h2>
            </div>

            <div className="p-4 space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-md p-2 text-[12px] text-red-700">
                Unlocking allows backdated entries. This action is logged.
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Unlock Reason
                </label>
                <textarea
                  value={unlockReason}
                  onChange={(event) => setUnlockReason(event.target.value)}
                  rows={3}
                  className="w-full px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  placeholder="Enter reason for unlocking this period"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnlock}
                className="h-8 px-4 bg-[#d97706] hover:bg-[#b45309] text-white text-[12px] font-medium rounded-md"
              >
                Unlock Period
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
