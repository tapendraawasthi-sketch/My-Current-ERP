// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Contra Voucher — records transfers between Cash and Bank accounts ONLY.
 */

import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { Input, Select, NepaliDatePicker, ConfirmDialog } from "../components/ui";
import {
  ArrowRightLeft,
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  Printer,
  Banknote,
  Landmark,
} from "lucide-react";
import { formatNumber } from "../lib/utils";
import { ADToBSString } from "../lib/nepaliDate";
import { generateVoucherNo } from "../lib/accounting";
import { generateVoucherPDF } from "../lib/printUtils";
import { VoucherType, VoucherStatus } from "../lib/types";
import toast from "@/lib/appToast";
import { postContraTransaction } from "@/domains/settlement/postContraTransaction";
import { generateId } from "@/lib/db";
import type { ContraType } from "@/domains/settlement/types";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5 disabled:opacity-60";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5 disabled:opacity-60";
const th = "px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";

const isCashOrBank = (a: any) => {
  if (!a || a.isGroup || a.isActive === false) return false;
  if (a.parentId === "grp-cash-in-hand" || a.parentId === "grp-bank-accounts") return true;
  if (a.group === "Cash-in-Hand" || a.group === "Bank Accounts") return true;
  return false;
};

const acctKind = (a: any): "Cash" | "Bank" | "" => {
  if (!a) return "";
  if (a.parentId === "grp-cash-in-hand" || a.group === "Cash-in-Hand") return "Cash";
  if (a.parentId === "grp-bank-accounts" || a.group === "Bank Accounts") return "Bank";
  return "";
};

const KindBadge = ({ kind }: { kind: "Cash" | "Bank" | "" }) => {
  if (kind === "Cash") {
    return (
      <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-amber-100 text-amber-700 inline-flex items-center gap-1">
        <Banknote className="h-3 w-3" />
        Cash
      </span>
    );
  }
  if (kind === "Bank") {
    return (
      <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-blue-100 text-blue-700 inline-flex items-center gap-1">
        <Landmark className="h-3 w-3" />
        Bank
      </span>
    );
  }
  return (
    <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-gray-100 text-gray-700">
      —
    </span>
  );
};

const ContraVoucher: React.FC = () => {
  const { accounts, vouchers, companySettings, currentFiscalYear, currentUser, addVoucher } =
    useStore();
  const { branchFilter, setBranchFilter, branchOptions } = useBranchFilter();

  const symbol = companySettings?.currencySymbol || "Rs.";

  const cashBankAccounts = useMemo(
    () => accounts.filter(isCashOrBank).sort((a, b) => (a.code || "").localeCompare(b.code || "")),
    [accounts],
  );

  const accountOptions = useMemo(
    () =>
      cashBankAccounts.map((a) => ({
        value: a.id,
        label: `${a.code} · ${a.name} (${acctKind(a)})`,
      })),
    [cashBankAccounts],
  );

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [narration, setNarration] = useState("");

  const defaultCashId = useMemo(
    () => cashBankAccounts.find((a) => acctKind(a) === "Cash")?.id || "",
    [cashBankAccounts],
  );
  const defaultBankId = useMemo(
    () => cashBankAccounts.find((a) => acctKind(a) === "Bank")?.id || "",
    [cashBankAccounts],
  );

  const [fromId, setFromId] = useState<string>(defaultCashId);
  const [toId, setToId] = useState<string>(defaultBankId);
  const [amount, setAmount] = useState<number>(0);

  useEffect(() => {
    if (!fromId && defaultCashId) setFromId(defaultCashId);
    if (!toId && defaultBankId) setToId(defaultBankId);
  }, [defaultCashId, defaultBankId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromAcct = useMemo(() => accounts.find((a) => a.id === fromId), [accounts, fromId]);
  const toAcct = useMemo(() => accounts.find((a) => a.id === toId), [accounts, toId]);

  const fromKind = acctKind(fromAcct);
  const toKind = acctKind(toAcct);

  const fromAvailable = useMemo(() => Math.max(0, fromAcct?.balance ?? 0), [fromAcct]);
  const toAvailable = useMemo(() => Math.max(0, toAcct?.balance ?? 0), [toAcct]);

  const fromAfter = round2(fromAvailable - (Number(amount) || 0));
  const toAfter = round2(toAvailable + (Number(amount) || 0));

  const voucherNoPreview = useMemo(() => {
    try {
      const { voucherNo } = generateVoucherNo(
        VoucherType.CONTRA,
        companySettings?.voucherSeries || {},
        vouchers,
      );
      return voucherNo;
    } catch {
      return "CV-XXXX";
    }
  }, [companySettings, vouchers]);

  const [dirty, setDirty] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedVoucher, setSavedVoucher] = useState<any | null>(null);

  const markDirty = () => setDirty(true);

  const validate = (): string | null => {
    if (!fromId) return "Select the FROM (credit) account.";
    if (!toId) return "Select the TO (debit) account.";
    if (fromId === toId) return "FROM and TO cannot be the same account.";
    if (!isCashOrBank(fromAcct)) return "FROM account must be a Cash or Bank ledger.";
    if (!isCashOrBank(toAcct)) return "TO account must be a Cash or Bank ledger.";
    if (!(Number(amount) > 0)) return "Amount must be greater than zero.";
    if (round2(amount) > round2(fromAvailable)) {
      return `Insufficient balance in ${fromAcct?.name}. Available: ${symbol} ${formatNumber(fromAvailable)}.`;
    }
    if (!date) return "Date is required.";
    const today = new Date().toISOString().split("T")[0];
    if (date > today) return "Date cannot be in the future.";
    if (
      currentFiscalYear &&
      (date < currentFiscalYear.startDate || date > currentFiscalYear.endDate)
    ) {
      return `Date must be within the current fiscal year (${currentFiscalYear.name}).`;
    }
    return null;
  };

  const buildPayload = (status: VoucherStatus) => {
    const amt = round2(amount);
    const lines = [
      {
        accountId: toAcct.id,
        accountName: toAcct.name,
        debit: amt,
        credit: 0,
        narration: `Transfer from ${fromAcct?.name}`,
      },
      {
        accountId: fromAcct.id,
        accountName: fromAcct.name,
        debit: 0,
        credit: amt,
        narration: `Transfer to ${toAcct?.name}`,
      },
    ];

    return {
      date,
      dateNepali: ADToBSString(date) || "",
      type: VoucherType.CONTRA,
      narration: narration.trim() || `Contra: ${fromAcct?.name} → ${toAcct?.name}`,
      lines,
      status,
      totalDebit: amt,
      totalCredit: amt,
      branchId: readActiveBranchId() || undefined,
    };
  };

  const handleSave = async (status: VoucherStatus) => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      if (status === VoucherStatus.POSTED) {
        const fk = acctKind(fromAcct);
        const tk = acctKind(toAcct);
        let contraType: ContraType = "bank_to_bank";
        if (fk === "Cash" && tk === "Bank") contraType = "cash_to_bank";
        else if (fk === "Bank" && tk === "Cash") contraType = "bank_to_cash";
        else if (fk === "Cash" && tk === "Cash") contraType = "cash_to_cash";
        else contraType = "bank_to_bank";

        const companyId = String(
          (companySettings as any)?.companyId || (companySettings as any)?.id || "main",
        );
        const result = await postContraTransaction({
          commandId: generateId(),
          requestId: generateId(),
          idempotencyKey: `manual-contra-${generateId()}`,
          companyId,
          financialYearId: currentFiscalYear?.id || null,
          userId: currentUser?.id || "manual-user",
          userRole: currentUser?.role || "accountant",
          source: "manual_form",
          contra: {
            contraType,
            transactionDate: date,
            fromAccountId: fromId,
            toAccountId: toId,
            amount: round2(amount).toFixed(2),
            currency: "NPR",
            narration: narration.trim() || `Contra: ${fromAcct?.name} → ${toAcct?.name}`,
          },
        });
        if (result.type !== "posting_completed") {
          toast.error(result.payload.safe_message || "Failed to post contra.");
          return;
        }
        toast.success("Contra voucher posted.");
        setDirty(false);
        setSavedVoucher({
          id: result.payload.voucher_id,
          voucherNo: result.payload.voucher_number,
          status: VoucherStatus.POSTED,
        });
        return;
      }

      const payload = buildPayload(status);
      const result = await addVoucher(payload);
      toast.success("Draft saved.");
      setDirty(false);
      setSavedVoucher(result);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save contra voucher.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!savedVoucher) return;
    try {
      const blob = generateVoucherPDF(savedVoucher, companySettings, accounts);
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch {
      toast.error("Failed to generate PDF.");
    }
  };

  const handleBack = () => {
    if (dirty) setConfirmCancel(true);
    else useStore.getState().setCurrentPage?.("dashboard");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
      } else if (e.key === "F12") {
        e.preventDefault();
        handleSave(VoucherStatus.POSTED);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fromId, toId, amount, date, narration, dirty]);

  if (savedVoucher) {
    const amt = round2(amount);
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-5 py-16 bg-[var(--ds-surface-muted)] text-center px-4">
        <div className="h-14 w-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-gray-800">Contra voucher saved</h2>
          <p className="text-[12px] text-gray-600 mt-1">
            {savedVoucher.voucherNo} · {symbol} {formatNumber(amt)} transferred
          </p>
          <p className="text-[12px] text-gray-500 mt-1">
            {fromAcct?.name} → {toAcct?.name}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button type="button" className={btnPrimary} onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />
            Print voucher
          </button>
          <button
            type="button"
            className={btnOutline}
            onClick={() => {
              setSavedVoucher(null);
              setAmount(0);
              setNarration("");
              setDirty(false);
            }}
          >
            New contra
          </button>
          <button
            type="button"
            className={btnOutline}
            onClick={() => useStore.getState().setCurrentPage?.("vouchers")}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const sameAccount = !!(fromId && toId && fromId === toId);
  const insufficient = !!(fromAcct && Number(amount) > 0 && round2(amount) > round2(fromAvailable));

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ds-surface-muted)] overflow-y-auto">
      <div className="p-4 space-y-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-[var(--ds-action-primary)]" />
                Transfer between accounts
              </h1>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Transfer between cash and bank accounts only
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {branchOptions.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                aria-label="Branch"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            )}
            <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-blue-100 text-blue-700">
              Contra
            </span>
            <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-gray-100 text-gray-700">
              New
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-gray-600 w-28 shrink-0">
                Voucher no
              </span>
              <span className="inline-flex items-center px-2.5 h-8 rounded-md bg-gray-50 border border-gray-200 font-mono text-[12px] font-medium text-gray-800">
                {voucherNoPreview}
              </span>
            </div>
            <div>
              <NepaliDatePicker
                label="Date (BS)"
                value={date}
                onChange={(v) => {
                  setDate(v);
                  markDirty();
                }}
                required
              />
              <p className="text-[12px] text-gray-500 mt-1">AD: {date}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
          <div className="bg-white border border-gray-200 rounded-md p-4 border-l-[3px] border-l-red-400">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                From (credit)
              </h3>
              <KindBadge kind={fromKind} />
            </div>
            <div className="flex flex-col gap-3">
              <Select
                label="Account"
                options={accountOptions}
                value={fromId}
                onChange={(v) => {
                  setFromId(v);
                  markDirty();
                }}
                placeholder="Select cash / bank account"
                searchable
                required
              />
              <Input
                label="Amount"
                type="number"
                value={amount || ""}
                onChange={(v) => {
                  setAmount(Number(v) || 0);
                  markDirty();
                }}
                placeholder="0.00"
                required
                error={insufficient ? "Insufficient balance" : undefined}
              />
              {fromAcct && (
                <div className="rounded-md bg-gray-50 border border-gray-200 p-2.5 text-[12px] flex flex-col gap-1">
                  <div className="flex justify-between text-gray-600">
                    <span>Available now</span>
                    <span className="font-mono text-gray-800">
                      {symbol} {formatNumber(fromAvailable)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1">
                    <span className="text-gray-600">After transfer</span>
                    <span
                      className={`font-mono ${fromAfter < 0 ? "text-red-600" : "text-gray-800"}`}
                    >
                      {symbol} {formatNumber(fromAfter)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="h-9 w-9 rounded-full bg-[var(--ds-surface-muted)] border border-gray-200 flex items-center justify-center text-gray-500">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-4 border-l-[3px] border-l-green-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                To (debit)
              </h3>
              <KindBadge kind={toKind} />
            </div>
            <div className="flex flex-col gap-3">
              <Select
                label="Account"
                options={accountOptions.filter((o) => o.value !== fromId)}
                value={toId}
                onChange={(v) => {
                  setToId(v);
                  markDirty();
                }}
                placeholder="Select cash / bank account"
                searchable
                required
                error={sameAccount ? "Cannot match FROM account" : undefined}
              />
              <Input
                label="Amount"
                type="number"
                value={amount || ""}
                onChange={() => {}}
                placeholder="0.00"
                disabled
                hint="Auto-matches FROM amount"
              />
              {toAcct && (
                <div className="rounded-md bg-gray-50 border border-gray-200 p-2.5 text-[12px] flex flex-col gap-1">
                  <div className="flex justify-between text-gray-600">
                    <span>Available now</span>
                    <span className="font-mono text-gray-800">
                      {symbol} {formatNumber(toAvailable)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1">
                    <span className="text-gray-600">After transfer</span>
                    <span className="font-mono text-green-700">
                      {symbol} {formatNumber(toAfter)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-4">
          <Input
            label="Narration"
            value={narration}
            onChange={(v) => {
              setNarration(v);
              markDirty();
            }}
            placeholder="e.g. Being cash deposited to bank"
          />
        </div>

        {fromAcct && toAcct && Number(amount) > 0 && (
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                Journal preview
              </h3>
              <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-green-100 text-green-700 border border-green-200">
                Balanced
              </span>
            </div>
            <div className="rounded-md border border-gray-200 overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[var(--ds-surface-muted)] border-b border-gray-200">
                    <th className={th}>Account</th>
                    <th className={`${th} text-right`}>Debit</th>
                    <th className={`${th} text-right`}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={`${td} font-medium text-gray-800`}>
                      {toAcct.name} <span className="text-[12px] text-gray-500">Dr</span>
                    </td>
                    <td className={`${td} text-right font-mono text-green-700 font-medium`}>
                      {symbol} {formatNumber(amount)}
                    </td>
                    <td className={`${td} text-right font-mono text-gray-400`}>—</td>
                  </tr>
                  <tr>
                    <td className={`${td} pl-8 text-gray-700`}>
                      To {fromAcct.name} <span className="text-[12px] text-gray-500">Cr</span>
                    </td>
                    <td className={`${td} text-right font-mono text-gray-400`}>—</td>
                    <td className={`${td} text-right font-mono text-red-600 font-medium`}>
                      {symbol} {formatNumber(amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-200 pt-4 pb-2">
          <p className="text-[12px] text-gray-500">Esc to cancel · F12 to post</p>
          <div className="flex items-center gap-2">
            <button type="button" className={btnOutline} onClick={handleBack}>
              Cancel
            </button>
            <button
              type="button"
              className={btnOutline}
              disabled={saving}
              onClick={() => handleSave(VoucherStatus.DRAFT)}
            >
              <Save className="h-3.5 w-3.5" />
              Save draft
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={saving}
              onClick={() => handleSave(VoucherStatus.POSTED)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Post contra
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Discard changes?"
        message="You have unsaved changes. Leaving will discard this contra voucher."
        confirmText="Discard"
        cancelText="Stay"
        variant="danger"
        onConfirm={() => {
          setConfirmCancel(false);
          useStore.getState().setCurrentPage?.("dashboard");
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
};

export default ContraVoucher;
