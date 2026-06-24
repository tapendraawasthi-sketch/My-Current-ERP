// @ts-nocheck
import React, { useState } from "react";
import { Calendar, Plus, Lock, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { useStore } from "../store";
import { FiscalYearStatus, UserRole, VoucherStatus, JournalEntry, VoucherType, AccountType, AccountLevel } from "../lib/types";
import { resetAllSeriesForNewYear, computeProfitLoss } from "../lib/accounting";
import { generateId } from "../lib/db";
import toast from "react-hot-toast";
import { ADToBSString } from "../lib/nepaliDate";

export default function FiscalYear() {
  const {
    fiscalYears,
    addFiscalYear,
    closeFiscalYear,
    setCurrentFiscalYear,
    currentUser,
    companySettings,
    hasRole,
    vouchers,
    invoices,
    accounts,
    addVoucher,
    addAccount
  } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const overlap = fiscalYears.some(fy => 
      (formData.startDate >= fy.startDate && formData.startDate <= fy.endDate) ||
      (formData.endDate >= fy.startDate && formData.endDate <= fy.endDate) ||
      (formData.startDate <= fy.startDate && formData.endDate >= fy.endDate)
    );

    if (overlap) {
      toast.error("Fiscal year dates overlap with an existing year");
      return;
    }

    const seriesState: Record<string, { prefix: string; nextNumber: number }> = {};
    Object.entries(companySettings?.voucherSeries || {}).forEach(([key, val]) => {
      seriesState[key] = { prefix: val.prefix || "", nextNumber: 1 };
    });

    addFiscalYear({
      id: generateId("fy"),
      ...formData,
      status: FiscalYearStatus.FUTURE,
      isCurrent: false,
      voucherSeriesState: seriesState,
    });
    
    toast.success("New Fiscal Year Created");
    setFormData({ name: "", startDate: "", endDate: "" });
    setShowForm(false);
  };

  const handleSetActive = async (id: string) => {
    if (!hasRole(UserRole.ADMIN) && !hasRole(UserRole.MANAGER)) {
      toast.error("Admin or Manager access required");
      return;
    }
    if (confirm("Set this as the current active fiscal year?")) {
      const fy = fiscalYears.find(f => f.id === id);
      setCurrentFiscalYear(id);
      if (fy?.fiscalYearBS) {
        await resetAllSeriesForNewYear(fy.fiscalYearBS);
      }
      toast.success("Fiscal Year activated");
    }
  };

  // Heavy lifting Closing Logic
  const handleCloseYear = async (id: string) => {
    if (!hasRole(UserRole.ADMIN)) {
      toast.error("Access denied — insufficient permissions. Admin role required to close Fiscal Year.");
      return;
    }

    const fy = fiscalYears.find(f => f.id === id);
    if (!fy) return;

    // 1. Check for DRAFTS
    const fyVouchers = vouchers.filter(v => v.date >= fy.startDate && v.date <= fy.endDate);
    const drafts = fyVouchers.filter(v => v.status === VoucherStatus.DRAFT);
    if (drafts.length > 0) {
      toast.error(`Cannot close year. There are ${drafts.length} unposted DRAFT vouchers.`);
      return;
    }

    // Identify the NEXT fiscal year
    const nextFy = fiscalYears.find(f => f.startDate > fy.endDate);
    if (!nextFy) {
      toast.error("Please create the next Fiscal Year before closing this one.");
      return;
    }

    try {
      // 2. Compute P&L
      const pl = computeProfitLoss(accounts, vouchers, invoices, fy.startDate, fy.endDate);

      // Find or Create Retained Earnings account
      let retainedEarnings = accounts.find(a => a.name.toLowerCase() === "retained earnings");
      if (!retainedEarnings) {
        retainedEarnings = await addAccount({
          name: "Retained Earnings",
          code: "EQ-RET",
          type: AccountType.EQUITY,
          level: AccountLevel.LEDGER,
          parentId: "grp-capital-account",
          group: "Capital Account",
          isGroup: false,
          isActive: true,
          isSystemAccount: true,
          balance: 0,
        });
      }

      // 3. Create Closing Journal Entry (in the current year)
      // DR Income, CR Expense, Diff -> Retained Earnings
      const closingLines = [];
      let totalDr = 0;
      let totalCr = 0;

      for (const brk of pl.ledgerBreakdown) {
        const acc = accounts.find(a => a.name === brk.ledgerName);
        if (acc && brk.amount !== 0) {
          if (acc.type === AccountType.INCOME) {
            // Natural CR, so to close it we DR
            const amt = Math.abs(brk.amount);
            closingLines.push({ id: generateId("l"), accountId: acc.id, accountName: acc.name, debit: amt, credit: 0, narration: "Closing Transfer" });
            totalDr += amt;
          } else if (acc.type === AccountType.EXPENSE) {
            // Natural DR, so to close it we CR
            const amt = Math.abs(brk.amount);
            closingLines.push({ id: generateId("l"), accountId: acc.id, accountName: acc.name, debit: 0, credit: amt, narration: "Closing Transfer" });
            totalCr += amt;
          }
        }
      }

      if (closingLines.length > 0) {
        // Balance it with Retained Earnings
        const diff = totalDr - totalCr;
        if (diff > 0) {
          closingLines.push({ id: generateId("l"), accountId: retainedEarnings.id, accountName: retainedEarnings.name, debit: 0, credit: diff, narration: "Net Profit Transfer" });
        } else if (diff < 0) {
          closingLines.push({ id: generateId("l"), accountId: retainedEarnings.id, accountName: retainedEarnings.name, debit: Math.abs(diff), credit: 0, narration: "Net Loss Transfer" });
        }

        const closingVoucher: any = {
          type: VoucherType.JOURNAL_VOUCHER,
          date: fy.endDate,
          dateNepali: ADToBSString(fy.endDate),
          lines: closingLines,
          narration: `Year End Closing Transfer for ${fy.name}`,
          status: VoucherStatus.POSTED
        };
        await addVoucher(closingVoucher);
      }

      // 4. Carry Forward to Next Year (Balance Sheet accounts only)
      // Recalculate balances after the closing journal
      // Actually we should fetch true balances, but we can compute them directly for the next year
      // For simplicity, we filter only Assets, Liabilities, and Equity
      const carryForwardLines = [];
      let opDr = 0;
      let opCr = 0;

      accounts.filter(a => a.type !== AccountType.INCOME && a.type !== AccountType.EXPENSE).forEach(acc => {
        // Sum all transactions for this account up to fy.endDate
        // We simulate the balance
        let balance = 0;
        vouchers.filter(v => v.date <= fy.endDate && v.status === VoucherStatus.POSTED).forEach(v => {
          v.lines.forEach(l => {
            if (l.accountId === acc.id) {
              balance += (l.debit - l.credit);
            }
          });
        });
        
        // Include the Retained Earnings adjustment if it's that account
        if (acc.id === retainedEarnings?.id) {
          balance += (totalCr - totalDr); // Credit Nature
        }

        if (Math.abs(balance) > 0.01) {
          if (balance > 0) {
            carryForwardLines.push({ id: generateId("l"), accountId: acc.id, accountName: acc.name, debit: balance, credit: 0, narration: `Opening Balance B/F from ${fy.name}` });
            opDr += balance;
          } else {
            carryForwardLines.push({ id: generateId("l"), accountId: acc.id, accountName: acc.name, debit: 0, credit: Math.abs(balance), narration: `Opening Balance B/F from ${fy.name}` });
            opCr += Math.abs(balance);
          }
        }
      });

      if (carryForwardLines.length > 0) {
        // Post an OPENING_BALANCE in the next FY
        const openingVoucher: any = {
          type: VoucherType.OPENING_BALANCE,
          date: nextFy.startDate, // Post on the very first day of next FY
          dateNepali: ADToBSString(nextFy.startDate),
          lines: carryForwardLines,
          narration: `Opening Balances brought forward from ${fy.name}`,
          status: VoucherStatus.POSTED
        };
        await addVoucher(openingVoucher);
      }

      // Finally, close the year
      await closeFiscalYear(id, currentUser?.id || "system");
      toast.success(`Fiscal Year ${fy.name} has been successfully closed and rolled over!`);
      setShowCloseModal(null);

    } catch (err: any) {
      console.error(err);
      toast.error("Failed to process year-end closing: " + err.message);
    }
  };

  const getStatusBadge = (status: FiscalYearStatus) => {
    const classes = {
      [FiscalYearStatus.ACTIVE]: "bg-green-100 text-green-700",
      [FiscalYearStatus.CLOSED]: "bg-gray-100 text-gray-700",
      [FiscalYearStatus.FUTURE]: "bg-blue-100 text-blue-700",
    };
    return (
      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${classes[status] || "bg-gray-100 text-gray-700"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Fiscal Year Management</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage accounting periods, start new years, and process year-end closings</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create New Year
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#f5f6fa] border-b border-gray-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Label</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Start Date</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">End Date</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fiscalYears.map(fy => (
              <tr key={fy.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">{fy.name} {fy.isCurrent && "(Current)"}</td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{ADToBSString(fy.startDate)} <span className="text-[10px] text-gray-400">({fy.startDate})</span></td>
                <td className="px-3 py-2.5 text-[12px] text-gray-600">{ADToBSString(fy.endDate)} <span className="text-[10px] text-gray-400">({fy.endDate})</span></td>
                <td className="px-3 py-2.5">{getStatusBadge(fy.status)}</td>
                <td className="px-3 py-2.5 text-right flex items-center justify-end gap-2">
                  {fy.status === FiscalYearStatus.FUTURE && (
                    <button onClick={() => handleSetActive(fy.id)} className="px-2 py-1 bg-white border border-[#1557b0] text-[#1557b0] hover:bg-[#1557b0] hover:text-white rounded text-[10px] font-bold uppercase transition-colors">
                      Set Active
                    </button>
                  )}
                  {fy.status === FiscalYearStatus.ACTIVE && (
                    <button onClick={() => setShowCloseModal(fy.id)} className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white rounded text-[10px] font-bold uppercase transition-colors flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Close Year
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {fiscalYears.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-[12px]">No fiscal years configured.</div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-[#f5f6fa]">
              <h2 className="text-[14px] font-semibold text-gray-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#1557b0]" /> Create Fiscal Year
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Label (e.g. 2081/2082)</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Start Date (AD)</label>
                    <input type="date" required value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">End Date (AD)</label>
                    <input type="date" required value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
                  </div>
                </div>
                <div className="bg-blue-50 text-blue-700 text-[11px] p-2 rounded border border-blue-100 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p>Fiscal year dates should not overlap. The new year will be marked as "Future" until activated.</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Cancel</button>
                <button type="submit" className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md">Save Fiscal Year</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-red-100 flex items-center justify-between bg-red-50">
              <h2 className="text-[14px] font-semibold text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Confirm Year-End Closure
              </h2>
            </div>
            <div className="p-4 text-[12px] text-gray-700 space-y-3">
              <p>You are about to permanently close <b>{fiscalYears.find(f => f.id === showCloseModal)?.name}</b>. This process will:</p>
              <ul className="space-y-2 list-disc list-inside">
                <li>Verify zero DRAFT vouchers remain.</li>
                <li>Compute Net Profit from all P&L accounts.</li>
                <li>Draft a <b>Closing Journal</b> to zero out Income/Expense ledgers against Retained Earnings.</li>
                <li>Generate an <b>Opening Balance</b> voucher in the next fiscal year for all Balance Sheet accounts.</li>
                <li>Lock the year to prevent any further changes.</li>
              </ul>
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded mt-2 font-bold flex gap-2 items-center">
                <Lock className="w-4 h-4 shrink-0" /> This action is irreversible. Ensure you have backed up your data.
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setShowCloseModal(null)} className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleCloseYear(showCloseModal)} className="h-8 px-4 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md shadow-sm">Proceed & Close Year</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

