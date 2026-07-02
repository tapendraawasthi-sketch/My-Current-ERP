// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Contra Voucher — records transfers between Cash and Bank accounts ONLY.
 *
 * Common use cases:
 *   a) Cash deposit to bank      → FROM Cash (Cr), TO Bank (Dr)
 *   b) Cash withdrawal from bank → FROM Bank (Cr), TO Cash (Dr)
 *   c) Bank to bank transfer     → FROM Bank A (Cr), TO Bank B (Dr)
 *
 * Auto-built journal:
 *   FROM A/C ............ Cr (amount)
 *   TO   A/C ............ Dr (amount)
 */

import React, { useState, useMemo, useEffect } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  NepaliDatePicker,
  ConfirmDialog,
} from "../components/ui";
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
import { generateVoucherNo, getAccountBalance } from "../lib/accounting";
import { generateVoucherPDF } from "../lib/printUtils";
import { VoucherType, VoucherStatus } from "../lib/types";
import toast from "react-hot-toast";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

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

const ContraVoucher: React.FC = () => {
  const { accounts, vouchers, companySettings, currentFiscalYear, addVoucher } = useStore();

  const symbol = companySettings?.currencySymbol || "Rs.";

  // -- only Cash & Bank ledgers --
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

  // -- header --
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [narration, setNarration] = useState("");

  // -- from / to --
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

  const fromBal = useMemo(() => (fromAcct ? getAccountBalance(fromAcct) : null), [fromAcct]);
  const toBal = useMemo(() => (toAcct ? getAccountBalance(toAcct) : null), [toAcct]);

  // available cash/bank balance in Dr (asset positive = Dr)
  const fromAvailable = useMemo(() => {
    if (!fromBal) return 0;
    return fromBal.sign === "Dr" ? fromBal.dr : -fromBal.cr;
  }, [fromBal]);

  const toAvailable = useMemo(() => {
    if (!toBal) return 0;
    return toBal.sign === "Dr" ? toBal.dr : -toBal.cr;
  }, [toBal]);

  // running balance after this transaction
  const fromAfter = round2(fromAvailable - (Number(amount) || 0));
  const toAfter = round2(toAvailable + (Number(amount) || 0));

  // -- voucher no preview --
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

  // -- validation --
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
      const payload = buildPayload(status);
      const result = await addVoucher(payload);
      toast.success(status === VoucherStatus.POSTED ? "Contra voucher posted." : "Draft saved.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId, toId, amount, date, narration, dirty]);

  // ---- success screen ----
  if (savedVoucher) {
    const amt = round2(amount);
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-20 animate-fadeIn text-center">
        <div className="h-16 w-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#000000]">Contra Voucher Saved</h2>
          <p className="text-xs text-[#000000] mt-1">
            {savedVoucher.voucherNo} · {symbol} {formatNumber(amt)} transferred
          </p>
          <p className="text-[11px] text-[#000000] mt-1 font-semibold">
            {fromAcct?.name} → {toAcct?.name}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            icon={<Printer className="h-4 w-4" />}
          >
            Print Voucher
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // reset for a new one
              setSavedVoucher(null);
              setAmount(0);
              setNarration("");
              setDirty(false);
            }}
          >
            New Contra
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => useStore.getState().setCurrentPage?.("vouchers")}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  const KindBadge = ({ kind }: { kind: "Cash" | "Bank" | "" }) => {
    if (kind === "Cash")
      return (
        <Badge variant="warning" size="sm">
          <span className="inline-flex items-center gap-1">
            <Banknote className="h-3 w-3" /> CASH
          </span>
        </Badge>
      );
    if (kind === "Bank")
      return (
        <Badge variant="info" size="sm">
          <span className="inline-flex items-center gap-1">
            <Landmark className="h-3 w-3" /> BANK
          </span>
        </Badge>
      );
    return (
      <Badge variant="default" size="sm">
        —
      </Badge>
    );
  };

  const sameAccount = !!(fromId && toId && fromId === toId);
  const insufficient = !!(fromAcct && Number(amount) > 0 && round2(amount) > round2(fromAvailable));

  return (
    <div className="flex flex-col gap-5 animate-fadeIn text-xs select-none">
      <ActionToolbar title="Contra Vouchers" subtitle="Cash/bank transfers" />
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#9DC07A] pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-md hover:bg-[#EBF5E2] text-[#000000]"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-lg font-black text-[#000000] tracking-tight flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-[#000000]" />
              NEW CONTRA VOUCHER
            </h2>
            <p className="text-[11px] text-[#000000] mt-0.5 tracking-wider font-bold">
              Transfer between cash &amp; bank accounts only
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" size="md">
            CONTRA
          </Badge>
          <Badge variant="default">NEW</Badge>
        </div>
      </div>

      {/* Meta */}
      <Card border padding="md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#000000] w-32 shrink-0">Voucher No</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#EBF5E2] border border-[#9DC07A] font-mono font-bold text-[#000000]">
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
            <p className="text-[11px] text-[#000000] mt-1 font-semibold">AD: {date}</p>
          </div>
        </div>
      </Card>

      {/* FROM → TO */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
        {/* FROM */}
        <Card border padding="md" className="border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-[#000000] uppercase tracking-wider">
              From (Credit)
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
              <div className="rounded-md bg-[#EBF5E2] border border-[#9DC07A] p-2.5 text-[11px] font-semibold flex flex-col gap-1">
                <div className="flex justify-between text-[#000000]">
                  <span>Available now</span>
                  <span className="font-mono text-[#000000]">
                    {symbol} {formatNumber(fromAvailable)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#9DC07A] pt-1">
                  <span className="text-[#000000]">After transfer</span>
                  <span
                    className={`font-mono ${fromAfter < 0 ? "text-red-600" : "text-[#000000]"}`}
                  >
                    {symbol} {formatNumber(fromAfter)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <div className="h-10 w-10 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[#000000]">
            <ArrowRight className="h-5 w-5" />
          </div>
        </div>

        {/* TO */}
        <Card border padding="md" className="border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-[#000000] uppercase tracking-wider">
              To (Debit)
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
              <div className="rounded-md bg-[#EBF5E2] border border-[#9DC07A] p-2.5 text-[11px] font-semibold flex flex-col gap-1">
                <div className="flex justify-between text-[#000000]">
                  <span>Available now</span>
                  <span className="font-mono text-[#000000]">
                    {symbol} {formatNumber(toAvailable)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#9DC07A] pt-1">
                  <span className="text-[#000000]">After transfer</span>
                  <span className="font-mono text-green-700">
                    {symbol} {formatNumber(toAfter)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Narration */}
      <Card border padding="md">
        <Input
          label="Narration"
          value={narration}
          onChange={(v) => {
            setNarration(v);
            markDirty();
          }}
          placeholder="e.g. Being cash deposited to bank"
        />
      </Card>

      {/* Journal preview */}
      {fromAcct && toAcct && Number(amount) > 0 && (
        <Card border padding="md">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-black text-[#000000] uppercase tracking-wider">
              Journal Preview
            </h3>
            <Badge variant="success" size="sm">
              BALANCED
            </Badge>
          </div>
          <div className="rounded-md border border-[#9DC07A] overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead className="bg-[#EBF5E2] text-[11px] font-bold text-[#000000] uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#9DC07A]">
                  <td className="px-3 py-2 text-[#000000] font-semibold">
                    {toAcct.name} <span className="text-[10px] text-[#000000]">Dr</span>
                  </td>
                  <td className="px-3 py-2 text-right text-green-700 font-bold">
                    {symbol} {formatNumber(amount)}
                  </td>
                  <td className="px-3 py-2 text-right text-[#000000]">—</td>
                </tr>
                <tr className="border-t border-[#9DC07A]">
                  <td className="px-3 py-2 pl-8 text-[#000000]">
                    To {fromAcct.name} <span className="text-[10px] text-[#000000]">Cr</span>
                  </td>
                  <td className="px-3 py-2 text-right text-[#000000]">—</td>
                  <td className="px-3 py-2 text-right text-red-600 font-bold">
                    {symbol} {formatNumber(amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-[#9DC07A] pt-4">
        <p className="text-[11px] text-[#000000] font-semibold">ESC to cancel · F12 to post</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBack}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSave(VoucherStatus.DRAFT)}
            loading={saving}
            icon={<Save className="h-4 w-4" />}
          >
            Save Draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSave(VoucherStatus.POSTED)}
            loading={saving}
            icon={<CheckCircle2 className="h-4 w-4" />}
          >
            Post Contra
          </Button>
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
