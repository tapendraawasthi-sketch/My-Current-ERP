/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bill sundries, payment/TDS/narration, and totals estimate panel (STEP 5.2).
 */

import React from "react";
import { Card, Button, Input, Select, NepaliDatePicker } from "../ui";
import { Plus, Trash2, Banknote, Landmark, CreditCard } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { INVOICE_FORM_TOTALS_DISCLAIMER } from "@/platform/calc/calcAuthorityPolicy";
import { PaymentMode, TdsType } from "@/lib/types";
import AttachmentUploader from "../ui/AttachmentUploader";

const uid = () => Math.random().toString(36).slice(2, 10);

interface BillSundryRow {
  id: string;
  name: string;
  type: "additive" | "subtractive";
  amount: number;
}

interface BankAccountOption {
  id: string;
  code?: string;
  name: string;
}

interface InvoiceComputation {
  subtotal: number;
  taxableAmount: number;
  vatAmount: number;
}

interface InvoiceTotalsProps {
  billSundries: BillSundryRow[];
  setBillSundries: React.Dispatch<React.SetStateAction<BillSundryRow[]>>;
  optionalOpen: boolean;
  setOptionalOpen: (open: boolean) => void;
  onOptionalOpenToggle: () => void;
  rareOpen: boolean;
  onRareOpenToggle: () => void;
  readOnly: boolean;
  markDirty: () => void;
  payMode: PaymentMode;
  setPayMode: (mode: PaymentMode) => void;
  bankAccounts: BankAccountOption[];
  bankAccountId: string;
  setBankAccountId: (v: string) => void;
  chequeNo: string;
  setChequeNo: (v: string) => void;
  chequeDate: string;
  setChequeDate: (v: string) => void;
  paidAmount: number;
  setPaidAmount: (v: number) => void;
  balance: number;
  symbol: string;
  party?: { subjectToTds?: boolean } | null;
  tdsEnabled: boolean;
  setTdsEnabled: (v: boolean) => void;
  tdsType: TdsType;
  setTdsType: (v: TdsType) => void;
  tdsRate: number;
  setTdsRate: (v: number) => void;
  tdsAmount: number;
  narration: string;
  setNarration: (v: string) => void;
  narrationNe: string;
  setNarrationNe: (v: string) => void;
  attachments: string[];
  setAttachments: React.Dispatch<React.SetStateAction<string[]>>;
  computation: InvoiceComputation;
  discountAmount: number;
  roundOff: number;
  grandTotal: number;
}

const InvoiceTotals: React.FC<InvoiceTotalsProps> = ({
  billSundries,
  setBillSundries,
  optionalOpen,
  setOptionalOpen,
  onOptionalOpenToggle,
  rareOpen,
  onRareOpenToggle,
  readOnly,
  markDirty,
  payMode,
  setPayMode,
  bankAccounts,
  bankAccountId,
  setBankAccountId,
  chequeNo,
  setChequeNo,
  chequeDate,
  setChequeDate,
  paidAmount,
  setPaidAmount,
  balance,
  symbol,
  party,
  tdsEnabled,
  setTdsEnabled,
  tdsType,
  setTdsType,
  tdsRate,
  setTdsRate,
  tdsAmount,
  narration,
  setNarration,
  narrationNe,
  setNarrationNe,
  attachments,
  setAttachments,
  computation,
  discountAmount,
  roundOff,
  grandTotal,
}) => {
  return (
    <>
      {/* Optional: Bill Sundries */}
      <div
        className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)]"
        data-testid="invoice-optional-sundries"
      >
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--ds-surface-muted)]"
          aria-expanded={optionalOpen}
          onClick={onOptionalOpenToggle}
        >
          <span>
            <span className="text-[13px] font-semibold text-[var(--ds-text-default)]">
              Bill sundries
            </span>
            <span className="mt-0.5 block text-[12px] text-[var(--ds-text-muted)]">
              {billSundries.length > 0
                ? `${billSundries.length} charge${billSundries.length === 1 ? "" : "s"}`
                : "Shipping, freight, bill-level discounts"}
            </span>
          </span>
          <span className="text-[12px] font-medium text-[var(--ds-action-primary)]">
            {optionalOpen ? "Hide" : "Show"}
          </span>
        </button>
        {optionalOpen ? (
          <div className="border-t border-[var(--ds-border-default)] p-4">
            <div className="flex items-center justify-end mb-3">
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setBillSundries((p) => [
                    ...p,
                    { id: uid(), name: "", type: "additive", amount: 0 },
                  ]);
                  markDirty();
                }}
                disabled={readOnly}
                icon={<Plus className="h-3 w-3" />}
              >
                Add Sundry
              </Button>
            </div>
            {billSundries.length > 0 ? (
              <div className="overflow-x-auto rounded-md border border-[var(--ds-border-default)]">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--ds-surface-muted)] text-[10px] font-semibold text-[var(--ds-text-muted)] uppercase tracking-wide border-b border-[var(--ds-border-default)]">
                    <tr>
                      <th className="px-2 py-2 text-left">Sundry Name</th>
                      <th className="px-2 py-2 text-center w-32">Type</th>
                      <th className="px-2 py-2 text-right w-32">Amount</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {billSundries.map((sundry, idx) => (
                      <tr
                        key={sundry.id}
                        className="border-b border-[var(--ds-border-default)] hover:bg-[var(--ds-surface-muted)]/50"
                      >
                        <td className="px-2 py-1">
                          <input
                            className="w-full h-8 px-2 text-[12px] font-mono bg-transparent border border-transparent focus:border-[var(--ds-action-primary)] focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:bg-[var(--ds-surface)] rounded-md outline-none"
                            value={sundry.name}
                            onChange={(e) => {
                              const n = [...billSundries];
                              n[idx].name = e.target.value;
                              setBillSundries(n);
                              markDirty();
                            }}
                            disabled={readOnly}
                            placeholder="e.g. Shipping / Discount"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <select
                            aria-label="Bill sundry type"
                            className="w-full h-8 px-2 text-[12px] font-mono bg-transparent border border-transparent focus:border-[var(--ds-action-primary)] focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:bg-[var(--ds-surface)] rounded-md outline-none"
                            value={sundry.type}
                            onChange={(e) => {
                              const n = [...billSundries];
                              n[idx].type = e.target.value as BillSundryRow["type"];
                              setBillSundries(n);
                              markDirty();
                            }}
                            disabled={readOnly}
                          >
                            <option value="additive">Additive (+)</option>
                            <option value="subtractive">Subtractive (-)</option>
                          </select>
                        </td>
                        <td className="px-2 py-1 text-right">
                          <input
                            type="number"
                            className="w-full h-7 px-2 text-[12px] border-0 border-b border-[var(--ds-border-default)] bg-transparent text-right focus:outline-none focus:border-[var(--ds-action-primary)]"
                            value={sundry.amount || ""}
                            onChange={(e) => {
                              const n = [...billSundries];
                              n[idx].amount = Number(e.target.value) || 0;
                              setBillSundries(n);
                              markDirty();
                            }}
                            disabled={readOnly}
                            placeholder="0.00"
                            min={0}
                            step="0.01"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          {!readOnly && (
                            <button
                              onClick={() => {
                                setBillSundries((p) => p.filter((s) => s.id !== sundry.id));
                                markDirty();
                              }}
                              className="p-1 text-[var(--ds-text-default)] hover:text-red-500 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[12px] text-[var(--ds-text-muted)]">No bill sundries yet.</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Payment + Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
        {/* Payment & TDS & Narration */}
        <Card border padding="md">
          <h3 className="text-[11px] font-medium text-[var(--ds-text-muted)] mb-3">
            Payment
          </h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { id: PaymentMode.CASH, label: "Cash", icon: Banknote },
              { id: PaymentMode.BANK_TRANSFER, label: "Bank", icon: Landmark },
              { id: PaymentMode.CREDIT, label: "Credit", icon: CreditCard },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  setPayMode(id as PaymentMode);
                  markDirty();
                }}
                className={`inline-flex items-center justify-center gap-1.5 h-8 rounded-md border text-[12px] font-medium transition-colors ${payMode === id ? "bg-[var(--ds-action-primary)] text-white border-[var(--ds-action-primary)]" : "bg-[var(--ds-surface)] text-[var(--ds-text-default)] border-[var(--ds-border-default)] hover:bg-[var(--ds-surface-muted)]"}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {payMode === PaymentMode.BANK_TRANSFER && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 w-full">
                <label className="text-[12px] text-[var(--ds-text-default)] font-medium">Bank Account</label>
                <select
                  aria-label="Bank account"
                  value={bankAccountId}
                  onChange={(e) => {
                    setBankAccountId(e.target.value);
                    markDirty();
                  }}
                  disabled={readOnly}
                  className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                >
                  <option value="" disabled>
                    Select bank
                  </option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Cheque No"
                value={chequeNo}
                onChange={(v) => {
                  setChequeNo(v);
                  markDirty();
                }}
                placeholder="Optional"
                disabled={readOnly}
              />
              <NepaliDatePicker
                label="Cheque Date"
                value={chequeDate}
                onChange={(v) => {
                  setChequeDate(v);
                  markDirty();
                }}
                disabled={readOnly}
              />
            </div>
          )}

          {payMode === PaymentMode.CREDIT && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                type="number"
                label="Amount Paid Now"
                value={paidAmount || ""}
                onChange={(v) => {
                  setPaidAmount(Number(v) || 0);
                  markDirty();
                }}
                placeholder="0.00"
                hint="Leave 0 for fully credit sale"
                disabled={readOnly}
              />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--ds-text-default)]">Balance Due</span>
                <span
                  className={`font-mono font-bold text-base ${balance > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {symbol} {formatNumber(balance)}
                </span>
              </div>
            </div>
          )}

          {party?.subjectToTds && optionalOpen ? (
            <div className="mt-4 pt-4 border-t border-[var(--ds-border-default)]">
              <div className="flex items-center gap-2 mb-3">
                <input
                  id="tds-enabled"
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--ds-action-primary)]"
                  checked={tdsEnabled}
                  onChange={(e) => {
                    setTdsEnabled(e.target.checked);
                    markDirty();
                  }}
                  disabled={readOnly}
                />
                <label htmlFor="tds-enabled" className="text-[11px] font-medium text-gray-600">
                  Deduct TDS
                </label>
              </div>
              {tdsEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select
                    label="TDS Type"
                    options={Object.values(TdsType)
                      .filter((v) => v !== TdsType.NONE)
                      .map((v) => ({ value: v, label: String(v).toUpperCase() }))}
                    value={tdsType}
                    onChange={(v) => {
                      setTdsType(v as TdsType);
                      markDirty();
                    }}
                    disabled={readOnly}
                  />
                  <Input
                    type="number"
                    label="TDS Rate %"
                    value={tdsRate || ""}
                    onChange={(v) => {
                      setTdsRate(Number(v) || 0);
                      markDirty();
                    }}
                    disabled={readOnly}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-[var(--ds-text-default)]">TDS Amount</span>
                    <span className="font-mono font-bold text-orange-600 text-base">
                      {symbol} {formatNumber(tdsAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {party?.subjectToTds && !optionalOpen ? (
            <div className="mt-3">
              <button
                type="button"
                className="text-[12px] font-medium text-[var(--ds-action-primary)]"
                onClick={() => setOptionalOpen(true)}
              >
                Show TDS options
              </button>
            </div>
          ) : null}

          <div className="mt-4 pt-4 border-t border-[var(--ds-border-default)]">
            <label className="text-[12px] font-semibold text-[var(--ds-text-default)] block mb-1">
              Narration (English)
            </label>
            <textarea
              className="w-full h-16 p-2 text-[12px] border border-[var(--ds-border-default)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] resize-none"
              value={narration}
              onChange={(e) => {
                setNarration(e.target.value.substring(0, 200));
                markDirty();
              }}
              placeholder="Optional notes / description"
              disabled={readOnly}
            />
            <div className="text-right text-[12px] text-[var(--ds-text-default)] mt-0.5">
              {narration.length}/200
            </div>
          </div>

          <div
            className="mt-3 rounded-md border border-[var(--ds-border-default)]"
            data-testid="invoice-rare-fields"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--ds-surface-muted)]"
              aria-expanded={rareOpen}
              onClick={onRareOpenToggle}
            >
              <span className="text-[12px] font-semibold text-[var(--ds-text-default)]">
                Rare fields
                <span className="ml-1.5 font-normal text-[var(--ds-text-muted)]">
                  Nepali narration · Attachments
                  {attachments.length > 0 ? ` (${attachments.length})` : ""}
                </span>
              </span>
              <span className="text-[12px] font-medium text-[var(--ds-action-primary)]">
                {rareOpen ? "Hide" : "Show"}
              </span>
            </button>
            {rareOpen ? (
              <div className="space-y-3 border-t border-[var(--ds-border-default)] px-3 py-3">
                <div>
                  <label className="text-[12px] font-semibold text-[var(--ds-text-default)] block mb-1">
                    Narration (Nepali)
                  </label>
                  <textarea
                    className="w-full h-16 p-2 text-[12px] border border-[var(--ds-border-default)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] resize-none"
                    value={narrationNe}
                    onChange={(e) => {
                      setNarrationNe(e.target.value.substring(0, 200));
                      markDirty();
                    }}
                    placeholder="नेपालीमा कैफियत..."
                    disabled={readOnly}
                  />
                  <div className="text-right text-[12px] text-[var(--ds-text-default)] mt-0.5">
                    {narrationNe.length}/200
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--ds-text-default)] mb-1 block">
                    Attachments
                  </label>
                  <AttachmentUploader
                    attachments={attachments}
                    onAdd={(b64) => {
                      setAttachments((p) => [...p, b64]);
                      markDirty();
                    }}
                    onRemove={(idx) => {
                      setAttachments((p) => p.filter((_, i) => i !== idx));
                      markDirty();
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        {/* Totals — NEXT-11 / ADR_0078: display estimate, not post authority */}
        <div className="flex justify-end">
          <div className="totals-panel">
            <p className="text-[11px] text-gray-500 mb-2 text-right">
              {INVOICE_FORM_TOTALS_DISCLAIMER}
            </p>
            <div className="totals-row">
              <span className="font-medium">Subtotal</span>
              <span className="number-cell">
                {symbol} {formatNumber(computation.subtotal)}
              </span>
            </div>
            <div className="totals-row">
              <span className="font-medium">Discount</span>
              <span className="number-cell">
                - {symbol} {formatNumber(discountAmount)}
              </span>
            </div>
            <div className="totals-row">
              <span className="font-medium">Taxable Amount</span>
              <span className="number-cell">
                {symbol} {formatNumber(computation.taxableAmount)}
              </span>
            </div>
            <div className="totals-row">
              <span className="font-medium">VAT 13%</span>
              <span className="number-cell">
                {symbol} {formatNumber(computation.vatAmount)}
              </span>
            </div>
            {tdsEnabled && (
              <div className="totals-row">
                <span className="font-medium">TDS Deducted</span>
                <span className="number-cell">
                  - {symbol} {formatNumber(tdsAmount)}
                </span>
              </div>
            )}
            {roundOff !== 0 && (
              <div className="totals-row">
                <span className="font-medium">Round Off</span>
                <span className="number-cell">
                  {roundOff > 0 ? "+" : ""}
                  {symbol} {formatNumber(roundOff)}
                </span>
              </div>
            )}
            <div className="totals-row total-final">
              <span>Grand Total</span>
              <span className="number-cell-bold">
                {symbol} {formatNumber(grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoiceTotals;
