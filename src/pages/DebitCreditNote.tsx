/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Debit / Credit Note â€” non-inventory price adjustments.
 *
 *   DEBIT NOTE  (buyer â†’ seller, reduces our payable / our cost)
 *     Dr  Supplier A/C
 *     Cr  Purchase Adjustment / Discount Received A/C
 *
 *   CREDIT NOTE (seller â†’ buyer, reduces our receivable / our revenue)
 *     Dr  Sales Adjustment / Discount Allowed A/C
 *     Cr  Customer A/C
 *
 * No items table â€” just narration + amount. The selected adjustment ledger
 * is user-picked from a filtered list of Indirect Income / Indirect Expense
 * accounts. Journal is posted via useStore.addVoucher.
 */

import React, { useMemo, useState, useEffect } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  PartySelect,
  NepaliDatePicker,
  AmountInput,
  SearchableTable,
} from "../components/ui";
import { ArrowLeft, Plus, Save, FileText, Receipt } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { ADToBSString } from "../lib/nepaliDate";
import { VoucherType, VoucherStatus, PartyType } from "../lib/types";
import toast from "react-hot-toast";

type NoteKind = "debit" | "credit";
type Mode = "list" | "new" | "view";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const DebitCreditNote: React.FC = () => {
  const { vouchers, parties, accounts, companySettings, currentFiscalYear, addVoucher } =
    useStore();
  const symbol = companySettings?.currencySymbol || "Rs.";

  const [kind, setKind] = useState<NoteKind>("credit");
  const [mode, setMode] = useState<Mode>("list");

  // form state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [partyId, setPartyId] = useState("");
  const [adjAccountId, setAdjAccountId] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [narration, setNarration] = useState("");
  const [saving, setSaving] = useState(false);

  const targetType = kind === "debit" ? VoucherType.DEBIT_NOTE : VoucherType.CREDIT_NOTE;
  const partyTypeFilter = kind === "debit" ? PartyType.SUPPLIER : PartyType.CUSTOMER;

  const adjustmentAccounts = useMemo(() => {
    return accounts.filter((a: any) => {
      if (a.isGroup || !a.isActive) return false;
      const grp = (a.group || "").toLowerCase();
      const name = (a.name || "").toLowerCase();
      return (
        grp.includes("indirect") ||
        grp.includes("discount") ||
        name.includes("discount") ||
        name.includes("adjustment") ||
        name.includes("rebate")
      );
    });
  }, [accounts]);

  const party = useMemo(() => parties.find((p: any) => p.id === partyId), [parties, partyId]);
  const partyAccountId = party?.accountId;

  const list = useMemo(
    () =>
      vouchers
        .filter((v: any) => v.type === targetType)
        .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || "")),
    [vouchers, targetType],
  );

  const reset = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setPartyId("");
    setAdjAccountId("");
    setAmount(0);
    setNarration("");
  };

  const validate = (): string | null => {
    if (!date) return "Date is required.";
    if (
      currentFiscalYear &&
      (date < currentFiscalYear.startDate || date > currentFiscalYear.endDate)
    ) {
      return `Date must lie within fiscal year ${currentFiscalYear.name}.`;
    }
    if (!partyId) return `Select a ${kind === "debit" ? "supplier" : "customer"}.`;
    if (!partyAccountId) return "Selected party has no linked ledger.";
    if (!adjAccountId) return "Select an adjustment ledger.";
    if (!(amount > 0)) return "Amount must be greater than zero.";
    if (!narration.trim()) return "Narration is required.";
    return null;
  };

  const handlePost = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const amt = round2(amount);
      // Build balanced lines
      const lines =
        kind === "debit"
          ? [
              { accountId: partyAccountId, debit: amt, credit: 0, narration },
              { accountId: adjAccountId, debit: 0, credit: amt, narration },
            ]
          : [
              { accountId: adjAccountId, debit: amt, credit: 0, narration },
              { accountId: partyAccountId, debit: 0, credit: amt, narration },
            ];
      await addVoucher({
        type: targetType,
        date,
        dateNepali: ADToBSString(date) || "",
        narration: narration.trim(),
        lines,
        status: VoucherStatus.POSTED,
        referenceNo: "",
        partyId,
      } as any);
      toast.success(`${kind === "debit" ? "Debit" : "Credit"} note posted.`);
      reset();
      setMode("list");
    } catch (e: any) {
      toast.error(e?.message || "Failed to post note.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== "new") return;
      if (e.key === "Escape") {
        e.preventDefault();
        setMode("list");
      } else if (e.key === "F12") {
        e.preventDefault();
        handlePost();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, date, partyId, adjAccountId, amount, narration, kind]);

  // ============= NEW FORM =============
  if (mode === "new") {
    return (
      <div className="flex flex-col gap-5 animate-fadeIn text-xs">
        <ActionToolbar
          title="Debit / Credit Notes"
          subtitle="Adjustments to customer and vendor balances"
        />
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMode("list")}
              className="p-2 rounded-md hover:bg-gray-100 text-gray-500"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#1557b0]" />
                NEW {kind === "debit" ? "DEBIT" : "CREDIT"} NOTE
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">
                {kind === "debit" ? "Reduce supplier payable" : "Reduce customer receivable"}
              </p>
            </div>
          </div>
          <Badge variant={kind === "debit" ? "info" : "warning"} size="md">
            {kind === "debit" ? "DEBIT NOTE" : "CREDIT NOTE"}
          </Badge>
        </div>

        <Card border padding="md">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NepaliDatePicker label="Date" value={date} onChange={setDate} required />
            <PartySelect
              label={kind === "debit" ? "Supplier" : "Customer"}
              value={partyId}
              onChange={setPartyId}
              partyType={partyTypeFilter}
              required
            />
            <Select
              label="Adjustment Ledger"
              value={adjAccountId}
              onChange={setAdjAccountId}
              required
              options={[
                { value: "", label: "Select adjustment ledgerâ€¦" },
                ...adjustmentAccounts.map((a: any) => ({
                  value: a.id,
                  label: `${a.name} (${a.group || ""})`,
                })),
              ]}
            />
          </div>
        </Card>

        <Card border padding="md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AmountInput
              label="Amount"
              value={amount}
              onChange={setAmount}
              required
              currencySymbol={symbol}
            />
            <Input
              label="Narration"
              value={narration}
              onChange={setNarration}
              placeholder="Reason for adjustment"
              required
            />
          </div>

          {/* Journal preview */}
          {amount > 0 && partyAccountId && adjAccountId && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Journal preview
              </p>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="font-bold text-slate-700">Account</div>
                <div className="font-bold text-right text-slate-700">Debit</div>
                <div className="font-bold text-right text-slate-700">Credit</div>
                {(kind === "debit"
                  ? [
                      { acc: party?.name, dr: amount, cr: 0 },
                      {
                        acc: accounts.find((a: any) => a.id === adjAccountId)?.name,
                        dr: 0,
                        cr: amount,
                      },
                    ]
                  : [
                      {
                        acc: accounts.find((a: any) => a.id === adjAccountId)?.name,
                        dr: amount,
                        cr: 0,
                      },
                      { acc: party?.name, dr: 0, cr: amount },
                    ]
                ).map((row, i) => (
                  <React.Fragment key={i}>
                    <div className="text-slate-700">{row.acc}</div>
                    <div className="text-right font-mono">
                      {row.dr ? `${symbol} ${formatNumber(row.dr)}` : "â€”"}
                    </div>
                    <div className="text-right font-mono">
                      {row.cr ? `${symbol} ${formatNumber(row.cr)}` : "â€”"}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
          <Button variant="outline" size="sm" onClick={() => setMode("list")}>
            Cancel (Esc)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePost}
            loading={saving}
            icon={<Save className="h-4 w-4" />}
          >
            Post Note (F12)
          </Button>
        </div>
      </div>
    );
  }

  // ============= LIST =============
  const columns = [
    {
      key: "voucherNo",
      header: "Note No",
      render: (v: string) => <span className="font-mono font-bold text-slate-700">{v}</span>,
    },
    { key: "dateNepali", header: "Date (BS)", render: (v: string) => v || "â€”" },
    { key: "date", header: "Date (AD)" },
    {
      key: "partyId",
      header: "Party",
      render: (v: string) => parties.find((p: any) => p.id === v)?.name || "â€”",
    },
    {
      key: "totalDebit",
      header: "Amount",
      align: "right",
      render: (v: number) => `${symbol} ${formatNumber(v)}`,
    },
    {
      key: "narration",
      header: "Narration",
      render: (v: string) => <span className="truncate max-w-xs inline-block">{v}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (v: string) => (
        <Badge
          variant={v === "posted" ? "success" : v === "cancelled" ? "danger" : "default"}
          size="sm"
        >
          {(v || "").toUpperCase()}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5 animate-fadeIn text-xs">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#1557b0]" /> Debit / Credit Notes
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">
            Non-inventory price adjustments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
            {(["credit", "debit"] as NoteKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${kind === k ? "bg-[#1557b0] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {k === "credit" ? "Credit Notes" : "Debit Notes"}
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              reset();
              setMode("new");
            }}
          >
            New {kind === "debit" ? "Debit" : "Credit"} Note
          </Button>
        </div>
      </div>

      <Card border padding="none">
        <SearchableTable
          columns={columns as any}
          data={list}
          searchFields={["voucherNo", "narration"]}
          emptyMessage={`No ${kind === "debit" ? "debit" : "credit"} notes yet.`}
        />
      </Card>
    </div>
  );
};

export default DebitCreditNote;
